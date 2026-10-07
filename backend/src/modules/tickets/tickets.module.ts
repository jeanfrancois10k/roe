import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [CommissionsModule, RealtimeModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
