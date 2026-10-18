import { Controller, Get, All, Req, Res } from '@nestjs/common';
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

  @Public()
  @All('socket.io')
  handleSocketIoRoot(@Req() req: any, @Res() res: any) {
    const sid = 'roe_nest_' + Math.random().toString(36).substring(2, 12);
    if (req.query?.transport === 'polling') {
      const handshake = JSON.stringify({
        sid,
        upgrades: [],
        pingInterval: 25000,
        pingTimeout: 20000,
        maxPayload: 1000000,
      });
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.status(200).send(`0${handshake}`);
    }
    return res.status(200).json({
      status: 'ONLINE',
      gateway: 'Realtime Serverless Standby',
      sid,
      timestamp: new Date().toISOString(),
    });
  }

  @Public()
  @All('socket.io/*')
  handleSocketIoSub(@Req() req: any, @Res() res: any) {
    return this.handleSocketIoRoot(req, res);
  }
}
