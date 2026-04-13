import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { static as serveStatic } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadsRoot = join(process.cwd(), 'uploads');

  // Enable CORS for all origins
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Media-managed uploads are served through the Media controller so
  // publication status cannot be bypassed with raw filesystem URLs.
  app.use('/uploads/media', (_req, res) => {
    res.status(404).end();
  });
  app.use('/uploads', serveStatic(uploadsRoot));

  await app.listen(process.env.PORT);
}
bootstrap();
