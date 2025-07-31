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
    'BUSINESS UNIT DESCRIPTION',
    'BUSINESS UNIT CODE',
    'HOME DEPARTMENT CODE',
    'PAY CODE',
    'DOLLARS',
    'HOURS',
    'SHIFT',
  ];

  async process(
    data: any[],
    fileName: string,
    startDateStr: string | undefined,
    endDateStr: string | undefined,
    username: string,
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
        .map((row) => this.mapToEntity(row, startDate, endDate, username))
        .filter((row): row is EmployeeWeekly => row !== null)
        .map((row) => ({
          ...row,
          id: uuidv4(),
        }));

      if (mapped.length === 0) {
        this.logger.warn('No valid data rows to process.');
        return;
      }

      await this.replaceDataForWeek(mapped, startDate, endDate);
      this.logger.log(`Finished processing Employee Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Failed processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process employee weekly report.');
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
      if (matchCount === expected.length) {
        return i;
      }
    }
    return -1;
  }

  private validateHeaders(received: string[]) {
    const expected = this.expectedHeaders.map((h) => h.toUpperCase());
    const missing = expected.filter((col) => !received.includes(col));

    if (missing.length) {
      throw new BadRequestException(`Missing columns: ${missing.join(', ')}`);
    }
  }

  private parseDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // Removes time, midnight
  }

  private mapToEntity(
    raw: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
    uploaded_by: string
  ): EmployeeWeekly | null {
    const parseNumber = (val: unknown): number => {
      if (typeof val === 'string') {
        val = val.replace(/[$,]/g, '').trim();
      }
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
        businessUnitDescription: get('BUSINESS UNIT DESCRIPTION'),
        businessUnitCode: get('BUSINESS UNIT CODE'),
        homeDepartmentCode: get('HOME DEPARTMENT CODE'),
        payCode: get('PAY CODE'),
        dollars: parseNumber(get('DOLLARS')),
        hours: parseNumber(get('HOURS')),
        shift: get('SHIFT'),
        uploaded_by,
      } as EmployeeWeekly;
    } catch (error: any) {
      this.logger.warn(`Skipping row due to error: ${error.message}`);
      return null;
    }
  }

  private async replaceDataForWeek(
    data: (EmployeeWeekly & { id: string })[],
    startDate: Date,
    endDate: Date,
  ) {
    const batchSize = 1000;

    await this.entityManager.transaction(async (manager) => {
      this.logger.log(`Deleting existing records for startDate=${startDate.toISOString().split('T')[0]} and endDate=${endDate.toISOString().split('T')[0]}`);

      const existing = await manager.find(EmployeeWeekly, { where: { startDate, endDate } });
      this.logger.log(`Found ${existing.length} existing records.`);

      await manager
        .createQueryBuilder()
        .delete()
        .from(EmployeeWeekly)
        .where('start_date = :startDate AND end_date = :endDate', { startDate, endDate })
        .execute();

      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await manager.save(EmployeeWeekly, chunk);
        this.logger.log(`Inserted weekly rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log(`Successfully replaced weekly data for ${startDate.toISOString()} - ${endDate.toISOString()}`);
  }
}
