import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  vendorId?: string;
  deviceId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || 'roe_bolet_super_secret_access_key_2026_@!',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        vendorProfile: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur inactif ou introuvable');
    }

    // Si c'est un compte vendeur, vérifier l'état du vendeur
    if (user.role === 'VENDOR' && user.vendorProfile) {
      if (user.vendorProfile.status === 'SUSPENDED') {
        throw new UnauthorizedException('Ce compte vendeur a été suspendu par l’administrateur');
      }
      if (user.vendorProfile.status === 'INACTIVE' || user.vendorProfile.status === 'LOCKED') {
        throw new UnauthorizedException('Ce compte vendeur est inactif ou verrouillé');
      }
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      vendorId: user.vendorProfile?.id || null,
      vendorCode: user.vendorProfile?.vendorCode || null,
      deviceId: payload.deviceId || null,
    };
  }
}
