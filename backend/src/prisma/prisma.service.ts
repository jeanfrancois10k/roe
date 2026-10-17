import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connexion PostgreSQL établie avec succès.');
    } catch (error: any) {
      this.logger.warn(`Échec de la connexion PostgreSQL initiale : ${error.message}`);
      // En environnement Serverless, ne pas bloquer l'initialisation du serveur;
      // Prisma tentera automatiquement la connexion lors de la première requête.
      if (!process.env.VERCEL) {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Déconnexion de PostgreSQL effectuée.');
  }
}
