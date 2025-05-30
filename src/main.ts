import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { WardsLogger } from './utils/logger.service';
import { AppModule } from './app.module';

const validationPipe = new ValidationPipe({
  // Automatically transform payloads to DTO instances
  transform: true,
  // Enable implicit type conversion (e.g. "123" → 123 if your DTO prop is number)
  // transformOptions: { enableImplicitConversion: true },

  // Strip out any properties not declared in the DTO
  whitelist: true,
  // Throw an error if non-whitelisted props are present
  forbidNonWhitelisted: true,

  // Stop validation on the first error (optional)
  stopAtFirstError: false,

  // HTTP status for validation errors
  errorHttpStatusCode: 400,

  // Disable detailed messages in production
  disableErrorMessages: process.env.NODE_ENV === 'production',

  // Customize the error response shape
  exceptionFactory: (errors: ValidationError[]) => {
    return new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      validation: formatErrors(errors),
    });
  },
});

function formatErrors(errors: ValidationError[]) {
  return errors.map((err) => ({
    // property name that failed
    field: err.property,
    // all failed constraints messages
    messages: Object.values(err.constraints || {}),
  }));
}

async function bootstrap() {
  const logger = new WardsLogger('BOOTSTRAP');
  logger.log('................................Wards starting................................');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: new WardsLogger(),
      cors: true,
    });

    app.useGlobalPipes(validationPipe);

    const config = new DocumentBuilder()
      .setTitle('Wards REST API')
      .setDescription('The walve REST API description')
      .setVersion('1.0')
      .build();
    const documentFactory = () => {
      return SwaggerModule.createDocument(app, config);
    };
    SwaggerModule.setup('api', app, documentFactory, {
      jsonDocumentUrl: 'api/json',
    });

    const port = process.env.port ?? 3000;
    await app.listen(port);

    logger.log('Wards started! PORT:', port);
  } catch (error) {
    logger.error('Wards start failed:', error);
    process.exit(1);
  }
}

void bootstrap();
