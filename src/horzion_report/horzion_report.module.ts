import { Module } from '@nestjs/common';
import { HorzionReportService } from './horzion_report.service';
import { HorzionReportController } from './horzion_report.controller';

@Module({
  controllers: [HorzionReportController],
  providers: [HorzionReportService],
  exports: [HorzionReportService],
})
export class HorzionReportModule {}
