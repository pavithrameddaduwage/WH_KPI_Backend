import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EmployeeWeeklyService } from './employee_weekly.service';
 
@Controller('employee-weekly')
export class EmployeeWeeklyController {
  constructor(private readonly employeeWeeklyService: EmployeeWeeklyService) {}

  
}
