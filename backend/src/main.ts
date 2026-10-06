import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('ROE_BOLET_BOOTSTRAP');
  const app = await NestFactory.create(AppModule);

  // Validation globale des DTOs avec rejet strict des propriétés inconnues
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuration CORS pour Admin Web et Terminaux POS
  app.enableCors({
    origin: '*', // Configurable en prod via env
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Documentation Interactive Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ROE BOLET - API Transactionnelle')
    .setDescription('Plateforme centralisée de gestion et vente de loterie physique multi-vendeurs.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Serveur ROE BOLET en ligne sur : http://localhost:${port}`);
  logger.log(`📖 Documentation Swagger disponible sur : http://localhost:${port}/api/docs`);
}

bootstrap();
