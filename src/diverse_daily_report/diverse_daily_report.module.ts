import { Module } from '@nestjs/common';
import { DiverseDailyReportService } from './diverse_daily_report.service';
import { DiverseDailyReportController } from './diverse_daily_report.controller';

@Module({
  controllers: [DiverseDailyReportController],
  providers: [DiverseDailyReportService],
  exports: [DiverseDailyReportService],
})
export class DiverseDailyReportModule {}
