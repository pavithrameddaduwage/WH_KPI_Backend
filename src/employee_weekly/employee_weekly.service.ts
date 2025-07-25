import {
  BadRequestException,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EmployeeWeekly } from './entities/employee_weekly.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmployeeWeeklyService {
  private readonly logger = new Logger(EmployeeWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'LEGAL LAST NAME',
    'LEGAL FIRST NAME',
    'BUSINESS UNIT DESCRIPTION',
    'BUSINESS UNIT CODE',
    'HOME DEPARTMENT CODE',
    'PAY CODE',
    'DOLLARS',
    'HOURS',
    'FULL NAME',
    'SHIFT',
  ];

  private readonly conflictColumns = [
    'start_date',
    'end_date',
    'legal_last_name',
    'legal_first_name',
    'pay_code',
    'business_unit_code',
    'home_department_code',
  ];

  private readonly fieldsToUpdate = ['dollars', 'hours', 'shift'];

  async process(
    data: any[],
    fileName: string,
    startDateStr: string | undefined,
    endDateStr: string | undefined,
  ): Promise<void> {
    this.logger.log(`Processing Employee Weekly Report: ${fileName}`);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in the uploaded file.');
      }

      if (!startDateStr || !endDateStr) {
        throw new BadRequestException('Missing startDate or endDate');
      }

      const startDate = this.parseDate(startDateStr);
      const endDate = this.parseDate(endDateStr);

      const headerRowIndex = this.findHeaderRowIndex(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException('Valid header row not found.');
      }

      const headersRaw = Object.keys(data[headerRowIndex]);
      const headersNormalized = headersRaw.map((h) => this.normalizeHeader(h));
      this.validateHeaders(headersNormalized);

      const rows = data.slice(headerRowIndex + 1).filter((row) =>
        Object.values(row).some(
          (val) => val !== null && val !== undefined && val.toString().trim() !== '',
        ),
      );

      const mapped = rows
        .map((row) => this.mapToEntity(row, startDate, endDate))
        .filter((row): row is EmployeeWeekly => row !== null)
        .map((row) => ({
          ...row,
          id: uuidv4(),
        }));

      if (mapped.length === 0) {
        this.logger.warn('No valid data rows to process.');
        return;
      }

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing Employee Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Failed processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process employee weekly report.');
    }
  }

  private normalizeHeader(header: string): string {
    return header.toUpperCase().trim().replace(/\s+/g, ' ');
  }

  private findHeaderRowIndex(data: any[]): number {
    const expected = this.expectedHeaders.map((h) => h.toUpperCase().trim());
    for (let i = 0; i < data.length; i++) {
      const rowHeaders = Object.keys(data[i]).map((h) => this.normalizeHeader(h));
      if (rowHeaders.length === expected.length &&
        rowHeaders.every((val, idx) => val === expected[idx])) {
        return i;
      }
    }
    return -1;
  }

  private validateHeaders(received: string[]) {
    const expected = this.expectedHeaders.map((h) => h.toUpperCase());
    const missing = expected.filter((col) => !received.includes(col));
    const extras = received.filter((col) => !expected.includes(col));

    const issues: string[] = [];
    if (missing.length) issues.push(`Missing: ${missing.join(', ')}`);
    if (extras.length) issues.push(`Unexpected: ${extras.join(', ')}`);

    if (issues.length) throw new BadRequestException(issues.join(' | '));
  }

  private parseDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
  ): EmployeeWeekly | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const get = (key: string): string => {
      const rawKey = Object.keys(raw).find((k) => this.normalizeHeader(k) === key);
      if (!rawKey) return '';
      const value = raw[rawKey];
      return typeof value === 'string' ? value.trim() : String(value ?? '');
    };

    try {
      return {
        startDate,
        endDate,
        legalLastName: get('LEGAL LAST NAME'),
        legalFirstName: get('LEGAL FIRST NAME'),
        businessUnitDescription: get('BUSINESS UNIT DESCRIPTION'),
        businessUnitCode: get('BUSINESS UNIT CODE'),
        homeDepartmentCode: get('HOME DEPARTMENT CODE'),
        payCode: get('PAY CODE'),
        dollars: parseNumber(get('DOLLARS')),
        hours: parseNumber(get('HOURS')),
        fullName: get('FULL NAME'),
        shift: get('SHIFT'),
      } as EmployeeWeekly;
    } catch (error: any) {
      this.logger.warn(`Skipping row due to error: ${error.message}`);
      return null;
    }
  }

  private async insertOrUpdateTransactional(data: (EmployeeWeekly & { id: string })[]) {
    const batchSize = 1000;

    const columns = [
      'id',
      'start_date',
      'end_date',
      'legal_last_name',
      'legal_first_name',
      'business_unit_description',
      'business_unit_code',
      'home_department_code',
      'pay_code',
      'dollars',
      'hours',
      'full_name',
      'shift',
    ];

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map((row) => {
          const rowValues = columns.map((col) => {
            const camelCaseKey = this.snakeToCamel(col) as keyof EmployeeWeekly & keyof typeof row;
            values.push(row[camelCaseKey]);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO employee_weekly (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
            ON CONFLICT (${this.conflictColumns.join(', ')})
            DO UPDATE SET ${this.fieldsToUpdate
            .map((f) => `${f} = EXCLUDED.${f}`)
            .join(', ')};
        `;

        await manager.query(query, values);
        this.logger.log(`Processed rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log(`All ${data.length} records processed successfully.`);
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  }
}
