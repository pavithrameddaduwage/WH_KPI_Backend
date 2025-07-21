import { Module } from '@nestjs/common';
import { HireDynamicsWeeklyService } from './hire_dynamics_weekly.service';
import { HireDynamicsWeeklyController } from './hire_dynamics_weekly.controller';

@Module({
  controllers: [HireDynamicsWeeklyController],
  providers: [HireDynamicsWeeklyService],
  exports: [HireDynamicsWeeklyService], 
})
export class HireDynamicsWeeklyModule {}
