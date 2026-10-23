import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation du Seed ROE BOLET (Plateforme Vierge)...');

  // 1. Création ou conservation du Super Administrateur
  const adminPasswordHash = await bcrypt.hash('AdminSecret2026!', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {
      isActive: true,
      role: Role.SUPER_ADMIN,
    },
    create: {
      username: 'superadmin',
      email: 'admin@roebolet.com',
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super Administrateur vérifié: ${admin.username}`);

  // 2. Création des 6 Loteries Officielles ROE BOLET (Mise min: 1 HTG)
  const officialGames = [
    {
      code: 'BOLET_CHI',
      name: 'Bolet Chicago (Midi & Soir)',
      description: 'Loterie officielle Illinois / Chicago - Tirages Midi (13h20) & Soir (22h00)',
      drawFrequency: 'DAILY_13H20_22H00',
    },
    {
      code: 'BOLET_FL',
      name: 'Bolet Florida (Midi & Soir)',
      description: 'Loterie officielle Florida State - Tirages Midi (13h30) & Soir (21h30)',
      drawFrequency: 'DAILY_13H_21H',
    },
    {
      code: 'BOLET_GA',
      name: 'Bolet Georgia (Midi & Soir)',
      description: 'Loterie officielle Georgia - Tirages Midi (12h20) & Soir (18h50 / 23h00)',
      drawFrequency: 'DAILY_12H20_23H00',
    },
    {
      code: 'BOLET_NY',
      name: 'Bolet New York (Midi & Soir)',
      description: 'Loterie traditionnelle New York - Borlette 1er/2e/3e lot, Mariage, Lòt 3, Lòt 4',
      drawFrequency: 'DAILY_14H_22H',
    },
    {
      code: 'BOLET_TN',
      name: 'Bolet Tennessee (Midi & Soir)',
      description: 'Loterie officielle Tennessee - Tirages Midi (13h20) & Soir (19h20)',
      drawFrequency: 'DAILY_13H20_19H20',
    },
    {
      code: 'BOLET_TX',
      name: 'Bolet Texas (Midi & Soir)',
      description: 'Loterie officielle Texas - Tirages Midi (13h20) & Soir (22h10)',
      drawFrequency: 'DAILY_13H20_22H10',
    },
  ];

  for (const g of officialGames) {
    const game = await prisma.game.upsert({
      where: { code: g.code },
      update: {
        name: g.name,
        description: g.description,
        status: 'ACTIVE',
        minBetAmount: 1.0,
        maxBetAmount: 5000.0,
      },
      create: {
        code: g.code,
        name: g.name,
        description: g.description,
        status: 'ACTIVE',
        minBetAmount: 1.0,
        maxBetAmount: 5000.0,
        drawFrequency: g.drawFrequency,
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
    console.log(`✅ Loterie officielle initialisée: ${game.name} (${game.code})`);
  }

  console.log('🎉 Seed ROE BOLET terminé avec succès (Plateforme Vierge) !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur de Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
