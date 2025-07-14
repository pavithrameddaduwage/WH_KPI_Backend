import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UploadModule } from './upload/upload.module';
import { DailyReportModule } from './daily_report/daily_report.module';
import { DiverseDailyReportModule } from './diverse_daily_report/diverse_daily_report.module';
import { EmployeeReportModule } from './employee_report/employee_report.module';
import { HorzionReportModule } from './horzion_report/horzion_report.module';

@Module({
  imports: [
    DatabaseModule,
    UploadModule,
    DailyReportModule,
    DiverseDailyReportModule,
    EmployeeReportModule,
    HorzionReportModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
