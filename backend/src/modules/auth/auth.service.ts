import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { Role, VendorStatus, DeviceStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async registerUser(dto: RegisterUserDto, creatorId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, ...(dto.email ? [{ email: dto.email }] : [])],
      },
    });

    if (existing) {
      throw new BadRequestException("Un utilisateur avec cet identifiant ou cet email existe déjà.");
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email || null,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: creatorId || user.id,
      action: 'USER_CREATED',
      resource: `User:${user.id}`,
      newPayload: { username: user.username, role: user.role },
    });

    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.username?.trim();

    // 1. Recherche par nom d'utilisateur exact
    let user = await this.prisma.user.findUnique({
      where: { username: identifier },
      include: {
        vendorProfile: {
          include: {
            devices: true,
          },
        },
      },
    });

    // 2. Fallback par e-mail ou nom d'utilisateur insensible à la casse
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: identifier, mode: 'insensitive' } },
            { email: { equals: identifier, mode: 'insensitive' } },
          ],
        },
        include: {
          vendorProfile: {
            include: {
              devices: true,
            },
          },
        },
      });
    }

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        resource: `Username:${dto.username}`,
        ipAddress,
        userAgent,
        newPayload: { reason: 'Utilisateur inexistant' },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte utilisateur a été désactivé');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      await this.auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: `User:${user.id}`,
        ipAddress,
        userAgent,
        newPayload: { reason: 'Mot de passe erroné' },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Contrôles spécifiques au rôle VENDOR
    if (user.role === Role.VENDOR && user.vendorProfile) {
      if (user.vendorProfile.status === VendorStatus.SUSPENDED) {
        throw new ForbiddenException('Votre compte vendeur est suspendu par la direction.');
      }
      if (user.vendorProfile.status !== VendorStatus.ACTIVE) {
        throw new ForbiddenException('Votre compte vendeur n’est pas actif.');
      }

      // Enregistrement / mise à jour du terminal si un deviceUuid est fourni
      if (dto.deviceUuid) {
        let device = await this.prisma.device.findUnique({
          where: { deviceUuid: dto.deviceUuid },
        });

        if (!device) {
          // Premier branchement de l'appareil pour ce vendeur
          device = await this.prisma.device.create({
            data: {
              vendorId: user.vendorProfile.id,
              deviceUuid: dto.deviceUuid,
              deviceModel: dto.deviceModel || 'Unknown Android Terminal',
              osVersion: dto.osVersion || 'Android',
              appVersion: dto.appVersion || '1.0.0',
              ipAddress: ipAddress || null,
              status: DeviceStatus.AUTHORIZED,
              isOnline: true,
              lastSeenAt: new Date(),
            },
          });
        } else {
          if (device.status === DeviceStatus.REVOKED) {
            throw new ForbiddenException("Cet appareil a été révoqué par l'administrateur.");
          }
          if (device.vendorId !== user.vendorProfile.id) {
            throw new ForbiddenException("Cet appareil est déjà attribué à un autre point de vente.");
          }

          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              lastSeenAt: new Date(),
              isOnline: true,
              ipAddress: ipAddress || null,
              appVersion: dto.appVersion || device.appVersion,
            },
          });
        }
      }

      // Horodatage de connexion vendeur
      await this.prisma.vendor.update({
        where: { id: user.vendorProfile.id },
        data: {
          lastLoginAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
    }

    // Génération des tokens
    const tokens = await this.generateTokens(user.id, user.username, user.role, user.vendorProfile?.id, dto.deviceUuid);

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: `User:${user.id}`,
      ipAddress,
      userAgent,
      newPayload: { role: user.role, deviceUuid: dto.deviceUuid },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        vendor: user.vendorProfile
          ? {
              id: user.vendorProfile.id,
              vendorCode: user.vendorProfile.vendorCode,
              fullName: user.vendorProfile.fullName,
              status: user.vendorProfile.status,
              currentBalance: Number(user.vendorProfile.currentBalance),
              creditLimit: Number(user.vendorProfile.creditLimit),
              dailySalesLimit: Number(user.vendorProfile.dailySalesLimit),
              maxTicketAmount: Number(user.vendorProfile.maxTicketAmount),
              defaultCommissionRate: Number(user.vendorProfile.defaultCommissionRate),
            }
          : null,
      },
      ...tokens,
    };
  }

  async loginWithPin(dto: PinLoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = (dto.vendorCode || '').trim();
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        OR: [
          { vendorCode: { equals: identifier, mode: 'insensitive' } },
          { user: { username: { equals: identifier, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: true,
        devices: true,
      },
    });

    if (!vendor || !vendor.user) {
      throw new UnauthorizedException('Code vendeur ou PIN incorrect');
    }

    if (vendor.status === VendorStatus.SUSPENDED) {
      throw new ForbiddenException('Ce compte vendeur est suspendu par la direction.');
    }

    if (!vendor.user.pinHash) {
      throw new BadRequestException('Aucun PIN configuré pour ce vendeur. Veuillez vous connecter avec mot de passe.');
    }

    const pinMatch = await bcrypt.compare(dto.pin, vendor.user.pinHash);
    if (!pinMatch) {
      await this.auditService.log({
        userId: vendor.userId,
        action: 'PIN_LOGIN_FAILED',
        resource: `Vendor:${vendor.id}`,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Code vendeur ou PIN incorrect');
    }

    // Validation du terminal
    let device = await this.prisma.device.findUnique({
      where: { deviceUuid: dto.deviceUuid },
    });

    if (!device) {
      device = await this.prisma.device.create({
        data: {
          vendorId: vendor.id,
          deviceUuid: dto.deviceUuid,
          deviceModel: dto.deviceModel,
          osVersion: dto.osVersion,
          appVersion: dto.appVersion,
          ipAddress: ipAddress || null,
          status: DeviceStatus.AUTHORIZED,
          isOnline: true,
          lastSeenAt: new Date(),
        },
      });
    } else {
      if (device.status === DeviceStatus.REVOKED) {
        throw new ForbiddenException("Terminal révoqué par l'administrateur");
      }
      if (device.vendorId !== vendor.id) {
        throw new ForbiddenException("Cet appareil appartient à un autre vendeur");
      }
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          isOnline: true,
          ipAddress: ipAddress || null,
          appVersion: dto.appVersion,
        },
      });
    }

    await this.prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(
      vendor.user.id,
      vendor.user.username,
      vendor.user.role,
      vendor.id,
      dto.deviceUuid,
    );

    await this.auditService.log({
      userId: vendor.user.id,
      action: 'PIN_LOGIN_SUCCESS',
      resource: `Vendor:${vendor.id}`,
      ipAddress,
      userAgent,
      newPayload: { deviceUuid: dto.deviceUuid },
    });

    return {
      user: {
        id: vendor.user.id,
        username: vendor.user.username,
        role: vendor.user.role,
        vendor: {
          id: vendor.id,
          vendorCode: vendor.vendorCode,
          fullName: vendor.fullName,
          status: vendor.status,
          currentBalance: Number(vendor.currentBalance),
          creditLimit: Number(vendor.creditLimit),
          dailySalesLimit: Number(vendor.dailySalesLimit),
          maxTicketAmount: Number(vendor.maxTicketAmount),
          defaultCommissionRate: Number(vendor.defaultCommissionRate),
        },
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const savedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { vendorProfile: true },
        },
      },
    });

    if (!savedToken) {
      throw new UnauthorizedException('Refresh token invalide ou révoqué');
    }

    if (savedToken.revokedAt || new Date() > savedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token expiré ou révoqué');
    }

    if (!savedToken.user.isActive) {
      throw new UnauthorizedException('Compte utilisateur inactif');
    }

    if (savedToken.user.role === Role.VENDOR && savedToken.user.vendorProfile?.status === VendorStatus.SUSPENDED) {
      throw new ForbiddenException('Compte vendeur suspendu');
    }

    // Rotation du Refresh Token : on révoque l'ancien
    await this.prisma.refreshToken.update({
      where: { id: savedToken.id },
      data: { revokedAt: new Date() },
    });

    // Émission du nouveau couple de tokens
    return await this.generateTokens(
      savedToken.user.id,
      savedToken.user.username,
      savedToken.user.role,
      savedToken.user.vendorProfile?.id,
      savedToken.deviceId || undefined,
    );
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      resource: `User:${userId}`,
    });

    return { success: true, message: 'Déconnexion effectuée avec succès' };
  }

  private async generateTokens(
    userId: string,
    username: string,
    role: Role,
    vendorId?: string,
    deviceId?: string,
  ) {
    const payload = {
      sub: userId,
      username,
      role,
      vendorId: vendorId || null,
      deviceId: deviceId || null,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'roe_bolet_super_secret_access_key_2026_@!';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'roe_bolet_super_secret_refresh_key_2026_#?';

    const isVendor = role === Role.VENDOR;
    const accessExpiresIn = isVendor ? '30d' : '7d';
    const accessExpiresSeconds = isVendor ? 30 * 24 * 3600 : 7 * 24 * 3600;
    const refreshValidityDays = isVendor ? 90 : 30;

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshValidityDays);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId: deviceId || null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: accessExpiresSeconds,
    };
  }

  async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new BadRequestException('Le nouveau mot de passe doit comporter au moins 6 caractères.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    if (currentPassword) {
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        throw new BadRequestException('Le mot de passe actuel est incorrect.');
      }
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: `User:${userId}`,
      newPayload: { username: user.username, email: user.email },
    });

    return {
      success: true,
      message: 'Mot de passe modifié avec succès !',
    };
  }
}
