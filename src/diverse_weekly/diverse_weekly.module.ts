import { Module } from '@nestjs/common';
import { DiverseWeeklyService } from './diverse_weekly.service';
import { DiverseWeeklyController } from './diverse_weekly.controller';

@Module({
  controllers: [DiverseWeeklyController],
  providers: [DiverseWeeklyService],
  exports: [DiverseWeeklyService], 
})
export class DiverseWeeklyModule {}
