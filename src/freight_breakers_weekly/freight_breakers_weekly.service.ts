import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { FreightBreakersWeekly } from './entities/freight_breakers_weekly.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FreightBreakersWeeklyService {
  private readonly logger = new Logger(FreightBreakersWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Date', 'Employee', 'Job', 'Container', 'QTY',
    'SKUCount', 'Door', 'Type', 'Units', 'Rate', 'Amount',
  ];

  private readonly dbColumnMap: Record<string, string> = {
    'Start Date': 'start_date',
    'End Date': 'end_date',
    'Date': 'date',
    'Employee': 'employee',
    'Job': 'job',
    'Container': 'container',
    'QTY': 'qty',
    'SKUCount': 'sku_count',
    'Door': 'door',
    'Type': 'type',
    'Units': 'units',
    'Rate': 'rate',
    'Amount': 'amount',
    'uploaded_by': 'uploaded_by',
  };

  async process(
    data: any[],
    fileName: string,
    startDateStr: string,
    endDateStr: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing Freight Breakers Weekly Report: ${fileName}`);
    console.log('Uploaded by:', username);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in the uploaded file.');
      }

      const startDate = this.parseDate(startDateStr);
      const endDate = this.parseDate(endDateStr);

      const headerRowIndex = this.findHeaderRowIndex(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException('Valid header row not found.');
      }

      const headers = Object.keys(data[headerRowIndex] || {}).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.slice(headerRowIndex).filter(row =>
        Object.values(row).some(
          val => val !== null && val !== undefined && val.toString().trim() !== '',
        ),
      );

      const mapped = rows
        .map(row => this.mapToEntity(row, startDate, endDate, username))
        .filter((row): row is FreightBreakersWeekly => row !== null)
        .map(row => ({ ...row, id: uuidv4() }));

      if (mapped.length === 0) {
        this.logger.warn('No valid rows to insert.');
        return;
      }

      await this.replaceDataForWeek(mapped, startDate, endDate);
      this.logger.log(`Finished processing Freight Breakers Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process Freight Breakers Weekly Report');
    }
  }

  private parseDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // normalize to midnight
  }

  private findHeaderRowIndex(data: any[]): number {
    const expectedNormalized = this.expectedHeaders.map(h => h.replace(/\s+/g, '').toLowerCase());
    for (let i = 0; i < data.length; i++) {
      const keys = Object.keys(data[i] || {}).map(k => k.replace(/\s+/g, '').toLowerCase());
      if (expectedNormalized.every(h => keys.includes(h))) return i;
    }
    return -1;
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const expected = this.expectedHeaders.map(normalize);
    const received = receivedHeaders.map(normalize);
    const missing = expected.filter(e => !received.includes(e));
    if (missing.length) throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
  }

  private parseIntOrZero(val: unknown): number {
    const n = parseInt((val ?? '').toString().replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  private parseFloatOrZero(val: unknown): number {
    const n = parseFloat((val ?? '').toString().replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private parseDateField(val: any): Date | null {
    if (!val) return null;
    if (typeof val === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const correctedDays = val >= 60 ? val - 1 : val;
      return new Date(excelEpoch.getTime() + correctedDays * msPerDay);
    }
    if (typeof val === 'string') {
      const parts = val.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts.map(Number);
        return new Date(y, m - 1, d);
      }
      const iso = new Date(val);
      if (!isNaN(iso.getTime())) return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
    }
    return null;
  }

  private mapToEntity(
    raw: Record<string, any>,
    startDate: Date,
    endDate: Date,
    uploaded_by: string,
  ): FreightBreakersWeekly | null {
    const parsedDate = this.parseDateField(raw['Date']);
    if (!parsedDate) {
      this.logger.warn(`Skipping row due to invalid Date: ${JSON.stringify(raw)}`);
      return null;
    }

    return {
      id: '',  
      startDate,
      endDate,
      date: parsedDate,
      employee: (raw['Employee'] ?? '').toString().trim(),
      job: (raw['Job'] ?? '').toString().trim(),
      container: (raw['Container'] ?? '').toString().trim(),
      qty: this.parseIntOrZero(raw['QTY']),
      skuCount: this.parseIntOrZero(raw['SKUCount']),
      door: (raw['Door'] ?? '').toString().trim(),
      type: (raw['Type'] ?? '').toString().trim(),
      units: this.parseIntOrZero(raw['Units']),
      rate: this.parseFloatOrZero(raw['Rate']),
      amount: this.parseFloatOrZero(raw['Amount']),
      uploaded_by,
    } as FreightBreakersWeekly;
  }

  private async replaceDataForWeek(
    data: (FreightBreakersWeekly & { id: string })[],
    startDate: Date,
    endDate: Date,
  ) {
    const batchSize = 1000;

    await this.entityManager.transaction(async (manager) => {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      this.logger.log(`Deleting existing records for startDate=${startDateStr} and endDate=${endDateStr}`);

      await manager
        .createQueryBuilder()
        .delete()
        .from(FreightBreakersWeekly)
        .where('start_date::date = :startDate AND end_date::date = :endDate', { startDate: startDateStr, endDate: endDateStr })
        .execute();

      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await manager.save(FreightBreakersWeekly, chunk);
        this.logger.log(`Inserted rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log(`Successfully replaced weekly data for ${startDate} - ${endDate}`);
  }
}
