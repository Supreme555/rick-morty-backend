import 'dotenv/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { openSSHTunnel, closeSSHTunnel } from './ssh-tunnel.js';
import { envOr } from './common/env.js';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    await openSSHTunnel();
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: envOr('FRONTEND_URL', 'http://localhost:4008'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(
    new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rick and Morty API')
    .setDescription(
      'Backend-for-frontend over rickandmortyapi.com with AI descriptions',
    )
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = process.env.PORT ?? 4009;
  await app.listen(port, '0.0.0.0');
  logger.log(`Server is running on port ${port}`);
  logger.log(`Swagger: http://localhost:${port}/api/docs`);

  const shutdown = () => {
    void app.close().then(() => {
      closeSSHTunnel();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
await bootstrap();
