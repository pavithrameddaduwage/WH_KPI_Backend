import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FreightBreakersWeeklyService } from './freight_breakers_weekly.service';
 
@Controller('freight-breakers-weekly')
export class FreightBreakersWeeklyController {
  constructor(private readonly freightBreakersWeeklyService: FreightBreakersWeeklyService) {}

  
}
