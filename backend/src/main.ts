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

  // En-têtes HTTP de sécurité renforcée (Defense in Depth)
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Protection contre les attaques par force brute sur l'authentification (Rate Limiter)
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  app.use('/api/v1/auth', (req: any, res: any, next: any) => {
    if (req.method !== 'POST') return next();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const record = authAttempts.get(ip) || { count: 0, resetAt: now + 60_000 };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + 60_000;
    }

    record.count++;
    authAttempts.set(ip, record);

    if (record.count > 15) {
      return res.status(429).json({
        statusCode: 429,
        message: 'Trop de tentatives d’authentification. Veuillez réessayer dans une minute.',
        error: 'Too Many Requests',
      });
    }

    next();
  });

  // Configuration CORS pour Admin Web et Terminaux POS
  app.enableCors({
    origin: (origin, callback) => callback(null, true),
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
