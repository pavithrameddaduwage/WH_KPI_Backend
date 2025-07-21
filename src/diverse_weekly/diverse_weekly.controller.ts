import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DiverseWeeklyService } from './diverse_weekly.service';
 

@Controller('diverse-weekly')
export class DiverseWeeklyController {
  constructor(private readonly diverseWeeklyService: DiverseWeeklyService) {}

 
}
