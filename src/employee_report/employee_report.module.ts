import { Module } from '@nestjs/common';
import { EmployeeReportService } from './employee_report.service';
import { EmployeeReportController } from './employee_report.controller';

@Module({
  controllers: [EmployeeReportController],
  providers: [EmployeeReportService],
  exports: [EmployeeReportService],
})
export class EmployeeReportModule {}
