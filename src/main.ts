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

  // CORS explícito y cerrado por lista. credentials: true hace falta para la
  // cookie de refresh que llega en la Fase 2.
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist descarta las propiedades no declaradas en el DTO y
      // forbidNonWhitelisted las rechaza con un 400. Es lo que impide que llegue
      // a la base de datos cualquier cosa que venga en el body.
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
      .setDescription('Gestión de inventario de licores')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);

    // El front genera su cliente tipado desde /docs-json (ver CLAUDE.md).
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API escuchando en http://localhost:${port}/${apiPrefix}`);
  if (swagger.enabled) {
    logger.log(`Swagger en http://localhost:${port}/docs`);
  }
}

void bootstrap();
