import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
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

    return {
      defaultCurrency,
      currencySymbol,
      currencyName: defaultCurrency === Currency.HTG ? 'Gourde Haïtienne' : 'Dollar Américain',
      supportedCurrencies,
      isHtgDefault: defaultCurrency === Currency.HTG,
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
      latestVersionName: map.get('ANDROID_LATEST_VERSION') || '1.0.1',
      latestVersionCode: Number(map.get('ANDROID_LATEST_CODE') || '2'),
      apkUrl: map.get('ANDROID_APK_URL') || 'https://frontendroe.vercel.app/download/roe-bolet-vendor.apk',
      changelog: map.get('ANDROID_CHANGELOG') || 'Mise à jour majeure : Logo officiel, modules interactifs (Vente, Résultats, Solde, Historique).',
      isMandatory: map.get('ANDROID_FORCE_UPDATE') === 'true',
    };
  }
}
