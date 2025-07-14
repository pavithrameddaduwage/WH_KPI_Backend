import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DiverseDailyReportService } from './diverse_daily_report.service';
 
@Controller('diverse-daily-report')
export class DiverseDailyReportController {
  constructor(private readonly diverseDailyReportService: DiverseDailyReportService) {}
 
  }
 