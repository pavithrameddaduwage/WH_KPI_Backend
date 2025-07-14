import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { DailyReportModule } from 'src/daily_report/daily_report.module';
import { EmployeeReportModule } from 'src/employee_report/employee_report.module';
import { HorzionReportModule } from 'src/horzion_report/horzion_report.module';
import { DiverseDailyReportModule } from 'src/diverse_daily_report/diverse_daily_report.module'; // ✅ import the correct module

@Module({
  imports: [
    DailyReportModule,
    EmployeeReportModule,
    HorzionReportModule,
    DiverseDailyReportModule,  
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
