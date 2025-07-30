import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { FreightBreakersWeekly } from './entities/freight_breakers_weekly.entity';

@Injectable()
export class FreightBreakersWeeklyService {
  private readonly logger = new Logger(FreightBreakersWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Date', 'Employee', 'Job', 'Container', 'QTY',
    'SKUCount', 'Door', 'Type', 'Units', 'Rate', 'Amount',
  ];

  private readonly dbColumnMap: Record<string, string> = {
    'Start Date': 'start_date',
    'End Date': 'end_date',
    'Date': 'date',
    'Employee': 'employee',
    'Job': 'job',
    'Container': 'container',
    'QTY': 'qty',
    'SKUCount': 'sku_count',
    'Door': 'door',
    'Type': 'type',
    'Units': 'units',
    'Rate': 'rate',
    'Amount': 'amount',
  };

  async process(data: any[], fileName: string, startDateStr: string, endDateStr: string): Promise<void> {
    this.logger.log(`Processing Freight Breakers Weekly Report: ${fileName}`);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in the uploaded file.');
      }

      const startDate = this.validateAndNormalizeDate(startDateStr);
      const endDate = this.validateAndNormalizeDate(endDateStr);

      const headers = Object.keys(data[0] || {}).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.filter(row =>
        Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== '')
      );

      const mapped = rows
        .map(row => this.mapToEntity(row, startDate, endDate))
        .filter((row): row is FreightBreakersWeekly => row !== null);

      if (mapped.length === 0) {
        this.logger.warn('No valid rows to insert.');
        return;
      }

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing Freight Breakers Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process Freight Breakers Weekly Report');
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const expected = this.expectedHeaders.map(normalize);
    const received = receivedHeaders.map(normalize);

    const missing = expected.filter(e => !received.includes(e));
    if (missing.length) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }
  }

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  private parseIntOrZero(val: unknown): number {
    const n = parseInt((val ?? '').toString().replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  private parseFloatOrZero(val: unknown): number {
    const n = parseFloat((val ?? '').toString().replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private mapToEntity(
    raw: Record<string, any>,
    startDate: Date,
    endDate: Date
  ): FreightBreakersWeekly | null {
    const parseDate = (val: unknown): Date | null => {
      if (val == null) return null;

      if (typeof val === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));  
        let days = val;
        if (days >= 60) days -= 1;
        const date = new Date(excelEpoch.getTime() + days * 86400 * 1000);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
      }

      if (typeof val === 'string') {
      
        const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const m = val.match(mmddyyyy);
        if (m) {
          const month = parseInt(m[1], 10);
          const day = parseInt(m[2], 10);
          const year = parseInt(m[3], 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return new Date(year, month - 1, day, 12);
          }
        }
    
        const isoDate = new Date(val);
        if (!isNaN(isoDate.getTime())) {
          return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate(), 12);
        }
      }

      return null;
    };

    const record: any = {
      'Start Date': startDate,
      'End Date': endDate,
      'Date': parseDate(raw['Date']),
    };

    if (!record['Date']) return null;

    for (const header of this.expectedHeaders) {
      if (header === 'Date') continue;

      const val = raw[header];

      record[header] =
        ['QTY', 'SKUCount', 'Units'].includes(header)
          ? this.parseIntOrZero(val)
          : ['Rate', 'Amount'].includes(header)
          ? this.parseFloatOrZero(val)
          : (val ?? '').toString().trim() === ''
          ? ''
          : val.toString().trim();
    }

    return record as FreightBreakersWeekly;
  }

  private async insertOrUpdateTransactional(data: FreightBreakersWeekly[]) {
    const batchSize = 1000;
    const conflictColumns = [
      'start_date', 'end_date', 'date', 'employee',
      'job', 'container', 'qty', 'sku_count',
      'door', 'type', 'units', 'rate',
    ];

    const allHeaders = [...conflictColumns, 'amount'];
    const dbColumns = allHeaders;

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map(row => {
          const rowValues = allHeaders.map(header => {
            const entityKey = Object.entries(this.dbColumnMap).find(([key, val]) => val === header)?.[0];
            const val = entityKey ? row[entityKey as keyof FreightBreakersWeekly] : null;
            values.push(val);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO freight_breakers_weekly (${dbColumns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (${conflictColumns.join(', ')})
          DO UPDATE SET amount = EXCLUDED.amount;
        `;

        await manager.query(query, values);
      }
    });
  }
}
