import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DiverseWeeklyReport } from './entities/diverse_weekly.entity';

@Injectable()
export class DiverseWeeklyService {
  private readonly logger = new Logger(DiverseWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'EMPLOYEE NAME',
    'EMPLOYEE PAYROLL ID',
    'FIRST NAME',
    'LAST NAME',
    'DEPARTMENT NAME',
    'REG',
    'OT1',
    'TOTAL',
    'BILL RATE',
  ];

  private readonly identifyingFields = ['employee_payroll_id', 'start_date', 'end_date'];

  private readonly fieldsToUpdate = [
    'employee_name',
    'first_name',
    'last_name',
    'department_name',
    'reg',
    'ot1',
    'total',
    'bill_rate',
    'uploaded_by',
  ];

  async process(
    data: any[],
    fileName: string,
    startDateStr: string,
    endDateStr: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing diverse weekly report: ${fileName}, rows: ${data.length}`);

    if (data.length === 0) {
      throw new BadRequestException('No data provided');
    }

    const headerRowIndex = this.findHeaderRowIndex(data);
    if (headerRowIndex === -1) {
      throw new BadRequestException('Valid header row not found in uploaded file.');
    }

    const headerKeys = Object.keys(data[headerRowIndex]).map(h => h.trim().toUpperCase());
    this.validateHeaders(headerKeys);

    const dataRows = data.slice(headerRowIndex).filter((row, idx) => {
      return idx !== 0 || Object.values(row).some(
        (val) => val !== null && val !== undefined && val.toString().trim() !== ''
      );
    });

    if (dataRows.length === 0) {
      throw new BadRequestException('No data rows found after header.');
    }

    const startDate = this.parseDate(startDateStr);
    const endDate = this.parseDate(endDateStr);

    const mapped = dataRows
      .map((row) => this.mapToEntity(row, startDate, endDate, username))
      .filter((row): row is DiverseWeeklyReport => row !== null);

    await this.insertOrUpdateTransactional(mapped);
  }

  private findHeaderRowIndex(data: any[]): number {
    const normalizedExpected = this.expectedHeaders.map(h => h.trim().toUpperCase());

    for (let i = 0; i < data.length; i++) {
      const keys = Object.keys(data[i]).map(k => k.trim().toUpperCase());
      if (
        keys.length === normalizedExpected.length &&
        keys.every((key, idx) => key === normalizedExpected[idx])
      ) {
        return i;
      }
    }
    return -1;
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim().toUpperCase();
    const received = receivedHeaders.map(normalize);
    const expected = this.expectedHeaders.map(normalize);

    const missing = expected.filter((col) => !received.includes(col));
    const extras = received.filter((col) => !expected.includes(col));

    const issues: string[] = [];
    if (missing.length) issues.push(`Missing: ${missing.join(', ')}`);
    if (extras.length) issues.push(`Unexpected: ${extras.join(', ')}`);

    if (issues.length) {
      throw new BadRequestException(issues.join(' | '));
    }
  }

  private parseDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
    }
    return new Date(dateStr);
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
    uploaded_by: string
  ): DiverseWeeklyReport | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const get = (key: string): string => {
      const value = raw[key];
      return typeof value === 'string' ? value.trim() : String(value ?? '');
    };

    try {
      const employeePayrollId = get('EMPLOYEE PAYROLL ID');
      if (!employeePayrollId) {
        this.logger.warn(`Skipping row due to missing employeePayrollId: ${JSON.stringify(raw)}`);
        return null;
      }

      return {
        employeePayrollId,
        startDate,
        endDate,
        employeeName: get('EMPLOYEE NAME'),
        firstName: get('FIRST NAME'),
        lastName: get('LAST NAME'),
        departmentName: get('DEPARTMENT NAME'),
        reg: parseNumber(get('REG')),
        ot1: parseNumber(get('OT1')),
        total: parseNumber(get('TOTAL')),
        billRate: parseNumber(get('BILL RATE')),
        uploaded_by,
      };
    } catch (error) {
      this.logger.warn(`Skipping row due to error: ${error.message}`);
      return null;
    }
  }

  private async insertOrUpdateTransactional(data: DiverseWeeklyReport[]) {
    this.logger.log(`Starting insertOrUpdateTransactional for ${data.length} rows`);

    const batchSize = 1000;
    const columns = [
      'employee_payroll_id',
      'start_date',
      'end_date',
      'employee_name',
      'first_name',
      'last_name',
      'department_name',
      'reg',
      'ot1',
      'total',
      'bill_rate',
      'uploaded_by',
    ];

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map((row) => {
          const rowValues = columns.map((col) => {
            const value = (row as any)[col] ?? (row as any)[this.snakeToCamel(col)];
            values.push(value);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO diverse_weekly_reports (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (${this.identifyingFields.join(', ')})
          DO UPDATE SET ${this.fieldsToUpdate
            .map((f) => `${f} = EXCLUDED.${f}`)
            .join(', ')};
        `;

        await manager.query(query, values);
        this.logger.log(`Batch inserted/updated rows ${i} to ${i + chunk.length - 1}`);
      }
    });

    this.logger.log(`Completed insertOrUpdateTransactional for all rows`);
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  }
}
