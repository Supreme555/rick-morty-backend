import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { openSSHTunnel, closeSSHTunnel } from './ssh-tunnel.js';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    await openSSHTunnel();
  }

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4008',
    credentials: true,
  });

  const port = process.env.PORT ?? 4009;
  await app.listen(port, '0.0.0.0');
  logger.log(`Server is running on port ${port}`);

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
