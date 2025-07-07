
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import {ConfigService} from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('APP_PORT') || 3500;

  await app.listen(Number(port));
  console.log(`Server is running on http://localhost:${port}`);
}

bootstrap();
