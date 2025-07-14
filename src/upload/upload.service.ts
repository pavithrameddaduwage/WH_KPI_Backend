import { Injectable, BadRequestException } from '@nestjs/common';
import { DailyReportService } from 'src/daily_report/daily_report.service';
import { DiverseDailyReportService } from 'src/diverse_daily_report/diverse_daily_report.service';
import { EmployeeReportService } from 'src/employee_report/employee_report.service';
import { HorzionReportService } from 'src/horzion_report/horzion_report.service';

type FileType = 'diversedaily' | 'employeeTotal' | 'horizon' | 'labor';

@Injectable()
export class UploadService {
  constructor(
    private readonly dailyReportService: DailyReportService,  
    private readonly diverseDailyReportService: DiverseDailyReportService, 
    private readonly employeeReportService: EmployeeReportService,
    private readonly horizonReportService: HorzionReportService,
  ) {}

  async handleJsonUpload(payload: {
    fileType: FileType;
    fileName: string;
    reportDate: string;
    data: any[];
  }): Promise<{ success: boolean }> {
    const { fileType, fileName, reportDate, data } = payload;

    if (!fileType || !fileName || !reportDate || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('Invalid upload payload');
    }

    switch (fileType) {
      case 'diversedaily':
        await this.diverseDailyReportService.process(data, fileName, reportDate);
        break;

      case 'employeeTotal':
        await this.employeeReportService.process(data, fileName, reportDate);
        break;

      case 'horizon':
        await this.horizonReportService.process(data, fileName, reportDate);
        break;

      case 'labor':
        await this.dailyReportService.process(data, fileName, reportDate);
        break;

      default:
        throw new BadRequestException(`Unsupported fileType: ${fileType}`);
    }

    return { success: true };
  }
}
