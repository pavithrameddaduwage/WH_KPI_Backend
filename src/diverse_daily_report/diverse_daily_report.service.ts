import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DiverseDailyReport } from './entities/diverse_daily_report.entity';

@Injectable()
export class DiverseDailyReportService {
  private readonly logger = new Logger(DiverseDailyReportService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly requiredHeaders = [
    'EMPLOYEE NAME',
    'EMPLOYEE PAYROLL ID',
    'LAST NAME',
  ];

  private readonly identifyingFields = ['uploaded_date', 'employee_payroll_id'];

  private readonly fieldsToUpdate = [
    'employee_name',
    'first_name',
    'last_name',
    'pay_rate',
    'bill_rate',
    'department_name',
    'reg',
    'ot1',
    'ot2',
    'vac',
    'hol',
    'sic',
    'oth',
    'total',
    'date',
    'usd_cost',
    'uploaded_by',
  ];

  async process(data: any[], fileName: string, reportDate: string, uploaded_by: string): Promise<void> {
    try {
      if (data.length === 0) {
        throw new BadRequestException('No data provided');
      }

      const parsedReportDate = this.validateAndNormalizeDate(reportDate);

      const isHeaderRow = (row: Record<string, any>): boolean => {
        const values = Object.values(row).map((val) =>
          String(val || '').trim().toUpperCase(),
        );
        return this.requiredHeaders.every((header) => values.includes(header));
      };

      const headerIndex = data.findIndex(isHeaderRow);
      if (headerIndex === -1) {
        throw new BadRequestException('Valid header row not found in uploaded file.');
      }

      const headerRow = data[headerIndex];
      const headers: string[] = Object.values(headerRow).map((val) =>
        String(val).replace(/\s+/g, ' ').trim().toUpperCase(),
      );

      const contentRows = data.slice(headerIndex + 1);

      const structuredRows = contentRows.map((row) => {
        const values = Object.values(row);
        const mapped: Record<string, any> = {};
        headers.forEach((key, idx) => {
          if (key) mapped[key] = values[idx];
        });
        return mapped;
      });

      this.validateHeaders(headers);

      const mapped = structuredRows
        .map((row) => this.mapToEntity(row, parsedReportDate, uploaded_by))
        .filter((row): row is DiverseDailyReport => row !== null);

      if (mapped.length === 0) {
        return;
      }

      await this.insertOrUpdateTransactional(mapped);
    } catch (error: any) {
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(
            error.message || 'Failed to process diverse report JSON',
          );
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (str: string) =>
      str.replace(/\s+/g, ' ').trim().toUpperCase();
    const received = receivedHeaders.map(normalize);
    const required = this.requiredHeaders.map(normalize);
    const missing = required.filter((col) => !received.includes(col));
    if (missing.length) {
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}`,
      );
    }
  }

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(
        `Invalid date format: "${dateStr}". Expected format: YYYY-MM-DD.`,
      );
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    uploadedDate: Date,
    uploaded_by: string,
  ): DiverseDailyReport | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const normalizedRaw: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.replace(/\s+/g, ' ').trim().toUpperCase();
      normalizedRaw[normalizedKey] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    const payrollId = normalizedRaw['EMPLOYEE PAYROLL ID'];
    const dateStr = normalizedRaw['DATE'];

    if (!payrollId) {
      return null;
    }

    const parsedDate = dateStr?.trim() ? new Date(dateStr) : null;

    return {
      uploadedDate,
      employeePayrollId: payrollId,
      employeeName: normalizedRaw['EMPLOYEE NAME'],
      firstName: normalizedRaw['FIRST NAME'],
      lastName: normalizedRaw['LAST NAME'],
      payRate: parseNumber(normalizedRaw['PAY RATE']),
      billRate: parseNumber(normalizedRaw['BILL RATE']),
      departmentName: normalizedRaw['DEPARTMENT NAME'],
      reg: parseNumber(normalizedRaw['REG']),
      ot1: parseNumber(normalizedRaw['OT1']),
      ot2: parseNumber(normalizedRaw['OT2']),
      vac: parseNumber(normalizedRaw['VAC']),
      hol: parseNumber(normalizedRaw['HOL']),
      sic: parseNumber(normalizedRaw['SIC']),
      oth: parseNumber(normalizedRaw['OTH']),
      total: parseNumber(normalizedRaw['TOTAL']),
      date: parsedDate,
      usdCost: parseNumber(normalizedRaw['USD COST']),
      uploaded_by,
    };
  }

  private async insertOrUpdateTransactional(data: DiverseDailyReport[]) {
    const batchSize = 1000;

    const columns = [
      'uploaded_date',
      'employee_payroll_id',
      'employee_name',
      'first_name',
      'last_name',
      'pay_rate',
      'bill_rate',
      'department_name',
      'reg',
      'ot1',
      'ot2',
      'vac',
      'hol',
      'sic',
      'oth',
      'total',
      'date',
      'usd_cost',
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
          INSERT INTO diverse_daily_reports (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (${this.identifyingFields.join(', ')})
          DO UPDATE SET ${this.fieldsToUpdate
            .map((f) => `${f} = EXCLUDED.${f}`)
            .join(', ')};
        `;

        await manager.query(query, values);
      }
    });
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  }
}
