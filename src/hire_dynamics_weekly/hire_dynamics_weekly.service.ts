import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { HireDynamicsWeekly } from './entities/hire_dynamics_weekly.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HireDynamicsWeeklyService {
  private readonly logger = new Logger(HireDynamicsWeeklyService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Employee',
    'Department  (G3)',
    'Work Date',
    'Approval Status',
    'TIME.DCOMP',
    'Date',
    'Paycode',
    'IN',
    'In Ex',
    'OUT',
    'Out Ex',
    'Reason',
    'Department',
    'Sh/Pay Ex',
    'Reg Hrs',
    'OT',
    'DT',
    'Daily Total',
    'COUNT',
  ];

  private readonly dbColumnMap: Record<string, string> = {
    'Employee': 'employee_id',
    'Start Date': 'start_date',
    'End Date': 'end_date',
    'Department  (G3)': 'department_g3',
    'Work Date': 'work_date',
    'Approval Status': 'approval_status',
    'TIME.DCOMP': 'time_dcomp',
    'Date': 'date',
    'Paycode': 'paycode',
    'IN': 'in_time',
    'In Ex': 'in_ex',
    'OUT': 'out_time',
    'Out Ex': 'out_ex',
    'Reason': 'reason',
    'Department': 'department',
    'Sh/Pay Ex': 'shift_pay_ex',
    'Reg Hrs': 'reg_hrs',
    'OT': 'ot',
    'DT': 'dt',
    'Daily Total': 'daily_total',
    'COUNT': 'count',
    'uploaded_by': 'uploaded_by',
  };

  async process(
    data: any[],
    fileName: string,
    startDateStr: string,
    endDateStr: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Processing Hire Dynamics Weekly Report: ${fileName}`);

    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('File format is invalid or no data provided.');
      }

      const startDate = this.validateAndNormalizeDate(startDateStr);
      const endDate = this.validateAndNormalizeDate(endDateStr);

      const headerRow = data.find(row =>
        Object.keys(row).some(h => h.trim() !== '')
      );
      if (!headerRow) throw new BadRequestException('Could not determine header row.');

      const headers = Object.keys(headerRow).filter(h => h.trim() !== '');
      this.validateHeaders(headers);

      const rows = data.filter(row =>
        Object.values(row).some(val =>
          val !== null &&
          val !== undefined &&
          (typeof val === 'string' || typeof val === 'number') &&
          val.toString().trim() !== ''
        )
      );

      if (!rows.length) throw new BadRequestException('No usable data rows found.');

      const mapped = rows
        .map(row => this.mapToEntity(row, startDate, endDate, username))
        .filter((row): row is HireDynamicsWeekly => row !== null)
        .map(row => ({ ...row, id: uuidv4() }));

      if (!mapped.length) return;

      await this.replaceDataForWeek(mapped, startDate, endDate);
      this.logger.log(`Finished processing Hire Dynamics Weekly Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process Hire Dynamics Weekly Report');
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const expected = this.expectedHeaders.map(normalize);
    const received = receivedHeaders.map(normalize);

    const missing = expected.filter(e => !received.includes(e));
    if (missing.length) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }
  }

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD`);
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12); // normalized to noon
  }

  private mapToEntity(
    raw: Record<string, any>,
    startDate: Date,
    endDate: Date,
    uploaded_by: string,
  ): HireDynamicsWeekly | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    if (!raw['Employee']) return null;

    const record: any = {
      'Employee': raw['Employee']?.toString().trim(),
      'Start Date': startDate,
      'End Date': endDate,
      'uploaded_by': uploaded_by,
    };

    for (const header of this.expectedHeaders) {
      const value = raw[header];
      record[header] = ['Reg Hrs', 'OT', 'DT', 'Daily Total', 'COUNT'].includes(header)
        ? parseNumber(value)
        : (typeof value === 'string' ? value.trim() : value);
    }

    return record as HireDynamicsWeekly;
  }

  private async replaceDataForWeek(
    data: (HireDynamicsWeekly & { id: string })[],
    startDate: Date,
    endDate: Date,
  ) {
    const batchSize = 1000;
    const dbColumns = Object.values(this.dbColumnMap);

    await this.entityManager.transaction(async (manager) => {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      this.logger.log(`Deleting existing records for startDate=${startDateStr} and endDate=${endDateStr}`);

      await manager
        .createQueryBuilder()
        .delete()
        .from(HireDynamicsWeekly)
        .where('start_date::date = :startDate AND end_date::date = :endDate', { startDate: startDateStr, endDate: endDateStr })
        .execute();

      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        await manager.save(HireDynamicsWeekly, chunk);
        this.logger.log(`Inserted rows ${i + 1}-${i + chunk.length}`);
      }
    });

    this.logger.log(`Successfully replaced data for ${startDate.toISOString()} - ${endDate.toISOString()}`);
  }
}
