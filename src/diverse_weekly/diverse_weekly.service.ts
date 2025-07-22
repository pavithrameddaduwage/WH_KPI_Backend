import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
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

  private readonly requiredHeaders = [
    'EMPLOYEE NAME',
    'EMPLOYEE PAYROLL ID',
    'LAST NAME',
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
  ];

  async process(data: any[], fileName: string, reportWeek: string): Promise<void> {
    try {
      if (data.length === 0) {
        throw new BadRequestException('No data provided');
      }

      const { reportStartDate, reportEndDate } = this.parseReportWeek(reportWeek);

      // Detect the actual header row
      const headerIndex = data.findIndex((row: Record<string, any>) => {
        const values = Object.values(row).map((val) =>
          String(val || '').trim().toUpperCase(),
        );
        return this.requiredHeaders.every((header) => values.includes(header));
      });

      if (headerIndex === -1) {
        throw new BadRequestException('Valid header row not found in uploaded file.');
      }

      const headerRow = data[headerIndex];

      // Map original Excel column keys -> normalized header labels
      const keyMapping: Record<string, string> = {};
      for (const key of Object.keys(headerRow)) {
        const label = String(headerRow[key] ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
        if (label) {
          keyMapping[key] = label;
        }
      }

      // Validate required headers exist
      this.validateHeaders(Object.values(keyMapping));

      const rawRows = data.slice(headerIndex + 1);

      // Filter out totals/empty rows
      const filteredRows = rawRows.filter((row) => {
        const firstCell = Object.values(row)[0];
        const upper = String(firstCell || '').trim().toUpperCase();
        return upper && !upper.includes('TOTAL');
      });

      // Normalize keys per row using key mapping
      const structuredRows = filteredRows.map((row) => {
        const normalized: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          const mapped = keyMapping[key];
          if (mapped) {
            normalized[mapped] = row[key];
          }
        }
        return normalized;
      });

      // Convert normalized rows into entity-compatible objects
      const mappedEntities = structuredRows
        .map((row) => this.mapToEntity(row, reportStartDate, reportEndDate))
        .filter((row): row is DiverseWeeklyReport => row !== null);

      if (mappedEntities.length === 0) {
        this.logger.warn('No valid rows to process after filtering.');
        return;
      }

      await this.insertOrUpdateTransactional(mappedEntities);
    } catch (error: any) {
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(
            error.message || 'Failed to process diverse weekly report',
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

  private parseReportWeek(week: string): { reportStartDate: Date; reportEndDate: Date } {
    const pattern = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/;
    const match = week.match(pattern);
    if (!match) {
      throw new BadRequestException(
        `Invalid reportWeek format: "${week}". Expected format: "YYYY-MM-DD to YYYY-MM-DD"`,
      );
    }

    const reportStartDate = new Date(match[1]);
    const reportEndDate = new Date(match[2]);

    if (isNaN(reportStartDate.getTime()) || isNaN(reportEndDate.getTime())) {
      throw new BadRequestException(`Invalid dates in reportWeek: "${week}"`);
    }

    return { reportStartDate, reportEndDate };
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    reportStartDate: Date,
    reportEndDate: Date,
  ): DiverseWeeklyReport | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const cleanKey = key.replace(/\s+/g, ' ').trim().toUpperCase();
      normalized[cleanKey] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    const employeeName = normalized['EMPLOYEE NAME'];
    const payrollId = normalized['EMPLOYEE PAYROLL ID'];

    if (!employeeName || !payrollId) return null;

    return {
      employeePayrollId: payrollId,
      startDate: reportStartDate,
      endDate: reportEndDate,
      employeeName,
      firstName: normalized['FIRST NAME'],
      lastName: normalized['LAST NAME'],
      departmentName: normalized['DEPARTMENT'],
      reg: parseNumber(normalized['REG']),
      ot1: parseNumber(normalized['OT1']),
      total: parseNumber(normalized['TOTAL']),
    };
  }

   private async insertOrUpdateTransactional(data: DiverseWeeklyReport[]) {
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
    ];

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map((row) => {
          const rowValues = columns.map((col) => {
            const camelKey = this.snakeToCamel(col) as keyof DiverseWeeklyReport;
            values.push(row[camelKey]);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO diverse_weekly_reports (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (${this.identifyingFields.join(', ')})
          DO UPDATE SET ${this.fieldsToUpdate
            .map((col) => `${col} = EXCLUDED.${col}`)
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
