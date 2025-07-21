import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

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

  @Post()
  async uploadJsonData(@Body() payload: any): Promise<{ message: string }> {
    const { fileType } = payload;

    if (!allowedFileTypes.includes(fileType)) {
      console.error(`Upload failed: Invalid fileType received - ${fileType}`);
      throw new BadRequestException(`Invalid fileType: ${fileType}`);
    }

    try {
      await this.uploadService.handleJsonUpload(payload);
    } catch (error) {
      console.error('UploadService error:', error);
  
      throw error;
    }

    return { message: 'File uploaded successfully' };
  }
}
