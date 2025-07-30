import { Controller, Post, Body, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import {AuthGuard} from "../auth/auth.guard";


const allowedFileTypes = [
  'diversedaily',
  'employeeTotal',
  'horizon',
  'labor',
  'employee_weekly',
  'diverse_weekly',
  'hire_dynamics_weekly',
  'freight_breakers_weekly',
] as const;

type FileType = typeof allowedFileTypes[number];

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @UseGuards(AuthGuard)
  @Post()
  async uploadJsonData(@Req() req, @Body() payload: any): Promise<{ message: string }> {
    const { fileType } = payload;
    const username = req.user?.name;


    if (!allowedFileTypes.includes(fileType)) {
      console.error(`Upload failed: Invalid fileType received - ${fileType}`);
      throw new BadRequestException(`Invalid fileType: ${fileType}`);
    }

    try {
      await this.uploadService.handleJsonUpload(payload, username);
    } catch (error) {
      console.error('UploadService error:', error);
      throw error;
    }

    return { message: 'File uploaded successfully' };
  }
}
