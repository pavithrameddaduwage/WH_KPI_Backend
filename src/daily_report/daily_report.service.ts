import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DailyReport } from './entities/daily_report.entity';

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Employee',
    'Shift (G4)',
    'Department (G3)',
    'Date',
    'Reg. Hrs',
    'Reg. Pay',
    'Reg Rate',
    'OT',
    'OT1 Pay',
    'Total Hrs',
    'Total Pay',
  ];

  private readonly identifyingFields = ['uploaded_date', 'employee'];

  private readonly fieldsToUpdate = [
    'shift_g4',
    'department_g3',
    'date',
    'reg_hrs',
    'reg_pay',
    'reg_rate',
    'ot',
    'ot_1_pay',
    'total_hrs',
    'total_pay',
    'uploaded_by',
  ];

  private readonly chunkBuffer = new Map<string, DailyReport[]>();

  async processChunk(
    rows: any[],
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    fileType: string,
    isLastChunk: boolean,
    reportDate?: string,
    uploaded_by?: string,
  ): Promise<void> {
    this.logger.log(
      `processChunk called - fileName: ${fileName}, chunkIndex: ${chunkIndex}, totalChunks: ${totalChunks}, isLastChunk: ${isLastChunk}`,
    );

    try {
      if (chunkIndex === 0 && rows.length > 0) {
        this.validateHeaders(Object.keys(rows[0]));
      }

      const mapped = rows
        .map((row) => this.mapToEntity(row, reportDate, uploaded_by))
        .filter((row): row is DailyReport => row !== null);

      if (!this.chunkBuffer.has(fileName)) {
        this.chunkBuffer.set(fileName, []);
      }

      this.chunkBuffer.get(fileName)!.push(...mapped);

      if (isLastChunk) {
        const allRows = this.chunkBuffer.get(fileName);
        if (!allRows) {
          throw new InternalServerErrorException('Missing buffered data.');
        }

        await this.insertOrUpdateTransactional(allRows);
        this.chunkBuffer.delete(fileName);
      }
    } catch (error: any) {
      this.chunkBuffer.delete(fileName);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(
            error.message || 'Daily report chunk processing failed',
          );
    }
  }

  async process(
    data: any[],
    fileName: string,
    reportDate: string,
    uploaded_by: string,
  ): Promise<void> {
    this.logger.log(`Processing full JSON file: ${fileName}, rows: ${data.length}`);

    try {
      if (data.length === 0) {
        throw new BadRequestException('No data provided');
      }

      this.validateHeaders(Object.keys(data[0]));

      const mapped = data
        .map((row) => this.mapToEntity(row, reportDate, uploaded_by))
        .filter((row): row is DailyReport => row !== null);

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing JSON file: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file ${fileName}:`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(
            error.message || 'Failed to process daily report JSON',
          );
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
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

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(
        `Invalid uploadedDate format: "${dateStr}". Expected format: YYYY-MM-DD.`,
      );
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    uploadedDate?: string,
    uploaded_by?: string,
  ): DailyReport | null {
    const parseNumberOrZero = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const normalizedRaw: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.replace(/\s+/g, ' ').trim();
      normalizedRaw[normalizedKey] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    const employee = normalizedRaw['Employee'];
    const dateStr = normalizedRaw['Date'];

    if (!employee || !dateStr) {
      this.logger.warn(`Skipping row due to missing employee or date: ${JSON.stringify(raw)}`);
      return null;
    }

    const parsedDate = new Date(dateStr);
    const parsedUploadedDate = uploadedDate
      ? this.validateAndNormalizeDate(uploadedDate)
      : new Date();

    return {
      employee,
      shiftG4: normalizedRaw['Shift (G4)'],
      departmentG3: normalizedRaw['Department (G3)'],
      date: parsedDate,
      regHrs: parseNumberOrZero(normalizedRaw['Reg. Hrs']),
      regPay: parseNumberOrZero(normalizedRaw['Reg. Pay']),
      regRate: parseNumberOrZero(normalizedRaw['Reg Rate']),
      ot: parseNumberOrZero(normalizedRaw['OT']),
      ot1Pay: parseNumberOrZero(normalizedRaw['OT1 Pay']),
      totalHrs: parseNumberOrZero(normalizedRaw['Total Hrs']),
      totalPay: parseNumberOrZero(normalizedRaw['Total Pay']),
      uploadedDate: parsedUploadedDate,
      uploaded_by,

    };
  }

  private async insertOrUpdateTransactional(data: DailyReport[]) {
  this.logger.log(`Starting insertOrUpdateTransactional for ${data.length} rows`);
  const batchSize = 1000;

  const columns = [
    'employee',
    'shift_g4',
    'department_g3',
    'date',
    'reg_hrs',
    'reg_pay',
    'reg_rate',
    'ot',
    'ot_1_pay',
    'total_hrs',
    'total_pay',
    'uploaded_date',
    'uploaded_by',
  ];

  await this.entityManager.transaction(async (manager) => {
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      const values: any[] = [];

      const placeholders = chunk.map((row) => {
        const rowValues = columns.map((col) => {
          const camelKey = this.snakeToCamel(col);
          const value = (row as any)[col] ?? (row as any)[camelKey];
          values.push(value);
          return `$${values.length}`;
        });
        return `(${rowValues.join(', ')})`;
      });

      const query = `
        INSERT INTO daily_reports (${columns.join(', ')})
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
