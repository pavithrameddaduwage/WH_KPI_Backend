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
    'uploaded_by': 'uploaded_by',
  };

  async process(
    data: any[],
    fileName: string,
    startDateStr: string,
    endDateStr: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing Freight Breakers Weekly Report: ${fileName}`);
    console.log('Uploaded by:', username);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in the uploaded file.');
      }

      const startDate = this.validateAndNormalizeDate(startDateStr);
      const endDate = this.validateAndNormalizeDate(endDateStr);

      const headerRowIndex = this.findHeaderRowIndex(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException('Valid header row not found.');
      }

      const headers = Object.keys(data[headerRowIndex] || {}).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.slice(headerRowIndex).filter(row =>
        Object.values(row).some(
          val => val !== null && val !== undefined && val.toString().trim() !== '',
        ),
      );

      const mapped = rows
        .map(row => this.mapToEntity(row, startDate, endDate, username))
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

  private findHeaderRowIndex(data: any[]): number {
    const expectedNormalized = this.expectedHeaders.map(h => h.replace(/\s+/g, '').toLowerCase());

    for (let i = 0; i < data.length; i++) {
      const keys = Object.keys(data[i] || {}).map(k => k.replace(/\s+/g, '').toLowerCase());
      if (
        keys.length >= expectedNormalized.length &&
        expectedNormalized.every(h => keys.includes(h))
      ) {
        return i;
      }
    }
    return -1;
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

  private parseExcelDate(val: number): Date {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const correctedDays = val >= 60 ? val - 1 : val; // Excel bug fix
    return new Date(excelEpoch.getTime() + correctedDays * msPerDay);
  }

  private parseDateField(val: any): Date | null {
    if (typeof val === 'number') {
      return this.parseExcelDate(val);
    }

    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts.map(Number);
        if (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return new Date(y, m - 1, d, 12);
        }
      }

      const iso = new Date(val);
      if (!isNaN(iso.getTime())) {
        return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate(), 12);
      }
    }

    return null;
  }

  private mapToEntity(
    raw: Record<string, any>,
    startDate: Date,
    endDate: Date,
    username: string,
  ): FreightBreakersWeekly | null {
    const record: any = {
      'Start Date': startDate,
      'End Date': endDate,
      'Date': this.parseDateField(raw['Date']),
      'uploaded_by': username,
    };

    if (!record['Date']) {
      this.logger.warn(`Skipping row due to invalid date: ${JSON.stringify(raw)}`);
      return null;
    }

    for (const header of this.expectedHeaders) {
      if (header === 'Date') continue;

      const val = raw[header];
      record[header] =
        ['QTY', 'SKUCount', 'Units'].includes(header)
          ? this.parseIntOrZero(val)
          : ['Rate', 'Amount'].includes(header)
            ? this.parseFloatOrZero(val)
            : (val ?? '').toString().trim();
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

    const allHeaders = [...conflictColumns, 'amount', 'uploaded_by'];

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
          INSERT INTO freight_breakers_weekly (${allHeaders.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (${conflictColumns.join(', ')})
          DO UPDATE SET
            amount = EXCLUDED.amount,
            uploaded_by = EXCLUDED.uploaded_by;
        `;

        await manager.query(query, values);
      }
    });
  }
}
