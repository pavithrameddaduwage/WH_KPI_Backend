import { Module } from '@nestjs/common';
import { FreightBreakersWeeklyService } from './freight_breakers_weekly.service';
import { FreightBreakersWeeklyController } from './freight_breakers_weekly.controller';

@Module({
  controllers: [FreightBreakersWeeklyController],
  providers: [FreightBreakersWeeklyService],
  exports: [FreightBreakersWeeklyService],   
})
export class FreightBreakersWeeklyModule {}
