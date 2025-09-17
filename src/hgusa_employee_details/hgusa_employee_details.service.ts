import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { HgusaEmployeeDetail } from './entities/hgusa_employee_detail.entity';

@Injectable()
export class HgusaEmployeeDetailsService {
  private readonly logger = new Logger(HgusaEmployeeDetailsService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = ['Business Unit Description', 'Full Name'];

  async process(
    data: any[],
    fileName: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing HGUSA Employee Details: ${fileName}`);
    console.log('Uploaded by:', username);

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('No data found in the uploaded file.');
      }

      const headerRowIndex = this.findHeaderRowIndex(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException('Valid header row not found.');
      }

      const headers = Object.keys(data[headerRowIndex] || {}).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.slice(headerRowIndex).filter(row =>
        Object.values(row).some(val => val !== null && val !== undefined && val.toString().trim() !== ''),
      );

      const mapped = rows
        .map(row => this.mapToEntity(row, username))
        .filter((row): row is HgusaEmployeeDetail => row !== null);

      if (mapped.length === 0) {
        this.logger.warn('No valid rows to insert.');
        return;
      }

      await this.replaceData(mapped);
      this.logger.log(`Finished processing HGUSA Employee Details: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process HGUSA Employee Details');
    }
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

  private mapToEntity(
    raw: Record<string, any>,
    uploaded_by: string,
  ): HgusaEmployeeDetail | null {
    const businessUnit = (raw['Business Unit Description'] ?? '').toString().trim();
    const fullName = (raw['Full Name'] ?? '').toString().trim();

    if (!businessUnit || !fullName) {
      this.logger.warn(`Skipping row due to missing primary key data: ${JSON.stringify(raw)}`);
      return null;
    }

    return {
      businessUnit,
      fullName,
    } as HgusaEmployeeDetail;
  }

  private async replaceData(data: HgusaEmployeeDetail[]) {
    await this.entityManager.transaction(async (manager) => {
      // filter out invalid PK rows
      const validRows = data.filter(row => {
        if (!row.businessUnit || !row.fullName) {
          this.logger.warn(`Skipping row with missing primary key: ${JSON.stringify(row)}`);
          return false;
        }
        return true;
      });

      if (validRows.length === 0) {
        this.logger.log(`No valid rows to insert.`);
        return;
      }

      // remove duplicates in the file itself
      const seen = new Set<string>();
      const uniqueRows = validRows.filter(row => {
        const key = `${row.businessUnit}||${row.fullName}`;
        if (seen.has(key)) {
          this.logger.warn(`Skipping duplicate row in file: ${JSON.stringify(row)}`);
          return false;
        }
        seen.add(key);
        return true;
      });

      // delete all old records before inserting
      await manager
        .createQueryBuilder()
        .delete()
        .from(HgusaEmployeeDetail)
        .execute();

      // insert new rows
      await manager.save(HgusaEmployeeDetail, uniqueRows);
      this.logger.log(`Inserted ${uniqueRows.length} rows.`);
    });
  }
}
