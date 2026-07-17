import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as fs from 'fs';
import { resolve } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // helmet's default cross-origin-resource-policy is same-origin, which would
  // block the storefront (a different origin) from loading /uploads images.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Uploaded media lives on a persistent Docker volume and is served read-only.
  // Directory listing is off and dotfiles are denied; filenames are
  // server-generated UUIDs, so nothing user-supplied reaches the filesystem.
  const uploadsDir = resolve(process.env.UPLOADS_DIR || '/app/uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    maxAge: '30d',
    immutable: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Finders Keepers API')
    .setDescription('Ecommerce backend for Finders Keepers LB')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // Only emit the spec outside production: the container filesystem should be
  // treated as disposable and a failed write must never stop the API booting.
  if (process.env.NODE_ENV !== 'production') {
    try {
      fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
    } catch {
      // non-fatal
    }
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api`);
}

bootstrap();