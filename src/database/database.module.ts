import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';


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
