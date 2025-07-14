import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EmployeeReportService } from './employee_report.service';
 

@Controller('employee-report')
export class EmployeeReportController {
  constructor(private readonly employeeReportService: EmployeeReportService) {}

  
  }

