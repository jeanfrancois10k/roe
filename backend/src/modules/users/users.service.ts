import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        vendorProfile: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          vendorProfile: {
            select: {
              id: true,
              vendorCode: true,
              fullName: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { total, page, limit, items };
  }

  async toggleActive(id: string, isActive: boolean, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (user.id === adminId && !isActive) {
      throw new BadRequestException('Un administrateur ne peut pas désactiver son propre compte');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      userId: adminId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      resource: `User:${id}`,
      newPayload: { isActive },
    });

    return updated;
  }

  async changeUserPassword(id: string, newPass: string, adminId: string) {
    if (!newPass || newPass.trim().length < 6) {
      throw new BadRequestException('Le mot de passe doit comporter au moins 6 caractères');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPass, saltRounds);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, username: true, email: true, role: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'ADMIN_PASSWORD_RESET',
      resource: `User:${id}`,
      newPayload: { username: updated.username, email: updated.email },
    });

    return {
      success: true,
      message: 'Mot de passe modifié avec succès',
      user: updated,
    };
  }
}
