import { Module } from '@nestjs/common';
import { DrawsService } from './draws.service';
import { DrawsController } from './draws.controller';
import { DrawEvaluatorService } from './draw-evaluator.service';

@Module({
  controllers: [DrawsController],
  providers: [DrawsService, DrawEvaluatorService],
  exports: [DrawsService, DrawEvaluatorService],
})
export class DrawsModule {}
