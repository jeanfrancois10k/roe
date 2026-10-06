import { PrismaClient, Role, VendorStatus, DeviceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation du Seed ROE BOLET...');

  // 1. Création du Super Administrateur
  const adminPasswordHash = await bcrypt.hash('AdminSecret2026!', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      email: 'admin@roebolet.com',
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super Administrateur initialisé: ${admin.username}`);

  // 2. Création d'un premier Vendeur Pilote (VENDEUR 001)
  const vendorPasswordHash = await bcrypt.hash('VendorSecret2026!', 12);
  const vendorPinHash = await bcrypt.hash('1234', 12);

  const vendorUser = await prisma.user.upsert({
    where: { username: 'vendeur001' },
    update: {},
    create: {
      username: 'vendeur001',
      email: 'vendeur001@roebolet.com',
      passwordHash: vendorPasswordHash,
      pinHash: vendorPinHash,
      role: Role.VENDOR,
      isActive: true,
    },
  });

  const vendorProfile = await prisma.vendor.upsert({
    where: { vendorCode: 'VEND-001' },
    update: {},
    create: {
      userId: vendorUser.id,
      vendorCode: 'VEND-001',
      fullName: 'Jean-Baptiste Vendeur',
      phone: '+509 3700 0001',
      posAddress: 'Point de Vente 01 - Centre Ville',
      status: VendorStatus.ACTIVE,
      currentBalance: 1000.00, // Solde initial de départ
      creditLimit: 500.00,    // Découvert autorisé
      dailySalesLimit: 5000.00,
      maxTicketAmount: 500.00,
      defaultCommissionRate: 5.00,
    },
  });
  console.log(`✅ Profil Vendeur initialisé: ${vendorProfile.vendorCode} (${vendorProfile.fullName})`);

  // 3. Liaison de son Terminal Android de test
  const device = await prisma.device.upsert({
    where: { deviceUuid: 'ANDROID-DEVICE-ALPHA-001' },
    update: {},
    create: {
      vendorId: vendorProfile.id,
      deviceUuid: 'ANDROID-DEVICE-ALPHA-001',
      deviceModel: 'Sunmi V2 POS Terminal',
      osVersion: 'Android 11',
      appVersion: '1.0.0',
      status: DeviceStatus.AUTHORIZED,
      isOnline: false,
    },
  });
  console.log(`✅ Terminal Android associé: ${device.deviceModel} (UUID: ${device.deviceUuid})`);

  // 4. Création des Jeux Officiels ROE BOLET (New York & Florida)
  const gameNY = await prisma.game.upsert({
    where: { code: 'BOLET_NY' },
    update: {},
    create: {
      code: 'BOLET_NY',
      name: 'Bolet New York (Midi & Soir)',
      description: 'Loterie traditionnelle New York - Borlette 1er/2e/3e lot, Mariage, Lòt 3, Lòt 4',
      status: 'ACTIVE',
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      drawFrequency: 'DAILY_14H_22H',
      defaultCommission: 5.0,
      gameRules: {
        gameTypes: ['BORLETTE', 'MARIAGE', 'LOT_3', 'LOT_4'],
        minPicks: 1,
        maxPicks: 4,
        multipliers: {
          firstPrize: 50,
          secondPrize: 20,
          thirdPrize: 10,
          mariage: 1000,
          lot3: 500,
        },
      },
    },
  });
  console.log(`✅ Jeu initialisé: ${gameNY.name} (${gameNY.code})`);

  const gameFL = await prisma.game.upsert({
    where: { code: 'BOLET_FL' },
    update: {},
    create: {
      code: 'BOLET_FL',
      name: 'Bolet Florida (Midi & Soir)',
      description: 'Loterie officielle Florida State - Tirages réguliers',
      status: 'ACTIVE',
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      drawFrequency: 'DAILY_13H_21H',
      defaultCommission: 5.0,
      gameRules: {
        gameTypes: ['BORLETTE', 'MARIAGE', 'LOT_3', 'LOT_4'],
        multipliers: {
          firstPrize: 50,
          secondPrize: 20,
          thirdPrize: 10,
          mariage: 1000,
          lot3: 500,
        },
      },
    },
  });
  console.log(`✅ Jeu initialisé: ${gameFL.name} (${gameFL.code})`);

  // 5. Création d'un Tirage Ouvert pour aujourd'hui
  const drawScheduledTime = new Date();
  drawScheduledTime.setHours(drawScheduledTime.getHours() + 4); // Dans 4 heures

  const drawClosingTime = new Date();
  drawClosingTime.setHours(drawClosingTime.getHours() + 3); // Clôture dans 3 heures

  const drawNY = await prisma.draw.upsert({
    where: {
      gameId_drawNumber: {
        gameId: gameNY.id,
        drawNumber: 101,
      },
    },
    update: {
      salesClosingAt: drawClosingTime,
      scheduledAt: drawScheduledTime,
      status: 'OPEN',
    },
    create: {
      gameId: gameNY.id,
      drawNumber: 101,
      scheduledAt: drawScheduledTime,
      salesClosingAt: drawClosingTime,
      status: 'OPEN',
    },
  });
  console.log(`✅ Tirage Ouvert planifié: N°${drawNY.drawNumber} pour ${gameNY.code} (Clôture: ${drawClosingTime.toLocaleTimeString()})`);

  console.log('🎉 Seed ROE BOLET terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur de Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
