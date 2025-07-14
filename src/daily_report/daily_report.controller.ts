import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DailyReportService } from './daily_report.service';
 

@Controller('daily-report')
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

   
}
