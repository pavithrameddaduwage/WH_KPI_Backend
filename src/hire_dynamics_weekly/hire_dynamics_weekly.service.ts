import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { HireDynamicsWeekly } from './entities/hire_dynamics_weekly.entity';

@Injectable()
export class HireDynamicsWeeklyService {
  private readonly logger = new Logger(HireDynamicsWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Employee',
    'Department  (G3)',
    'Work Date',
    'Approval Status',
    'TIME.DCOMP',
    'Date',
    'Paycode',
    'IN',
    'In Ex',
    'OUT',
    'Out Ex',
    'Reason',
    'Department',
    'Sh/Pay Ex',
    'Reg Hrs',
    'OT',
    'DT',
    'Daily Total',
    'COUNT',
  ];

  private readonly dbColumnMap: Record<string, string> = {
    'Employee': 'employee_id',
    'Start Date': 'start_date', // Injected, not expected in Excel
    'End Date': 'end_date',     // Injected, not expected in Excel
    'Department  (G3)': 'department_g3',
    'Work Date': 'work_date',
    'Approval Status': 'approval_status',
    'TIME.DCOMP': 'time_dcomp',
    'Date': 'date',
    'Paycode': 'paycode',
    'IN': 'in_time',
    'In Ex': 'in_ex',
    'OUT': 'out_time',
    'Out Ex': 'out_ex',
    'Reason': 'reason',
    'Department': 'department',
    'Sh/Pay Ex': 'shift_pay_ex',
    'Reg Hrs': 'reg_hrs',
    'OT': 'ot',
    'DT': 'dt',
    'Daily Total': 'daily_total',
    'COUNT': 'count',
  };

  async process(
    data: any[],
    fileName: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<void> {
    this.logger.log(`Processing Hire Dynamics Weekly Report: ${fileName}`);

    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('File format is invalid or no data provided.');
      }

      const startDate = this.validateAndNormalizeDate(startDateStr);
      const endDate = this.validateAndNormalizeDate(endDateStr);

      const firstRow = data[0];
      const headers = Object.keys(firstRow).filter(h => h.trim() !== '');
      this.logger.debug(`Received headers: ${headers.join(', ')}`);
      this.validateHeaders(headers);

      const rows = data.filter(row =>
        Object.values(row).some(val =>
          val !== null &&
          val !== undefined &&
          (typeof val === 'string' || typeof val === 'number') &&
          val.toString().trim() !== ''
        )
      );

      if (!rows.length) {
        throw new BadRequestException('No usable data rows found.');
      }

      const mapped = rows
        .map(row => this.mapToEntity(row, startDate, endDate))
        .filter((row): row is HireDynamicsWeekly => row !== null);

      if (mapped.length === 0) return;

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing Hire Dynamics Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process Hire Dynamics Weekly Report');
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
  ): HireDynamicsWeekly | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const record: any = {
      'Employee': raw['Employee']?.toString().trim(),
      'Start Date': startDate,
      'End Date': endDate,
    };

    if (!record['Employee']) return null;

    for (const header of this.expectedHeaders) {
      const value = raw[header];
      record[header] = ['Reg Hrs', 'OT', 'DT', 'Daily Total', 'COUNT'].includes(header)
        ? parseNumber(value)
        : (typeof value === 'string' ? value.trim() : value);
    }

    return record as HireDynamicsWeekly;
  }

  private async insertOrUpdateTransactional(data: HireDynamicsWeekly[]) {
  const batchSize = 1000;
  const allHeaders = ['Employee', 'Start Date', 'End Date', 'Work Date', ...this.expectedHeaders.filter(h => !['Employee', 'Work Date'].includes(h))];
  const dbColumns = allHeaders.map(h => this.dbColumnMap[h]);

  await this.entityManager.transaction(async (manager) => {
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const values: any[] = [];

      const placeholders = chunk.map((row) => {
        const rowValues = allHeaders.map((header) => {
          const value = row[header as keyof HireDynamicsWeekly];
          values.push(value);
          return `$${values.length}`;
        });
        return `(${rowValues.join(', ')})`;
      });

      const query = `
        INSERT INTO hire_dynamics_weekly (${dbColumns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (employee_id, start_date, end_date, work_date)
        DO UPDATE SET ${dbColumns
          .filter(col => !['employee_id', 'start_date', 'end_date', 'work_date'].includes(col))
          .map(col => `${col} = EXCLUDED.${col}`).join(', ')};
      `;

      await manager.query(query, values);
    }
  });
}
}
