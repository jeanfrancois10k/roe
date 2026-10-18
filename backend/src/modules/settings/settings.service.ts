import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { UpdateLotterySettingsDto } from './dto/update-lottery-settings.dto';
import { Currency } from '@prisma/client';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Récupère les paramètres de configuration système et la devise active
   */
  async getSettings() {
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
      latestVersionName: map.get('ANDROID_LATEST_VERSION') || '1.0.2',
      latestVersionCode: Number(map.get('ANDROID_LATEST_CODE') || '3'),
      apkUrl: map.get('ANDROID_APK_URL') || 'https://frontendroe.vercel.app/download/roe-bolet-vendor.apk',
      changelog: map.get('ANDROID_CHANGELOG') || 'Mise à jour v1.0.2 : Sélecteur de langue Kreyòl / Français, bouton de vérification de mise à jour, et amélioration des performances.',
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
}

