import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function purgeAllVendors() {
  console.log('🧹 Début du nettoyage complet de tous les comptes vendeurs...');

  // 1. Déconnexion / suppression des terminaux POS
  const deletedDevices = await prisma.device.deleteMany({});
  console.log(`- Terminaux POS supprimés: ${deletedDevices.count}`);

  // 2. Suppression des grilles de commission par vendeur
  const deletedCommissions = await prisma.commission.deleteMany({});
  console.log(`- Commissions personnalisées supprimées: ${deletedCommissions.count}`);

  // 3. Suppression des transactions financières résiduelles des vendeurs
  const deletedTransactions = await prisma.transaction.deleteMany({});
  console.log(`- Transactions supprimées: ${deletedTransactions.count}`);

  // 4. Suppression des tickets résiduels
  const deletedTickets = await prisma.ticket.deleteMany({});
  console.log(`- Tickets supprimés: ${deletedTickets.count}`);

  // 5. Suppression des profils Vendeur
  const deletedVendors = await prisma.vendor.deleteMany({});
  console.log(`- Profils Vendeur supprimés: ${deletedVendors.count}`);

  // 6. Suppression des utilisateurs ayant le rôle VENDOR
  const deletedVendorUsers = await prisma.user.deleteMany({
    where: { role: 'VENDOR' },
  });
  console.log(`- Comptes utilisateurs VENDOR supprimés: ${deletedVendorUsers.count}`);

  // Vérification des utilisateurs restants (doit rester uniquement SUPER_ADMIN)
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
  });
  console.log('✅ Utilisateurs restants en base (uniquement Super Admin) :', remainingUsers);

  const remainingVendors = await prisma.vendor.count();
  console.log(`✅ Nombre total de vendeurs restants : ${remainingVendors}`);
}

purgeAllVendors()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
