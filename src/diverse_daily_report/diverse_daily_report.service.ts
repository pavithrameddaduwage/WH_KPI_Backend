import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DiverseDailyReport } from './entities/diverse_daily_report.entity';

@Injectable()
export class DiverseDailyReportService {
  private readonly logger = new Logger(DiverseDailyReportService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly requiredHeaders = [
    'EMPLOYEE NAME',
    'EMPLOYEE PAYROLL ID',
    'LAST NAME',
  ];

  
  async process(
    data: any[],
    fileName: string,
    reportDate: string,
    uploaded_by: string,
  ): Promise<void> {
    this.logger.log(`Processing Diverse Staffing Report: ${fileName}`);

    try {
      if (!data.length) throw new BadRequestException('No data provided');

      const parsedReportDate = this.validateAndNormalizeDate(reportDate);

   
      const isHeaderRow = (row: Record<string, any>): boolean => {
        const values = Object.values(row).map((v) =>
          String(v || '').trim().toUpperCase(),
        );
        return this.requiredHeaders.every((header) => values.includes(header));
      };

      const headerIndex = data.findIndex(isHeaderRow);
      if (headerIndex === -1)
        throw new BadRequestException('Header row not found in uploaded file.');

      const headerRow = data[headerIndex];
      const headers = Object.values(headerRow).map((val) =>
        String(val).replace(/\s+/g, ' ').trim().toUpperCase(),
      );

      this.validateHeaders(headers);

      const contentRows = data.slice(headerIndex + 1);
      const structuredRows = contentRows.map((row) => {
        const mapped: Record<string, any> = {};
        const values = Object.values(row);
        headers.forEach((key, idx) => (mapped[key] = values[idx]));
        return mapped;
      });

      const mapped = structuredRows
        .map((r) => this.mapToEntity(r, parsedReportDate, uploaded_by))
        .filter((r): r is DiverseDailyReport => r !== null);

      if (!mapped.length) {
        this.logger.warn('No valid data rows found.');
        return;
      }

      await this.smartInsertOrUpdate(mapped);
      this.logger.log(` Successfully processed: ${fileName}`);
    } catch (error: any) {
      this.logger.error(` Error processing report: ${error.message}`);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException(error.message);
    }
  }


  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();
    const received = receivedHeaders.map(normalize);
    const required = this.requiredHeaders.map(normalize);
    const missing = required.filter((c) => !received.includes(c));
    if (missing.length)
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}`,
      );
  }


  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
      throw new BadRequestException(
        `Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`,
      );
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }


  private mapToEntity(
    raw: Record<string, unknown>,
    uploadedDate: Date,
    uploaded_by: string,
  ): DiverseDailyReport | null {
    const num = (v: unknown) => (isNaN(Number(v)) ? 0 : Number(v));
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const k = key.replace(/\s+/g, ' ').trim().toUpperCase();
      normalized[k] =
        typeof value === 'string' ? value.trim() : String(value ?? '');
    }

    const employeeName = normalized['EMPLOYEE NAME']?.trim().toUpperCase();
    if (
      !employeeName ||
      ['TOTAL', 'GRAND TOTAL', 'SUMMARY'].includes(employeeName)
    ) {
      this.logger.warn(`Skipping summary row: ${normalized['EMPLOYEE NAME']}`);
      return null;
    }

    const payrollId = normalized['EMPLOYEE PAYROLL ID'] || '0';

    return {
      id: undefined, 
      uploadedDate,
      employeePayrollId: payrollId,
      employeeName: normalized['EMPLOYEE NAME'],
      firstName: normalized['FIRST NAME'],
      lastName: normalized['LAST NAME'],
      payRate: num(normalized['PAY RATE']),
      billRate: num(normalized['BILL RATE']),
      departmentName: normalized['DEPARTMENT NAME'],
      reg: num(normalized['REG']),
      ot1: num(normalized['OT1']),
      ot2: num(normalized['OT2']),
      vac: num(normalized['VAC']),
      hol: num(normalized['HOL']),
      sic: num(normalized['SIC']),
      oth: num(normalized['OTH']),
      total: num(normalized['TOTAL']),
      usdCost: num(normalized['USD COST']),
      uploaded_by,
      date: null,
    } as DiverseDailyReport;
  }

  /** -------------------- SMART UPSERT LOGIC -------------------- **/
  private async smartInsertOrUpdate(data: DiverseDailyReport[]) {
    const batchSize = 300;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const normalizeDate = (val: any): string => {
      if (!val) return 'invalid';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (typeof val === 'string') return val.split('T')[0];
      return 'invalid';
    };

    const eqNum = (a: any, b: any, eps = 1e-6) => {
      const A = Number(a) || 0;
      const B = Number(b) || 0;
      return Math.abs(A - B) < eps;
    };

    const sameCoreSignature = (a: DiverseDailyReport, b: DiverseDailyReport) =>
      a.departmentName === b.departmentName &&
      eqNum(a.reg, b.reg) &&
      eqNum(a.ot1, b.ot1) &&
      eqNum(a.total, b.total) &&
      eqNum(a.billRate, b.billRate);

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);

        for (const record of chunk) {
          const ud = normalizeDate(record.uploadedDate);

          // Fetch all rows with same employee/date
          const existingRows = await manager
            .createQueryBuilder(DiverseDailyReport, 'r')
            .where('r.employee_payroll_id = :emp', {
              emp: record.employeePayrollId,
            })
            .andWhere('r.uploaded_date = :ud::date', { ud })
            .getMany();

          // 1) Skip if exact duplicate exists
          const exactDuplicate = existingRows.find((r) =>
            this.areRecordsIdentical(r, record),
          );
          if (exactDuplicate) {
            skipped++;
            continue;
          }

          // 2) If a row exists with the SAME core signature → UPDATE (e.g., name fix)
          const signatureMatch = existingRows.find((r) =>
            sameCoreSignature(r, record),
          );

          if (signatureMatch) {
            await manager
              .createQueryBuilder()
              .update(DiverseDailyReport)
              .set({
                employeeName: record.employeeName,
                firstName: record.firstName,
                lastName: record.lastName,
                payRate: record.payRate,
                billRate: record.billRate,
                departmentName: record.departmentName,
                reg: record.reg,
                ot1: record.ot1,
                ot2: record.ot2,
                vac: record.vac,
                hol: record.hol,
                sic: record.sic,
                oth: record.oth,
                total: record.total,
                usdCost: record.usdCost,
                uploaded_by: record.uploaded_by,
              })
              .where('id = :id', { id: signatureMatch.id })
              .execute();
            updated++;
            continue;
          }

          // 3) Otherwise, it's a distinct entry for that day/employee → INSERT
          await manager.insert(DiverseDailyReport, record);
          inserted++;
        }
      }
    });

    this.logger.log(
      `✅ Upsert Summary — Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`,
    );
  }

  /** -------------------- COMPARE RECORD CONTENT -------------------- **/
  private areRecordsIdentical(
    a: DiverseDailyReport,
    b: DiverseDailyReport,
  ): boolean {
    const normalizeDate = (val: any): string => {
      if (!val) return 'invalid';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (typeof val === 'string') return val.split('T')[0];
      return 'invalid';
    };

    const eqNum = (x: any, y: any, eps = 1e-6) => {
      const X = Number(x) || 0;
      const Y = Number(y) || 0;
      return Math.abs(X - Y) < eps;
    };

    return (
      a.employeePayrollId === b.employeePayrollId &&
      normalizeDate(a.uploadedDate) === normalizeDate(b.uploadedDate) &&
      a.employeeName === b.employeeName &&
      a.firstName === b.firstName &&
      a.lastName === b.lastName &&
      a.departmentName === b.departmentName &&
      eqNum(a.payRate, b.payRate) &&
      eqNum(a.billRate, b.billRate) &&
      eqNum(a.reg, b.reg) &&
      eqNum(a.ot1, b.ot1) &&
      eqNum(a.ot2, b.ot2) &&
      eqNum(a.vac, b.vac) &&
      eqNum(a.hol, b.hol) &&
      eqNum(a.sic, b.sic) &&
      eqNum(a.oth, b.oth) &&
      eqNum(a.total, b.total) &&
      eqNum(a.usdCost, b.usdCost)
    );
  }
}
