import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return {
      platform: 'ROE BOLET - Transactional API',
      status: 'ONLINE',
      version: '1.0.1',
      documentation: '/api/docs',
      health: '/api/v1/health',
      environment: 'serverless-vercel',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('api')
  getApiRoot() {
    return this.getRoot();
  }

  @Public()
  @Get('api/index')
  getApiIndex() {
    return this.getRoot();
  }
}
