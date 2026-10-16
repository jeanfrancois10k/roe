import { PrismaClient, Role, VendorStatus, DeviceStatus, DrawStatus, Currency } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 [ROE BOLET] Nettoyage complet des données de test et réinitialisation en HTG...');

  // 1. Suppression des données éphémères et de test
  const deletedTickets = await prisma.ticket.deleteMany({});
  console.log(`🗑️  Tickets de test supprimés : ${deletedTickets.count}`);

  const deletedTx = await prisma.transaction.deleteMany({});
  console.log(`🗑️  Transactions de test supprimées : ${deletedTx.count}`);

  const deletedDraws = await prisma.draw.deleteMany({});
  console.log(`🗑️  Tirages de test supprimés : ${deletedDraws.count}`);

  const deletedAudits = await prisma.auditLog.deleteMany({});
  console.log(`🗑️  Pistes d’audit de test purgées : ${deletedAudits.count}`);

  const deletedCommissions = await prisma.commission.deleteMany({});
  console.log(`🗑️  Règles de commission temporaires supprimées : ${deletedCommissions.count}`);

  // 2. Initialisation des paramètres système : Priorité HTG (Gourde Haïtienne)
  await prisma.systemSetting.upsert({
    where: { key: 'DEFAULT_CURRENCY' },
    update: { value: 'HTG', description: 'Devise monétaire principale de la plateforme (Gourde Haïtienne)' },
    create: { key: 'DEFAULT_CURRENCY', value: 'HTG', description: 'Devise monétaire principale de la plateforme (Gourde Haïtienne)' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'CURRENCY_SYMBOL' },
    update: { value: 'G', description: 'Symbole monétaire usuel en Haïti' },
    create: { key: 'CURRENCY_SYMBOL', value: 'G', description: 'Symbole monétaire usuel en Haïti' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'SUPPORTED_CURRENCIES' },
    update: { value: JSON.stringify(['HTG', 'USD']), description: 'Devises acceptées sur la plateforme' },
    create: { key: 'SUPPORTED_CURRENCIES', value: JSON.stringify(['HTG', 'USD']), description: 'Devises acceptées sur la plateforme' },
  });

  console.log('✅ Paramètres système initialisés : Devise prioritaire = HTG (Gourde)');

  // 3. Super Administrateur officiel
  const adminPasswordHash = await bcrypt.hash('AdminSecret2026!', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { isActive: true },
    create: {
      username: 'superadmin',
      email: 'admin@roebolet.com',
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super Administrateur vérifié : ${admin.username}`);

  // 4. Vendeur Pilote officiel avec solde propre en Gourdes (0.00 G)
  const vendorPasswordHash = await bcrypt.hash('VendorSecret2026!', 12);
  const vendorPinHash = await bcrypt.hash('1234', 12);

  const vendorUser = await prisma.user.upsert({
    where: { username: 'vendeur001' },
    update: { isActive: true },
    create: {
      username: 'vendeur001',
      email: 'vendeur001@roebolet.com',
      passwordHash: vendorPasswordHash,
      pinHash: vendorPinHash,
      role: Role.VENDOR,
      isActive: true,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { vendorCode: 'VEND-001' },
    update: {
      currentBalance: 0.00,
      creditLimit: 5000.00, // Découvert toléré : 5 000 Gourdes
      dailySalesLimit: 100000.00, // Plafond journalier : 100 000 Gourdes
      maxTicketAmount: 10000.00, // Max par ticket : 10 000 Gourdes
      status: VendorStatus.ACTIVE,
    },
    create: {
      userId: vendorUser.id,
      vendorCode: 'VEND-001',
      fullName: 'Jean-Baptiste Vendeur',
      phone: '+509 3700 0001',
      posAddress: 'Point de Vente 01 - Centre Ville',
      status: VendorStatus.ACTIVE,
      currentBalance: 0.00,
      creditLimit: 5000.00,
      dailySalesLimit: 100000.00,
      maxTicketAmount: 10000.00,
      defaultCommissionRate: 5.00,
    },
  });
  console.log(`✅ Vendeur ${vendor.vendorCode} réinitialisé avec un solde propre de 0.00 G`);

  // Terminal Android associé
  await prisma.device.upsert({
    where: { deviceUuid: 'ANDROID-DEVICE-ALPHA-001' },
    update: { status: DeviceStatus.AUTHORIZED, isOnline: false },
    create: {
      vendorId: vendor.id,
      deviceUuid: 'ANDROID-DEVICE-ALPHA-001',
      deviceModel: 'Sunmi V2 POS Terminal',
      osVersion: 'Android 11',
      appVersion: '1.0.0-PROD',
      status: DeviceStatus.AUTHORIZED,
      isOnline: false,
    },
  });

  // 5. Configuration des Jeux Officiels Borlette en Gourdes (HTG)
  const rules = {
    borlette: {
      firstPrizeMultiplier: 50,  // 1er lot : 50x la mise (ex: 10 G -> 500 G)
      secondPrizeMultiplier: 20, // 2e lot  : 20x la mise (ex: 10 G -> 200 G)
      thirdPrizeMultiplier: 10,  // 3e lot  : 10x la mise (ex: 10 G -> 100 G)
    },
    mariage: {
      multiplier: 1000,          // Mariage : 1 000x la mise (ex: 5 G -> 5 000 G)
    },
    lot3: {
      multiplier: 500,           // Lòt 3 : 500x la mise (ex: 5 G -> 2 500 G)
    },
    lot4: {
      multiplier: 5000,          // Lòt 4 : 5 000x la mise (ex: 2 G -> 10 000 G)
    },
  };

  const officialLotteries = [
    {
      code: 'BOLET_NY',
      name: 'Bolet New York (Midi & Soir)',
      description: 'Loterie traditionnelle New York (NY) - Tirages 12:30 PM & 07:30 PM',
      drawFrequency: '12:30 PM & 07:30 PM',
    },
    {
      code: 'BOLET_FL',
      name: 'Bolet Florida (Midi & Soir)',
      description: 'Loterie officielle Florida (FL) - Tirages 01:30 PM & 09:30 PM',
      drawFrequency: '01:30 PM & 09:30 PM',
    },
    {
      code: 'BOLET_GA',
      name: 'Bolet Géorgie (GA)',
      description: 'Loterie officielle Géorgie (GA) - Tirages 12:29 PM & 07:00 PM',
      drawFrequency: '12:29 PM & 07:00 PM',
    },
    {
      code: 'BOLET_TX',
      name: 'Bolet Texas (TX)',
      description: 'Loterie officielle Texas (TX) - Tirages 12:27 PM & 10:12 PM',
      drawFrequency: '12:27 PM & 10:12 PM',
    },
    {
      code: 'BOLET_TN',
      name: 'Bolet Tennessee (TN)',
      description: 'Loterie officielle Tennessee (TN) - Tirages 12:28 PM & 06:28 PM',
      drawFrequency: '12:28 PM & 06:28 PM',
    },
  ];

  let gameNY: any = null;
  for (const lotto of officialLotteries) {
    const game = await prisma.game.upsert({
      where: { code: lotto.code },
      update: {
        name: lotto.name,
        description: lotto.description,
        minBetAmount: 5.00,
        maxBetAmount: 2500.00,
        currency: Currency.HTG,
        drawFrequency: lotto.drawFrequency,
        gameRules: rules,
      },
      create: {
        code: lotto.code,
        name: lotto.name,
        description: lotto.description,
        minBetAmount: 5.00,
        maxBetAmount: 2500.00,
        currency: Currency.HTG,
        drawFrequency: lotto.drawFrequency,
        defaultCommission: 5.00,
        gameRules: rules,
      },
    });
    if (lotto.code === 'BOLET_NY') gameNY = game;
  }
  console.log(`✅ ${officialLotteries.length} Jeux réinitialisés en Gourdes (HTG) : NY, FL, GA, TX, TN`);

  // 6. Nouveau Tirage propre N° 101 ouvert pour aujourd'hui
  const now = new Date();
  const scheduledTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // Dans 4 heures
  const salesClosingTime = new Date(now.getTime() + 3.5 * 60 * 60 * 1000); // Clôture dans 3h30

  const draw = await prisma.draw.create({
    data: {
      drawNumber: 101,
      gameId: gameNY.id,
      scheduledAt: scheduledTime,
      salesClosingAt: salesClosingTime,
      status: DrawStatus.OPEN,
    },
  });
  console.log(`✅ Nouveau Tirage propre N°${draw.drawNumber} ouvert pour ${gameNY.name}`);

  // 7. Entrée d’audit de traçabilité
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'PLATFORM_CLEANED_AND_RESET_TO_HTG',
      resource: 'SystemSettings',
      newPayload: {
        currency: 'HTG',
        symbol: 'G',
        resetAt: new Date().toISOString(),
        operator: admin.username,
      },
    },
  });

  console.log('\n🎉 Nettoyage et initialisation terminés avec succès ! La plateforme est 100% propre et configurée en HTG.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
