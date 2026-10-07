import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SetCommissionDto } from './dto/set-commission.dto';
import { CommissionType } from '@prisma/client';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Définition d'une règle personnalisée de commission pour un vendeur sur un jeu
   */
  async setRule(dto: SetCommissionDto, adminId?: string) {
    const [vendor, game] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: dto.vendorId } }),
      this.prisma.game.findUnique({ where: { id: dto.gameId } }),
    ]);

    if (!vendor) throw new NotFoundException('Vendeur introuvable');
    if (!game) throw new NotFoundException('Jeu introuvable');

    const rule = await this.prisma.commission.upsert({
      where: {
        vendorId_gameId: {
          vendorId: dto.vendorId,
          gameId: dto.gameId,
        },
      },
      update: {
        rateType: dto.rateType,
        rateValue: dto.rateValue,
      },
      create: {
        vendorId: dto.vendorId,
        gameId: dto.gameId,
        rateType: dto.rateType,
        rateValue: dto.rateValue,
      },
      include: {
        game: { select: { code: true, name: true } },
        vendor: { select: { vendorCode: true, fullName: true } },
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'COMMISSION_RULE_SET',
      resource: `Commission:${rule.id}`,
      newPayload: {
        vendorCode: rule.vendor.vendorCode,
        gameCode: rule.game.code,
        rateType: rule.rateType,
        rateValue: Number(rule.rateValue),
      },
    });

    this.logger.log(
      `Commission configurée pour ${rule.vendor.vendorCode} sur ${rule.game.code}: ${rule.rateValue} (${rule.rateType})`,
    );

    return {
      ...rule,
      rateValue: Number(rule.rateValue),
    };
  }

  /**
   * Liste des commissions personnalisées d'un vendeur
   */
  async getByVendor(vendorId: string) {
    const rules = await this.prisma.commission.findMany({
      where: { vendorId },
      include: {
        game: { select: { id: true, code: true, name: true, defaultCommission: true } },
      },
    });

    return rules.map((r) => ({
      ...r,
      rateValue: Number(r.rateValue),
      game: {
        ...r.game,
        defaultCommission: Number(r.game.defaultCommission),
      },
    }));
  }

  /**
   * Calcul automatique du montant de commission
   */
  async calculateCommission(
    vendorId: string,
    gameId: string,
    totalAmount: number,
    ticketsCount = 1,
  ): Promise<{ commissionAmount: number; rateType: CommissionType; rateValue: number }> {
    // 1. Vérifier si une règle personnalisée existe pour ce vendeur et ce jeu
    const customRule = await this.prisma.commission.findUnique({
      where: {
        vendorId_gameId: { vendorId, gameId },
      },
    });

    if (customRule) {
      const rateValue = Number(customRule.rateValue);
      let commissionAmount = 0;

      if (customRule.rateType === CommissionType.PERCENTAGE) {
        commissionAmount = (totalAmount * rateValue) / 100;
      } else if (customRule.rateType === CommissionType.FIXED_PER_TICKET) {
        commissionAmount = ticketsCount * rateValue;
      }

      return {
        commissionAmount: Number(commissionAmount.toFixed(2)),
        rateType: customRule.rateType,
        rateValue,
      };
    }

    // 2. Règle par défaut : priorité à la commission du jeu, sinon commission globale du vendeur
    const [game, vendor] = await Promise.all([
      this.prisma.game.findUnique({ where: { id: gameId }, select: { defaultCommission: true } }),
      this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { defaultCommissionRate: true } }),
    ]);

    const defaultRate = game?.defaultCommission
      ? Number(game.defaultCommission)
      : vendor?.defaultCommissionRate
      ? Number(vendor.defaultCommissionRate)
      : 5.0;

    const commissionAmount = (totalAmount * defaultRate) / 100;

    return {
      commissionAmount: Number(commissionAmount.toFixed(2)),
      rateType: CommissionType.PERCENTAGE,
      rateValue: defaultRate,
    };
  }

  /**
   * Suppression d'une règle personnalisée (retour au taux par défaut)
   */
  async deleteRule(vendorId: string, gameId: string, adminId?: string) {
    const existing = await this.prisma.commission.findUnique({
      where: {
        vendorId_gameId: { vendorId, gameId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Règle de commission introuvable');
    }

    await this.prisma.commission.delete({
      where: { id: existing.id },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'COMMISSION_RULE_DELETED',
      resource: `Commission:${existing.id}`,
      oldPayload: existing,
    });

    return { success: true, message: 'Règle personnalisée supprimée. Taux par défaut rétabli.' };
  }
}
