import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GamesModule } from './modules/games/games.module';
import { DrawsModule } from './modules/draws/draws.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuditModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    DashboardModule,
    GamesModule,
    DrawsModule,
    TicketsModule,
    CommissionsModule,
    TransactionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
