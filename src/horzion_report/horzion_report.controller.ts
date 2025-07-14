import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HorzionReportService } from './horzion_report.service';
 
@Controller('horzion-report')
export class HorzionReportController {
  constructor(private readonly horzionReportService: HorzionReportService) {}

  
}
