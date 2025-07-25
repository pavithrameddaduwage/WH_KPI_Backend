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
    'Employee Name',
    'Business Unit Description',
    'Business Unit Code',
    'Home Department Code',
    'Worked Department',
    'Pay Code [Timecard]',
    'Dollars',
    'Hours',
    'Shift',
  ];

  // Update this to reflect the new UNIQUE constraint
  private readonly identifyingFields = [
    'uploaded_date',
    'business_unit_code',
    'home_department_code',
    'worked_department',
    'pay_code_timecard',
    'dollars',
    'hours',
    'shift',
  ];

  private readonly fieldsToUpdate = [
    'employee_name',
    'business_unit_description',
  ];

  async process(data: any[], fileName: string, reportDate: string): Promise<void> {
    this.logger.log(`Processing employee report: ${fileName}, rows: ${data.length}`);

    try {
      if (data.length === 0) {
        throw new BadRequestException('No data provided');
      }

      this.validateHeaders(Object.keys(data[0]));

      const mapped = data
        .map((row) => this.mapToEntity(row, reportDate))
        .filter((row): row is EmployeeReport => row !== null);

      await this.insertOrUpdateTransactional(mapped);
    } catch (error: any) {
      this.logger.error(`Error processing file ${fileName}:`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(error.message || 'Failed to process employee report JSON');
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
    return new Date(year, month - 1, day);
  }

  private mapToEntity(raw: Record<string, unknown>, uploadedDate?: string): EmployeeReport | null {
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

    const employeeName = normalizedRaw['Employee Name'];
    const parsedUploadedDate = uploadedDate
      ? this.validateAndNormalizeDate(uploadedDate)
      : new Date();

    return {
      id: undefined, // Let TypeORM generate UUID
      employeeName,
      businessUnitDescription: normalizedRaw['Business Unit Description'],
      businessUnitCode: normalizedRaw['Business Unit Code'],
      homeDepartmentCode: normalizedRaw['Home Department Code'],
      workedDepartment: normalizedRaw['Worked Department'],
      payCodeTimecard: normalizedRaw['Pay Code [Timecard]'],
      dollars: parseNumberOrZero(normalizedRaw['Dollars']),
      hours: parseNumberOrZero(normalizedRaw['Hours']),
      shift: normalizedRaw['Shift'],
      uploadedDate: parsedUploadedDate,
    };
  }

private async insertOrUpdateTransactional(data: EmployeeReport[]) {
  this.logger.log(`Preparing to insert employee report rows: ${data.length}`);

  if (data.length === 0) return;

  const uploadedDate = data[0].uploadedDate;

  await this.entityManager.transaction(async (manager) => {
   
    await manager.delete(EmployeeReport, { uploadedDate });
    this.logger.log(`Deleted existing records for uploaded_date = ${uploadedDate.toISOString().split('T')[0]}`);

 
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const chunk = data.slice(i, i + batchSize);
      await manager.save(EmployeeReport, chunk);
      this.logger.log(`Inserted rows ${i} to ${i + chunk.length - 1}`);
    }
  });

  this.logger.log('Completed insert: duplicates removed by replacing uploaded_date data');
}



  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  }
}
