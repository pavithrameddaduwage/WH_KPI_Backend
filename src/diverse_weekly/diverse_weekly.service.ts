import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    'FIRST NAME',
    'LAST NAME',
    'DEPARTMENT NAME',
    'REG',
    'OT1',
    'TOTAL',
  ];

  private readonly optionalHeaders = ['BILL RATE'];

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

    if (!data || data.length === 0) {
      throw new BadRequestException('No data provided');
    }

    const headerRowIndex = this.findHeaderRowIndex(data);
    if (headerRowIndex === -1) {
      throw new BadRequestException('Valid header row not found in uploaded file.');
    }

    const headerRow = data[headerRowIndex];
    const headerKeys = Object.keys(headerRow).map(h => h.trim().toUpperCase());
    this.validateHeaders(headerKeys);

    let dataRows = data
      .slice(headerRowIndex + 1)
      .filter(row =>
        Object.values(row).some(
          val => val !== null && val !== undefined && val.toString().trim() !== '',
        ),
      )
      .map(row => {
        const normalized: Record<string, any> = {};
        headerKeys.forEach((header, idx) => {
          const keyAtIndex = Object.keys(row)[idx];
          normalized[header] = row[keyAtIndex];
        });
        return normalized;
      });

   dataRows = dataRows.filter(row => {
  const payrollId = (row['EMPLOYEE PAYROLL ID'] ?? '').toString().toUpperCase();
  const employeeName = (row['EMPLOYEE NAME'] ?? '').toString().toUpperCase();
  return payrollId !== 'TOTAL' && employeeName !== 'TOTAL';
});


    if (dataRows.length === 0) {
      throw new BadRequestException('No data rows found after header.');
    }

    const startDate = this.parseDate(startDateStr);
    const endDate = this.parseDate(endDateStr);

    const mapped = dataRows
      .map(row => this.mapToEntity(row, startDate, endDate, username, headerKeys))
      .filter((row): row is DiverseWeeklyReport => row !== null);

    const merged = this.mergeDuplicates(mapped);

    await this.insertOrUpdateTransactional(merged);
  }

  private findHeaderRowIndex(data: any[]): number {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim().toUpperCase();
    const required = this.requiredHeaders.map(normalize);

    for (let i = 0; i < data.length; i++) {
      const keys = Object.keys(data[i]).map(normalize);
      if (required.every(h => keys.includes(h))) return i;
    }
    return -1;
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim().toUpperCase();
    const received = receivedHeaders.map(normalize);
    const required = this.requiredHeaders.map(normalize);

    const missing = required.filter(col => !received.includes(col));
    if (missing.length) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const optionalMissing = this.optionalHeaders.filter(col => !received.includes(col));
    if (optionalMissing.length) {
      this.logger.warn(`Optional columns missing: ${optionalMissing.join(', ')}`);
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
    uploaded_by: string,
    headers: string[],
  ): DiverseWeeklyReport | null {
    const parseNumber = (val: unknown): number => {
      if (typeof val === 'string') val = val.replace(/[$,]/g, '').trim();
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const get = (key: string): string => {
      const value = raw[key];
      return typeof value === 'string' ? value.trim() : String(value ?? '');
    };

    try {
      const entity = new DiverseWeeklyReport();
      entity.employeePayrollId = get('EMPLOYEE PAYROLL ID') || '0';
      if (!entity.employeePayrollId) {
        this.logger.warn(`Skipping row with empty EMPLOYEE PAYROLL ID: ${JSON.stringify(raw)}`);
        return null;
      }

      entity.startDate = startDate;
      entity.endDate = endDate;
      entity.employeeName = get('EMPLOYEE NAME');
      entity.firstName = get('FIRST NAME');
      entity.lastName = get('LAST NAME');
      entity.departmentName = get('DEPARTMENT NAME');
      entity.reg = parseNumber(get('REG'));
      entity.ot1 = parseNumber(get('OT1'));
      entity.total = parseNumber(get('TOTAL'));
      entity.billRate = headers.includes('BILL RATE') ? parseNumber(get('BILL RATE')) : 0;
      entity.uploaded_by = uploaded_by;

      return entity;
    } catch (error: any) {
      this.logger.warn(`Skipping row due to error: ${error.message}`);
      return null;
    }
  }

  private mergeDuplicates(rows: DiverseWeeklyReport[]): DiverseWeeklyReport[] {
    const map = new Map<string, DiverseWeeklyReport>();

    for (const row of rows) {
      const key = `${row.employeePayrollId}-${row.startDate.toISOString()}-${row.endDate.toISOString()}`;
      if (!map.has(key)) {
        map.set(key, row);
      } else {
        const existing = map.get(key)!;
        existing.reg += row.reg;
        existing.ot1 += row.ot1;
        existing.total += row.total;

        if (row.billRate && row.billRate > 0) existing.billRate = row.billRate;

        existing.employeeName = row.employeeName || existing.employeeName;
        existing.firstName = row.firstName || existing.firstName;
        existing.lastName = row.lastName || existing.lastName;
        existing.departmentName = row.departmentName || existing.departmentName;
        existing.uploaded_by = row.uploaded_by;
      }
    }

    return Array.from(map.values());
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
            .map(f => `${f} = EXCLUDED.${f}`)
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
