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

  private readonly identifyingFields = ['employee_name', 'report_start_date', 'report_end_date'];

  private readonly fieldsToUpdate = [
    'employee_payroll_id',
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
 
      const keyMapping: Record<string, string> = {};
      for (const key of Object.keys(headerRow)) {
        const cleanHeader = String(headerRow[key] ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
        if (cleanHeader) {
          keyMapping[key] = cleanHeader;
        }
      }

 
      const contentRows = data.slice(headerIndex + 1);
 
      const filteredRows: Record<string, any>[] = [];
      for (const row of contentRows) {
        const firstCell = Object.values(row)[0];
        if (typeof firstCell === 'string') {
          const upperFirstCell = firstCell.trim().toUpperCase();
          if (upperFirstCell === '' || upperFirstCell.includes('TOTAL')) {
            break;
          }
        }
        filteredRows.push(row);
      }

    
      const structuredRows = filteredRows.map((row) => {
        const normalizedRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          const cleanKey = keyMapping[key];
          if (cleanKey) {
            normalizedRow[cleanKey] = row[key];
          }
        }
        return normalizedRow;
      });

      this.validateHeaders(Object.values(keyMapping));

      const mapped = structuredRows
        .map((row) => this.mapToEntity(row, reportStartDate, reportEndDate))
        .filter((row): row is DiverseWeeklyReport => row !== null);

      if (mapped.length === 0) {
        this.logger.warn('No valid rows to process after filtering.');
        return;
      }

      await this.insertOrUpdateTransactional(mapped);
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

    const normalizedRaw: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.replace(/\s+/g, ' ').trim().toUpperCase();
      normalizedRaw[normalizedKey] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    const employeeName = normalizedRaw['EMPLOYEE NAME'];
    const payrollId = normalizedRaw['EMPLOYEE PAYROLL ID'];

    if (!employeeName || !payrollId) {
      return null;
    }

    return {
      employeeName,
      reportStartDate,
      reportEndDate,
      employeePayrollId: payrollId,
      firstName: normalizedRaw['FIRST NAME'],
      lastName: normalizedRaw['LAST NAME'],
      departmentName: normalizedRaw['DEPARTMENT NAME'],
      reg: parseNumber(normalizedRaw['REG']),
      ot1: parseNumber(normalizedRaw['OT1']),
      total: parseNumber(normalizedRaw['TOTAL']),
    };
  }

  private async insertOrUpdateTransactional(data: DiverseWeeklyReport[]) {
    const batchSize = 1000;

    const columns = [
      'employee_name',
      'report_start_date',
      'report_end_date',
      'employee_payroll_id',
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

        const placeholders = chunk.map((row: DiverseWeeklyReport) => {
          const rowValues = columns.map((col) => {
            const camelKey = this.snakeToCamel(col) as keyof DiverseWeeklyReport;
            values.push(row[camelKey] as any);
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
      }
    });
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  }
}
