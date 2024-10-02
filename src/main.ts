import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config';

async function bootstrap() {
  const logger = new Logger('Payments-MS');
  const app = await NestFactory.create(AppModule, {
    rawBody: true, //! *** para Stripe
  });

  /*   app.enableCors({
    origin: ['http://localhost:3003/', 'https://checkout.stripe.com/', 'https://mqq9r9k0-3003.brs.devtunnels.ms'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }); */

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(envs.port);
  logger.log(`Payments-MS Running on Port: ${envs.port}`);
}
bootstrap();
