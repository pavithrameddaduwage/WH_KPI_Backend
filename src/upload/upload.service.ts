import { Injectable, BadRequestException } from '@nestjs/common';
import { DailyReportService } from 'src/daily_report/daily_report.service';
import { DiverseDailyReportService } from 'src/diverse_daily_report/diverse_daily_report.service';
import { DiverseWeeklyService } from 'src/diverse_weekly/diverse_weekly.service';
import { EmployeeReportService } from 'src/employee_report/employee_report.service';
import { EmployeeWeeklyService } from 'src/employee_weekly/employee_weekly.service';
import { FreightBreakersWeeklyService } from 'src/freight_breakers_weekly/freight_breakers_weekly.service';
import { HireDynamicsWeeklyService } from 'src/hire_dynamics_weekly/hire_dynamics_weekly.service';
import { HorzionReportService } from 'src/horzion_report/horzion_report.service';

type FileType =
  | 'diversedaily'
  | 'employeeTotal'
  | 'horizon'
  | 'labor'
  | 'employee_weekly'
  | 'diverse_weekly'
  | 'hire_dynamics_weekly'
  | 'freight_breakers_weekly';

@Injectable()
export class UploadService {
  constructor(
    private readonly dailyReportService: DailyReportService,
    private readonly diverseDailyReportService: DiverseDailyReportService,
    private readonly employeeReportService: EmployeeReportService,
    private readonly horizonReportService: HorzionReportService,
    private readonly employeeWeeklyReportService: EmployeeWeeklyService,
    private readonly diverseWeeklyReportService: DiverseWeeklyService,
    private readonly hireDynamicsReportService: HireDynamicsWeeklyService,
    private readonly freightBreakersReportService: FreightBreakersWeeklyService,
  ) {}

  async handleJsonUpload(payload: {
    fileType: FileType;
    fileName: string;
    reportDate?: string;
    startDate?: string;
    endDate?: string;
    data: any[]; }, username:string): Promise<{ success: boolean }> {
    const { fileType, fileName, reportDate, data, startDate, endDate } = payload;




    if (!fileType || !fileName || !Array.isArray(data) || data.length === 0) {
      throw new BadRequestException('Invalid upload payload');
    }



    switch (fileType) {
      case 'diversedaily':
        if (!reportDate) throw new BadRequestException('Missing reportDate for diversedaily');
        await this.diverseDailyReportService.process(data, fileName, reportDate ,username );
        break;

      case 'employeeTotal':
        if (!reportDate) throw new BadRequestException('Missing reportDate for employeeTotal');
       await this.employeeReportService.process(data, fileName,reportDate,username);

        break;

      case 'horizon':
        if (!reportDate) throw new BadRequestException('Missing reportDate for horizon');
        await this.horizonReportService.process(data, fileName, reportDate,username);
        break;

      case 'labor':
        if (!reportDate) throw new BadRequestException('Missing reportDate for labor');
        await this.dailyReportService.process(data, fileName, reportDate,username);
        break;

      case 'employee_weekly':
      if (!startDate || !endDate) {
        throw new BadRequestException('Missing startDate or endDate for employee_weekly');
      }
      await this.employeeWeeklyReportService.process(data, fileName, startDate, endDate ,username);
      break;

      case 'diverse_weekly':
        if (!startDate || !endDate) {
          throw new BadRequestException('Missing startDate or endDate for diverse_weekly');
        }
        await this.diverseWeeklyReportService.process(data, fileName, startDate, endDate ,username);
        break;
       

      case 'hire_dynamics_weekly':
        if (!startDate || !endDate) {
          throw new BadRequestException('Missing startDate or endDate for hire_dynamics_weekly');
        }
        await this.hireDynamicsReportService.process(data, fileName, startDate, endDate ,username);
        break;

      case 'freight_breakers_weekly':
        if (!startDate || !endDate) {
          throw new BadRequestException('Missing startDate or endDate for freight_breakers_weekly');
        }
        await this.freightBreakersReportService.process(data, fileName, startDate, endDate,username);
        break;

      default:
        throw new BadRequestException(`Unsupported fileType: ${fileType}`);
    }

    return { success: true };
  }
}
