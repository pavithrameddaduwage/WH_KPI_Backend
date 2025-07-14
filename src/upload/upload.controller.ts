import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

const allowedFileTypes = ['diversedaily', 'employeeTotal', 'horizon', 'labor'] as const;
type FileType = typeof allowedFileTypes[number];

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

 
  @Post()
  async uploadJsonData(@Body() payload: any): Promise<{ message: string }> {
    const { fileType } = payload;

    if (!allowedFileTypes.includes(fileType)) {
      throw new BadRequestException(`Invalid fileType: ${fileType}`);
    }

    await this.uploadService.handleJsonUpload(payload);
    return { message: 'File uploaded successfully' };
  }
}
