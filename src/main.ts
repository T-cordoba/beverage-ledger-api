import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  const port = config.get('port', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const isProduction = config.get('isProduction', { infer: true });
  const { origins } = config.get('cors', { infer: true });
  const swagger = config.get('swagger', { infer: true });

  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());

  // credentials is required for the refresh cookie introduced with auth.
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Anything not declared in a DTO is rejected with a 400 rather than
      // reaching the database.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(isProduction));

  app.enableShutdownHooks();

  if (swagger.enabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle('Beverage Ledger API')
      .setDescription('Liquor inventory management')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);

    // The frontend generates its typed client from /docs-json.
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/${apiPrefix}`);
  if (swagger.enabled) {
    logger.log(`Swagger on http://localhost:${port}/docs`);
  }
}

void bootstrap();
