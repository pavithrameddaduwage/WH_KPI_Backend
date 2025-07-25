import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { DailyReportModule } from 'src/daily_report/daily_report.module';
import { EmployeeReportModule } from 'src/employee_report/employee_report.module';
import { HorzionReportModule } from 'src/horzion_report/horzion_report.module';
import { DiverseDailyReportModule } from 'src/diverse_daily_report/diverse_daily_report.module'; // ✅ import the correct module
import { DiverseWeeklyModule } from 'src/diverse_weekly/diverse_weekly.module';
import { EmployeeWeeklyModule } from 'src/employee_weekly/employee_weekly.module';
import { FreightBreakersWeeklyModule } from 'src/freight_breakers_weekly/freight_breakers_weekly.module';
import { HireDynamicsWeeklyModule } from 'src/hire_dynamics_weekly/hire_dynamics_weekly.module';

@Module({
  imports: [
    DailyReportModule,
    EmployeeReportModule,
    HorzionReportModule,
    DiverseDailyReportModule,  
    HireDynamicsWeeklyModule,
    FreightBreakersWeeklyModule,
    EmployeeWeeklyModule,
    DiverseWeeklyModule,
    
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
