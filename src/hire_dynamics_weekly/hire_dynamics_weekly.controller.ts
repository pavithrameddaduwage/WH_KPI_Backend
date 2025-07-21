import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HireDynamicsWeeklyService } from './hire_dynamics_weekly.service';
 

@Controller('hire-dynamics-weekly')
export class HireDynamicsWeeklyController {
  constructor(private readonly hireDynamicsWeeklyService: HireDynamicsWeeklyService) {}

   
}
