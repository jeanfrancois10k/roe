import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const logoPath = 'C:\\Users\\herod\\OneDrive\\Desktop\\ROE\\assets\\logo_roe_bolet.png';
  if (!fs.existsSync(logoPath)) {
    console.error('Logo file does not exist at:', logoPath);
    return;
  }

  const fileBytes = fs.readFileSync(logoPath);
  const base64Data = 'data:image/png;base64,' + fileBytes.toString('base64');
  console.log('Read logo file successfully, length:', base64Data.length);

  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_LOGO_URL' },
    update: { value: base64Data },
    create: {
      key: 'COMPANY_LOGO_URL',
      value: base64Data,
      description: 'Logo officiel ROE BOLET (Base64 data URI)',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_NAME' },
    update: { value: 'ROE BOLET' },
    create: { key: 'COMPANY_NAME', value: 'ROE BOLET', description: 'Nom commercial officiel' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_SLOGAN' },
    update: { value: 'Juétwèt' },
    create: { key: 'COMPANY_SLOGAN', value: 'Juétwèt', description: 'Slogan officiel' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_PHONE' },
    update: { value: '42327120' },
    create: { key: 'COMPANY_PHONE', value: '42327120', description: 'Téléphone' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_BANK_REF' },
    update: { value: 'Bank 6' },
    create: { key: 'COMPANY_BANK_REF', value: 'Bank 6', description: 'Référence banque' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'TICKET_HEADER_NOTE' },
    update: { value: '*** ORIGINAL FICHE ***' },
    create: { key: 'TICKET_HEADER_NOTE', value: '*** ORIGINAL FICHE ***', description: 'Entête ticket' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'TICKET_FOOTER_NOTE' },
    update: { value: 'FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.' },
    create: { key: 'TICKET_FOOTER_NOTE', value: 'FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.', description: 'Pied de page ticket' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'MARIAGE_GRATUIT_NOTE' },
    update: { value: 'MARYAJ GRATIS 1500 GDES' },
    create: { key: 'MARIAGE_GRATUIT_NOTE', value: 'MARYAJ GRATIS 1500 GDES', description: 'Mention mariage gratuit' },
  });

  console.log('Successfully seeded company settings and logo into PostgreSQL!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
