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
    'Date',
    'Employee',
    'Job',
    'Container',
    'QTY',
    'SKUCount',
    'Door',
    'Type',
    'Units',
    'Rate',
    'Amount',
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

      const firstRow = data[0];
      const headers = Object.keys(firstRow).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.filter(row =>
        Object.values(row).some(val =>
          val !== null &&
          val !== undefined &&
          val.toString().trim() !== ''
        )
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

  private mapToEntity(
    raw: Record<string, any>,
    startDate: Date,
    endDate: Date
  ): FreightBreakersWeekly | null {
    const parseFloatOrNull = (val: unknown): number => {
      const n = parseFloat((val ?? '').toString().replace(/[^\d.-]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    const parseDate = (val: unknown): Date | null => {
      const d = new Date(val as string);
      return isNaN(d.getTime()) ? null : d;
    };

    const record: any = {
      'Start Date': startDate,
      'End Date': endDate,
      'Date': parseDate(raw['Date']),
    };

    if (!record['Date']) return null;

    for (const header of this.expectedHeaders) {
      if (['Date'].includes(header)) continue;

      const val = raw[header];

      record[header] = ['QTY', 'SKUCount', 'Units'].includes(header)
        ? parseInt(val)
        : ['Rate', 'Amount'].includes(header)
        ? parseFloatOrNull(val)
        : val?.toString().trim() ?? null;
    }

    return record as FreightBreakersWeekly;
  }

  private async insertOrUpdateTransactional(data: FreightBreakersWeekly[]) {
    const batchSize = 1000;
    const allHeaders = ['Start Date', 'End Date', 'Date', ...this.expectedHeaders.filter(h => h !== 'Date')];
    const dbColumns = allHeaders.map(h => this.dbColumnMap[h]);

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map(row => {
          const rowValues = allHeaders.map(header => {
            const val = row[header as keyof FreightBreakersWeekly];
            values.push(val);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO freight_breakers_weekly (${dbColumns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (start_date, end_date, date)
          DO UPDATE SET ${dbColumns
            .filter(col => !['start_date', 'end_date', 'date'].includes(col))
            .map(col => `${col} = EXCLUDED.${col}`).join(', ')};
        `;

        await manager.query(query, values);
      }
    });
  }
}
