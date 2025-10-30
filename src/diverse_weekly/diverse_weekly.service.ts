import {
  BadRequestException,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DiverseWeeklyReport } from './entities/diverse_weekly.entity';
import { v4 as uuidv4 } from 'uuid';

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

 
  async process(
    data: any[],
    fileName: string,
    startDateStr: string | undefined,
    endDateStr: string | undefined,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing Diverse Weekly Report: ${fileName}`);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in uploaded file.');
      }

      if (!startDateStr || !endDateStr) {
        throw new BadRequestException('Missing startDate or endDate.');
      }

      const startDate = this.parseDate(startDateStr);
      const endDate = this.parseDate(endDateStr);

    
      const headerRowIndex = this.findHeaderRowIndex(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException('Valid header row not found in uploaded file.');
      }

      const headerRow = data[headerRowIndex];
      const headersRaw = Object.keys(headerRow);
      const headersNormalized = headersRaw.map((h) => this.normalizeHeader(h));
      this.validateHeaders(headersNormalized);

      
      const dataRows = data.slice(headerRowIndex).filter((row) =>
        Object.values(row).some(
          (val) => val !== null && val !== undefined && val.toString().trim() !== '',
        ),
      );

     
      const mapped: DiverseWeeklyReport[] = dataRows
        .map((row) => {
          const entity = this.mapToEntity(row, startDate, endDate, username);
          if (!entity) return null;
          entity.id = uuidv4(); // Assign unique ID
          return entity;
        })
        .filter((r): r is DiverseWeeklyReport => r !== null);

      if (mapped.length === 0) {
        this.logger.warn('No valid data rows to process.');
        return;
      }

      await this.replaceDataForWeek(mapped, startDate, endDate);
      this.logger.log(` Successfully processed: ${fileName}`);
    } catch (error: any) {
      this.logger.error(` Failed to process ${fileName}: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process diverse weekly report.');
    }
  }


  private normalizeHeader(header: string): string {
    return header
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\[.*?\]/g, '')
      .trim();
  }

  private findHeaderRowIndex(data: any[]): number {
    const expected = this.expectedHeaders.map((h) => h.toUpperCase().trim());
    for (let i = 0; i < data.length; i++) {
      const rowHeaders = Object.keys(data[i]).map((h) => this.normalizeHeader(h));
      const matchCount = expected.filter((h) => rowHeaders.includes(h)).length;
      if (matchCount >= 5) return i; // allow flexibility
    }
    return -1;
  }

  private validateHeaders(received: string[]) {
    const expected = this.expectedHeaders.map((h) => h.toUpperCase());
    const missing = expected.filter((col) => !received.includes(col));
    if (missing.length) {
      this.logger.warn(`Missing optional headers: ${missing.join(', ')}`);
    }
  }

  private parseDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // midnight
  }


  private mapToEntity(
    raw: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
    uploaded_by: string,
  ): DiverseWeeklyReport | null {
    const parseNumber = (val: unknown): number => {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'string') val = val.replace(/[$,]/g, '').trim();
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
      const employeeName = get('EMPLOYEE NAME');
      if (!employeeName || ['TOTAL', 'SUMMARY', 'GRAND TOTAL'].includes(employeeName.toUpperCase())) {
        return null;
      }

      const entity = new DiverseWeeklyReport();

      entity.employeePayrollId = get('EMPLOYEE PAYROLL ID') || '0'; // Assign 0 if empty
      entity.startDate = startDate;
      entity.endDate = endDate;
      entity.employeeName = employeeName;
      entity.firstName = get('FIRST NAME');
      entity.lastName = get('LAST NAME');
      entity.departmentName = get('DEPARTMENT NAME');
      entity.reg = parseNumber(get('REG'));
      entity.ot1 = parseNumber(get('OT1'));
      entity.total = parseNumber(get('TOTAL'));
      entity.billRate = parseNumber(get('BILL RATE'));
      entity.uploaded_by = uploaded_by;

 
      if (
        !entity.employeeName &&
        !entity.departmentName &&
        entity.reg === 0 &&
        entity.ot1 === 0 &&
        entity.total === 0
      ) {
        return null;
      }

      return entity;
    } catch (error: any) {
      this.logger.warn(`Skipping row due to error: ${error.message}`);
      return null;
    }
  }


  private async replaceDataForWeek(
    data: DiverseWeeklyReport[],
    startDate: Date,
    endDate: Date,
  ) {
    const batchSize = 1000;

    await this.entityManager.transaction(async (manager) => {
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      this.logger.log(` Deleting existing records for startDate=${start}, endDate=${end}`);

      await manager
        .createQueryBuilder()
        .delete()
        .from(DiverseWeeklyReport)
        .where('start_date = :startDate AND end_date = :endDate', { startDate, endDate })
        .execute();

      this.logger.log(`Inserting ${data.length} rows...`);

      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await manager.save(DiverseWeeklyReport, chunk);
        this.logger.log(`Inserted rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log(
      `Successfully replaced weekly data for ${startDate.toISOString()} - ${endDate.toISOString()}`,
    );
  }
}
