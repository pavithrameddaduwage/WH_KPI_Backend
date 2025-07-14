import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { HorizonReport } from './entities/horzion_report.entity';

@Injectable()
export class HorzionReportService {
  private readonly logger = new Logger(HorzionReportService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  private readonly expectedHeaders = [
    'Date',
    'Shift',
    'Total Scheduled',
    'Total Present',
    'Late',
    'No Work',
    'No Call/ No Show',
    'Called Out',
    'Early Dismissal',
    'New Starters Today',
    'Terminations',
    'Resignations',
    'Inbound Scheduled',
    'Inbound Completed',
    'Total Cases unloaded',
    'Total Cases closed for the day',
    'Total containers carried over to the next day',
    'Total hours for the day',
    'CPM for the day',
    'Number of SKUs',
    'Near Misses',
    'Incidents',
    'Accidents',
  ];

  private readonly fieldsToUpdate = [
    'shift',
    'total_scheduled',
    'total_present',
    'late',
    'no_work',
    'no_call_no_show',
    'called_out',
    'early_dismissal',
    'new_starters_today',
    'terminations',
    'resignations',
    'inbound_scheduled',
    'inbound_completed',
    'total_cases_unloaded',
    'total_cases_closed_for_the_day',
    'total_containers_carried_over_to_the_next_day',
    'total_hours_for_the_day',
    'cpm_for_the_day',
    'number_of_skus',
    'near_misses',
    'incidents',
    'accidents',
  ];

  async process(data: any[], fileName: string, uploadedDate: string): Promise<void> {
    this.logger.log(`Processing Horizon Report: ${fileName}`);

    try {
      if (!data || !Array.isArray(data) || data.length < 2) {
        throw new BadRequestException('File format is invalid or missing header row.');
      }

      const parsedDate = this.validateAndNormalizeDate(uploadedDate);

      const headerRow = data[1];
     const headerMap = Object.entries(headerRow)
  .filter(([_, val]) => typeof val === 'string' && val.trim() !== '')
  .reduce((acc, [key, val]) => {
    acc[key] = (val as string).replace(/\s+/g, ' ').trim();
    return acc;
  }, {} as Record<string, string>);

      const headers = Object.values(headerMap);
      this.validateHeaders(headers);

      const rows = data.slice(2).filter(row =>
        Object.values(row).some(val =>
          val !== null &&
          val !== undefined &&
          (typeof val === 'string' || typeof val === 'number') &&
          val.toString().trim() !== ''
        )
      );

      if (!rows.length) {
        throw new BadRequestException('No usable data rows found.');
      }

      const mapped = rows
        .map(row => this.mapToEntityWithHeaderMap(row, headerMap, parsedDate))
        .filter((row): row is HorizonReport => row !== null);

      if (mapped.length === 0) return;

      await this.insertOrUpdateTransactional(mapped);
      this.logger.log(`Finished processing Horizon Report: ${fileName}`);
    } catch (error: any) {
      this.logger.error(`Error processing file: ${fileName}`, error);
      throw error instanceof BadRequestException
        ? error
        : new InternalServerErrorException('Failed to process Horizon Report');
    }
  }

  private validateHeaders(receivedHeaders: string[]) {
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();
    const expected = this.expectedHeaders.map(normalize);
    const received = receivedHeaders.map(normalize);

    const missing = expected.filter(e => !received.includes(e));
    if (missing.length) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }
  }

  private validateAndNormalizeDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid uploadedDate format: "${dateStr}". Expected YYYY-MM-DD`);
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }

  private mapToEntityWithHeaderMap(
    raw: Record<string, any>,
    headerMap: Record<string, string>,
    uploadedDate: Date
  ): HorizonReport | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const getVal = (label: string): any => {
      const key = Object.entries(headerMap).find(([, v]) => v === label)?.[0];
      const value = key ? raw[key] : null;
      return typeof value === 'string' ? value.trim() : value ?? '';
    };

    const shift = getVal('Shift');
    if (!shift) return null;

    return {
      uploadedDate,
      shift,
      totalScheduled: parseNumber(getVal('Total Scheduled')),
      totalPresent: parseNumber(getVal('Total Present')),
      late: parseNumber(getVal('Late')),
      noWork: parseNumber(getVal('No Work')),
      noCallNoShow: parseNumber(getVal('No Call/ No Show')),
      calledOut: parseNumber(getVal('Called Out')),
      earlyDismissal: parseNumber(getVal('Early Dismissal')),
      newStartersToday: parseNumber(getVal('New Starters Today')),
      terminations: parseNumber(getVal('Terminations')),
      resignations: parseNumber(getVal('Resignations')),
      inboundScheduled: parseNumber(getVal('Inbound Scheduled')),
      inboundCompleted: parseNumber(getVal('Inbound Completed')),
      totalCasesUnloaded: parseNumber(getVal('Total Cases unloaded')),
      totalCasesClosedForTheDay: parseNumber(getVal('Total Cases closed for the day')),
      totalContainersCarriedOverToNextDay: parseNumber(getVal('Total containers carried over to the next day')),
      totalHoursForTheDay: parseNumber(getVal('Total hours for the day')),
      cpmForTheDay: parseNumber(getVal('CPM for the day')),
      numberOfSkus: parseNumber(getVal('Number of SKUs')),
      nearMisses: parseNumber(getVal('Near Misses')),
      incidents: parseNumber(getVal('Incidents')),
      accidents: parseNumber(getVal('Accidents')),
    };
  }

  private async insertOrUpdateTransactional(data: HorizonReport[]) {
    const batchSize = 1000;
    const columns = ['uploaded_date', ...this.fieldsToUpdate];

    await this.entityManager.transaction(async (manager) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const values: any[] = [];

        const placeholders = chunk.map((row) => {
          const rowValues = columns.map((col) => {
            const camelKey = this.snakeToCamel(col) as keyof HorizonReport;
            values.push(row[camelKey]);
            return `$${values.length}`;
          });
          return `(${rowValues.join(', ')})`;
        });

        const query = `
          INSERT INTO horizon_reports (${columns.join(', ')})
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (uploaded_date, shift)
          DO UPDATE SET ${this.fieldsToUpdate
            .map((f) => `${f} = EXCLUDED.${f}`)
            .join(', ')};
        `;

        await manager.query(query, values);
      }
    });
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
  }
}
