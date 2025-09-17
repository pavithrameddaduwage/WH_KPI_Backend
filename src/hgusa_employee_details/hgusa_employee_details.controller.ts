import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HgusaEmployeeDetailsService } from './hgusa_employee_details.service';
 

@Controller('hgusa-employee-details')
export class HgusaEmployeeDetailsController {
  constructor(private readonly hgusaEmployeeDetailsService: HgusaEmployeeDetailsService) {}
}
