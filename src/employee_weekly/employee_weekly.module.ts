import { Module } from '@nestjs/common';
import { EmployeeWeeklyService } from './employee_weekly.service';
import { EmployeeWeeklyController } from './employee_weekly.controller';

@Module({
  controllers: [EmployeeWeeklyController],
  providers: [EmployeeWeeklyService],
  exports: [EmployeeWeeklyService],
})
export class EmployeeWeeklyModule {}
