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
    'Total Scheduled Lumpers',
    'Total Present Lumpers',
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
    'Total Cases Unloaded',
    'Total Cases Closed For The Day',
    'Total Containers Carried Over To The Next Day',
    'Total Hours For The Day',
    'CPM For The Day',
    'Number Of SKUs',
    'Near Misses',
    'Incidents',
    'Accidents',
  ];

  private readonly fieldsToUpdate = [
    'shift',
    'total_scheduled_lumpers',
    'total_present_lumpers',
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
    'uploaded_by',
  ];

  async process(
    data: any[],
    fileName: string,
    uploadedDate: string,
    uploaded_by: string,
  ): Promise<void> {
    this.logger.log(`Processing Horizon Report: ${fileName}`);

    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new BadRequestException('File format is invalid or missing header row.');
      }

      const parsedDate = this.validateAndNormalizeDate(uploadedDate);

      const firstRow = data[0];
      const headerMap = Object.keys(firstRow).reduce((acc, key) => {
        const normalized = key.replace(/\s+/g, ' ').trim().toLowerCase();
        acc[normalized] = key;
        return acc;
      }, {} as Record<string, string>);

      const receivedHeaders = Object.keys(headerMap).map(h => h.replace(/\s+/g, ' ').toUpperCase());
      this.validateHeaders(receivedHeaders);

      const mapped = data
        .map(row => this.mapToEntity(row, headerMap, parsedDate, uploaded_by))
        .filter((entity): entity is HorizonReport => entity !== null);

      if (mapped.length === 0) {
        throw new BadRequestException('No valid data rows found.');
      }

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
    const missing = expected.filter(e => !receivedHeaders.includes(e));

    if (missing.length > 0) {
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

  private mapToEntity(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    uploadedDate: Date,
    uploaded_by: string,
  ): HorizonReport | null {
    const parseNumber = (val: unknown): number => {
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    const getVal = (label: string): any => {
      const normalizedLabel = label.replace(/\s+/g, ' ').trim().toLowerCase();
      const key = headerMap[normalizedLabel];
      const value = key ? row[key] : null;
      return typeof value === 'string' ? value.trim() : value ?? '';
    };

    const shift = getVal('Shift');
    if (!shift) return null;

    let rawDate = getVal('Date');
    const uploaded = typeof rawDate === 'number' ? this.excelSerialToDate(rawDate) : uploadedDate;

    return {
      uploadedDate: uploaded,
      shift,
      totalScheduledLumpers: parseNumber(getVal('Total Scheduled Lumpers')),
      totalPresentLumpers: parseNumber(getVal('Total Present Lumpers')),
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
      totalCasesUnloaded: parseNumber(getVal('Total Cases Unloaded')),
      totalCasesClosedForTheDay: parseNumber(getVal('Total Cases Closed For The Day')),
      totalContainersCarriedOverToTheNextDay: parseNumber(getVal('Total Containers Carried Over To The Next Day')),
      totalHoursForTheDay: parseNumber(getVal('Total Hours For The Day')),
      cpmForTheDay: parseNumber(getVal('CPM For The Day')),
      numberOfSkus: parseNumber(getVal('Number Of SKUs')),
      nearMisses: parseNumber(getVal('Near Misses')),
      incidents: parseNumber(getVal('Incidents')),
      accidents: parseNumber(getVal('Accidents')),
      uploaded_by,
    } as HorizonReport;
  }

  private excelSerialToDate(serial: number): Date {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + serial * 86400000);
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
            const value = (row as any)[col] ?? (row as any)[this.snakeToCamel(col)];
            values.push(value);
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
