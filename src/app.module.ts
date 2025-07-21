import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UploadModule } from './upload/upload.module';
import { DailyReportModule } from './daily_report/daily_report.module';
import { DiverseDailyReportModule } from './diverse_daily_report/diverse_daily_report.module';
import { EmployeeReportModule } from './employee_report/employee_report.module';
import { HorzionReportModule } from './horzion_report/horzion_report.module';
import { EmployeeWeeklyModule } from './employee_weekly/employee_weekly.module';
import { DiverseWeeklyModule } from './diverse_weekly/diverse_weekly.module';
import { HireDynamicsWeeklyModule } from './hire_dynamics_weekly/hire_dynamics_weekly.module';
import { FreightBreakersWeeklyModule } from './freight_breakers_weekly/freight_breakers_weekly.module';

@Module({
  imports: [
    DatabaseModule,
    UploadModule,
    DailyReportModule,
    DiverseDailyReportModule,
    EmployeeReportModule,
    HorzionReportModule,
    EmployeeWeeklyModule,
    DiverseWeeklyModule,
    HireDynamicsWeeklyModule,
    FreightBreakersWeeklyModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
