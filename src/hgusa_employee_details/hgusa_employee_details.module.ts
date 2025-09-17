import { Module } from '@nestjs/common';
import { HgusaEmployeeDetailsService } from './hgusa_employee_details.service';
import { HgusaEmployeeDetailsController } from './hgusa_employee_details.controller';

@Module({
  controllers: [HgusaEmployeeDetailsController],
  providers: [HgusaEmployeeDetailsService],
  exports: [HgusaEmployeeDetailsService],  
})
export class HgusaEmployeeDetailsModule {}
