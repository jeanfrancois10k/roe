import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { UpdateLotterySettingsDto } from './dto/update-lottery-settings.dto';
import { Currency, Role } from '@prisma/client';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private virginCheckDone = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureVirginHandoverOnce();
  }

  /**
   * Garantit une remise à zéro unique de la base de données pour la livraison vierge à l'Admin.
   */
  private async ensureVirginHandoverOnce() {
    if (this.virginCheckDone) return;
    try {
      const flag = await this.prisma.systemSetting.findUnique({
        where: { key: 'VIRGIN_HANDOVER_RESET_V1' },
      });
      if (!flag) {
        this.logger.warn('🧹 Exécution de la remise à zéro initiale pour livraison Plateforme Vierge...');
        await this.resetPlatformData(undefined, true);
        await this.prisma.systemSetting.upsert({
          where: { key: 'VIRGIN_HANDOVER_RESET_V1' },
          update: { value: new Date().toISOString() },
          create: {
            key: 'VIRGIN_HANDOVER_RESET_V1',
            value: new Date().toISOString(),
            description: 'Indicateur de remise à zéro initiale pour livraison plateforme vierge',
          },
        });
      }
      this.virginCheckDone = true;
    } catch (e: any) {
      this.logger.error(`Erreur lors de la vérification Virgin Handover: ${e?.message}`);
    }
  }

  /**
   * Récupère les paramètres de configuration système et la devise active
   */
  async getSettings() {
    await this.ensureVirginHandoverOnce();
    const settings = await this.prisma.systemSetting.findMany();
    const map = new Map(settings.map((s) => [s.key, s.value]));

    const defaultCurrency = (map.get('DEFAULT_CURRENCY') as Currency) || Currency.HTG;
    const currencySymbol = map.get('CURRENCY_SYMBOL') || (defaultCurrency === Currency.HTG ? 'G' : '$');
    
    let supportedCurrencies = ['HTG', 'USD'];
    try {
      if (map.has('SUPPORTED_CURRENCIES')) {
        supportedCurrencies = JSON.parse(map.get('SUPPORTED_CURRENCIES') || '[]');
      }
    } catch {
      supportedCurrencies = ['HTG', 'USD'];
    }

    const lottery = {
      companyName: map.get('COMPANY_NAME') || 'ROE BOLET',
      companySlogan: map.get('COMPANY_SLOGAN') || 'Juétwèt',
      companyPhone: map.get('COMPANY_PHONE') || '42327120',
      companyAddress: map.get('COMPANY_ADDRESS') || 'Port-au-Prince, Haïti',
      bankRef: map.get('COMPANY_BANK_REF') || 'Bank 6',
      logoUrl: map.get('COMPANY_LOGO_URL') || '',
      ticketHeaderNote: map.get('TICKET_HEADER_NOTE') || '*** ORIGINAL FICHE ***',
      ticketFooterNote: map.get('TICKET_FOOTER_NOTE') || 'FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.',
      ticketProviderInfo: map.get('TICKET_PROVIDER_INFO') || 'ROE-TECH',
      ticketValidityDays: Number(map.get('TICKET_VALIDITY_DAYS') || '90'),
      mariageGratuitNote: map.get('MARIAGE_GRATUIT_NOTE') || 'MARYAJ GRATIS 1500 GDES',
    };

    return {
      defaultCurrency,
      currencySymbol,
      currencyName: defaultCurrency === Currency.HTG ? 'Gourde Haïtienne' : 'Dollar Américain',
      supportedCurrencies,
      isHtgDefault: defaultCurrency === Currency.HTG,
      lottery,
    };
  }

  /**
   * Modifie la devise officielle de la plateforme (Priorité HTG)
   */
  async updateCurrency(dto: UpdateCurrencyDto, userId: string) {
    const symbol = dto.currency === Currency.HTG ? 'G' : dto.currency === Currency.USD ? '$' : 'RD$';

    const oldSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'DEFAULT_CURRENCY' },
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'DEFAULT_CURRENCY' },
      update: { value: dto.currency },
      create: {
        key: 'DEFAULT_CURRENCY',
        value: dto.currency,
        description: 'Devise monétaire principale de la plateforme',
      },
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'CURRENCY_SYMBOL' },
      update: { value: symbol },
      create: {
        key: 'CURRENCY_SYMBOL',
        value: symbol,
        description: 'Symbole monétaire usuel',
      },
    });

    // Piste d'audit
    await this.auditService.log({
      userId,
      action: 'SYSTEM_CURRENCY_CHANGED',
      resource: 'SystemSetting:DEFAULT_CURRENCY',
      oldPayload: { currency: oldSetting?.value || 'HTG' },
      newPayload: { currency: dto.currency, symbol },
    });

    this.logger.log(`Devise de la plateforme mise à jour : ${dto.currency} (${symbol}) par l’administrateur ${userId}`);

    return this.getSettings();
  }

  /**
   * Consultation de la dernière version Android POS et lien de mise à jour directe
   */
  async getAppUpdateInfo() {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: { in: ['ANDROID_LATEST_VERSION', 'ANDROID_LATEST_CODE', 'ANDROID_APK_URL', 'ANDROID_CHANGELOG', 'ANDROID_FORCE_UPDATE'] },
      },
    });
    const map = new Map(settings.map((s) => [s.key, s.value]));

    return {
      latestVersionName: map.get('ANDROID_LATEST_VERSION') || '1.0.3',
      latestVersionCode: Number(map.get('ANDROID_LATEST_CODE') || '4'),
      apkUrl: map.get('ANDROID_APK_URL') || 'https://frontendroe.vercel.app/download/roe-bolet-vendor.apk',
      changelog: map.get('ANDROID_CHANGELOG') || 'Mise à jour v1.0.3 : Clarté visuelle blanc & bleu, session terminal prolongée 30 jours, rapport de contrôle optimisé et résilience 401.',
      isMandatory: map.get('ANDROID_FORCE_UPDATE') === 'true',
    };
  }

  /**
   * Modifie les informations de la loterie / borlette pour l'entête et le pied de page des tickets
   */
  async updateLotterySettings(dto: UpdateLotterySettingsDto, userId: string) {
    const keysMap: Record<string, string | undefined> = {
      COMPANY_NAME: dto.companyName,
      COMPANY_SLOGAN: dto.companySlogan,
      COMPANY_PHONE: dto.companyPhone,
      COMPANY_ADDRESS: dto.companyAddress,
      COMPANY_BANK_REF: dto.bankRef,
      COMPANY_LOGO_URL: dto.logoUrl,
      TICKET_HEADER_NOTE: dto.ticketHeaderNote,
      TICKET_FOOTER_NOTE: dto.ticketFooterNote,
      TICKET_PROVIDER_INFO: dto.ticketProviderInfo,
      TICKET_VALIDITY_DAYS: dto.ticketValidityDays !== undefined ? String(dto.ticketValidityDays) : undefined,
      MARIAGE_GRATUIT_NOTE: dto.mariageGratuitNote,
    };

    for (const [key, value] of Object.entries(keysMap)) {
      if (value !== undefined) {
        await this.prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value, description: `Paramètre loterie: ${key}` },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: 'LOTTERY_SETTINGS_UPDATED',
      resource: 'SystemSetting:Lottery',
      newPayload: dto,
    });

    this.logger.log(`Paramètres de loterie mis à jour par l’administrateur ${userId}`);

    return this.getSettings();
  }

  /**
   * Remise à zéro complète de la base de données pour livraison d'une plateforme vierge en production.
   * Supprime toutes les transactions, tous les tickets, les tirages de test, les terminaux, les blocages,
   * les logs d'audit et (par défaut) les comptes vendeurs de test.
   * Conserve uniquement les administrateurs (SUPER_ADMIN / ADMIN), les 6 loteries officielles et les paramètres système.
   */
  async resetPlatformData(userId?: string, deleteVendors: boolean = true) {
    const result = await this.prisma.$transaction(async (tx) => {
      const deletedTransactions = await tx.transaction.deleteMany({});
      const deletedTickets = await tx.ticket.deleteMany({});
      const deletedBlockedNumbers = await tx.blockedNumber.deleteMany({});
      const deletedCommissions = await tx.commission.deleteMany({});
      const deletedDevices = await tx.device.deleteMany({});
      const deletedDraws = await tx.draw.deleteMany({});
      const deletedAuditLogs = await tx.auditLog.deleteMany({});

      let deletedVendorsCount = 0;
      if (deleteVendors) {
        // Supprimer les jetons des utilisateurs vendeurs
        const vendorUsers = await tx.user.findMany({
          where: { role: Role.VENDOR },
          select: { id: true },
        });
        const vendorUserIds = vendorUsers.map((u) => u.id);

        if (vendorUserIds.length > 0) {
          await tx.refreshToken.deleteMany({
            where: { userId: { in: vendorUserIds } },
          });
        }

        const deletedVendors = await tx.vendor.deleteMany({});
        deletedVendorsCount = deletedVendors.count;

        await tx.user.deleteMany({
          where: { role: Role.VENDOR },
        });
      } else {
        // Remettre tous les soldes vendeurs à 0 HTG
        await tx.vendor.updateMany({
          data: { currentBalance: 0 },
        });
      }

      // S'assurer que le montant minimum de mise est bien à 1 HTG sur tous les jeux officiels
      await tx.game.updateMany({
        data: { minBetAmount: 1.0 },
      });

      return {
        transactionsDeleted: deletedTransactions.count,
        ticketsDeleted: deletedTickets.count,
        drawsDeleted: deletedDraws.count,
        devicesDeleted: deletedDevices.count,
        blockedNumbersDeleted: deletedBlockedNumbers.count,
        commissionsDeleted: deletedCommissions.count,
        auditLogsDeleted: deletedAuditLogs.count,
        vendorsDeleted: deletedVendorsCount,
        deleteVendors,
      };
    });

    if (userId) {
      await this.auditService.log({
        userId,
        action: 'PLATFORM_RESET_TO_VIRGIN',
        resource: 'Database:FullReset',
        newPayload: result,
      });
    }

    this.logger.warn(`🧹 Plateforme remise à zéro (vierge) avec succès : ${JSON.stringify(result)}`);

    return {
      success: true,
      message: deleteVendors
        ? 'La base de données a été intégralement vidée (transactions, tickets, tirages, terminaux et vendeurs de test supprimés). La plateforme est 100% vierge.'
        : 'Toutes les transactions, tickets et tirages ont été effacés et les soldes vendeurs ont été remis à 0 HTG.',
      details: result,
    };
  }
}

