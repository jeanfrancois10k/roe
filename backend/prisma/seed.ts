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
