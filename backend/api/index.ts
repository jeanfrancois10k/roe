process.env.VERCEL = '1';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const express = require('express');
const server = express();
let isAppInitialized = false;

server.get('/', (req: any, res: any) => {
  res.status(200).json({
    platform: 'ROE BOLET - Transactional API',
    status: 'ONLINE',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/v1/health',
    environment: 'serverless-vercel',
    timestamp: new Date().toISOString(),
  });
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.enableCors({
    origin: (origin: any, callback: any) => callback(null, true),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ROE BOLET - API Transactionnelle')
    .setDescription('Plateforme centralisée de gestion et vente de loterie physique multi-vendeurs.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
}

export default async function handler(req: Request, res: Response) {
  try {
    if (!isAppInitialized) {
      await bootstrap();
      isAppInitialized = true;
    }
    server(req, res);
  } catch (error: any) {
    console.error('Fatal Serverless bootstrap error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        message: 'Erreur d’initialisation du serveur d’API Serverless.',
        error: error?.message || String(error),
      });
    }
  }
}

