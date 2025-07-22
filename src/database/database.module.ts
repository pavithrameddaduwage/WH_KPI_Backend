import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DailyReport } from 'src/daily_report/entities/daily_report.entity';
import { DiverseDailyReport } from 'src/diverse_daily_report/entities/diverse_daily_report.entity';
import { EmployeeReport } from 'src/employee_report/entities/employee_report.entity';
import { HorizonReport } from 'src/horzion_report/entities/horzion_report.entity';
import { DiverseWeeklyReport } from 'src/diverse_weekly/entities/diverse_weekly.entity';
import { HireDynamicsWeekly } from 'src/hire_dynamics_weekly/entities/hire_dynamics_weekly.entity';
import { FreightBreakersWeekly } from 'src/freight_breakers_weekly/entities/freight_breakers_weekly.entity';


@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get<string>('PG_DB_HOST'),
                port: configService.get<number>('PG_DB_PORT'),
                username: configService.get<string>('PG_DB_USER'),
                password: configService.get<string>('PG_DB_PASSWORD'),
                database: configService.get<string>('PG_DB_NAME'),
                entities: [
                    DailyReport,DiverseDailyReport,EmployeeReport,HorizonReport,DiverseWeeklyReport,HireDynamicsWeekly,FreightBreakersWeekly
                ],
                synchronize: true,
            }),
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
        ]),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {}
