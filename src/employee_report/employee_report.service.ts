import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EmployeeReport } from './entities/employee_report.entity';

@Injectable()
export class EmployeeReportService {
  private readonly logger = new Logger(EmployeeReportService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

 
  private readonly expectedHeaders = [
    'Business Unit Description',
    'Business Unit Code',
    'Home Department Code',
    'Worked Department',
    'Pay Code [Timecard]',
    'Dollars',
    'Hours',
    'Shift',
  ];

  async process(
    data: any[],
    fileName: string,
    reportDate: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing employee report: ${fileName}, rows: ${data.length}`);

    try {
      if (data.length === 0) {
        throw new BadRequestException('No data provided');
      }

    
      this.validateHeaders(Object.keys(data[0]));

      const mapped = data
        .map((row) => this.mapToEntity(row, reportDate, username))
        .filter((row): row is EmployeeReport => row !== null);

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing employee report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file ${fileName}:`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(
            error.message || 'Failed to process employee report',
          );
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();
    const received = receivedHeaders.map(normalize);
    const expected = this.expectedHeaders.map(normalize);

    const missing = expected.filter((col) => !received.includes(col));
    if (missing.length) {
      throw new BadRequestException(`Missing columns: ${missing.join(', ')}`);
    }

    const extras = received.filter((col) => !expected.includes(col));
    if (extras.length) {
      this.logger.warn(`Ignoring unexpected columns: ${extras.join(', ')}`);
    }
  }

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(
        `Invalid reportDate format: "${dateStr}". Expected YYYY-MM-DD.`,
      );
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    reportDate?: string,
    uploaded_by?: string,
  ): EmployeeReport | null {
    const parseNumberOrZero = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const normalizedRaw: Record<string, string> = {};
    const expectedSet = new Set(
      this.expectedHeaders.map((h) => h.replace(/\s+/g, ' ').trim()),
    );

    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.replace(/\s+/g, ' ').trim();
      if (!expectedSet.has(normalizedKey)) continue; 
      normalizedRaw[normalizedKey] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    try {
      const parsedDate = reportDate
        ? this.validateAndNormalizeDate(reportDate)
        : new Date();

      return {
     
        businessUnitDescription: normalizedRaw['Business Unit Description'],
        businessUnitCode: normalizedRaw['Business Unit Code'],
        homeDepartmentCode: normalizedRaw['Home Department Code'],
        workedDepartment: normalizedRaw['Worked Department'],
        payCodeTimecard: normalizedRaw['Pay Code [Timecard]'],
        dollars: parseNumberOrZero(normalizedRaw['Dollars']),
        hours: parseNumberOrZero(normalizedRaw['Hours']),
        shift: normalizedRaw['Shift'],
        uploadedDate: parsedDate,
        uploaded_by,
      } as EmployeeReport;
    } catch (err: any) {
      this.logger.warn(`Skipping row due to mapping error: ${err.message}`);
      return null;
    }
  }

  private async insertOrUpdateTransactional(data: EmployeeReport[]) {
    this.logger.log(`Preparing to upsert ${data.length} report rows`);

    if (data.length === 0) return;

    const uploadedDate = data[0].uploadedDate;
    await this.entityManager.transaction(async (manager) => {
      await manager.delete(EmployeeReport, { uploadedDate });
      this.logger.log(
        `Deleted existing records for uploaded_date = ${uploadedDate
          .toISOString()
          .split('T')[0]}`,
      );

      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await manager.save(EmployeeReport, chunk);
        this.logger.log(`Inserted rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log('Upsert complete');
  }
}
