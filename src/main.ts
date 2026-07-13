import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { corsMethods, createCorsOriginResolver } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.enableCors({
    origin: createCorsOriginResolver(),
    credentials: true,
    methods: corsMethods,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

bootstrap();
