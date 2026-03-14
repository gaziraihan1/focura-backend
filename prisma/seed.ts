import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plans...');

  await prisma.plan.createMany({
    data: [
      {
        name:                'FREE',
        displayName:         'Free',
        maxWorkspacesOwned:  1,
        maxMembersPerWs:     5,
        maxStorageMb:        1024,
        maxFileSizeMb:       5,
        maxMeetingsPerMo:    10,
        maxProjects:         3,
        analyticsAccess:     false,
        prioritySupport:     false,
        apiAccess:           false,
        monthlyPriceCents:   0,
        yearlyPriceCents:    0,
        sortOrder:           0,
      },
      {
        name:                 'PRO',
        displayName:          'Pro',
        maxWorkspacesOwned:   3,
        maxMembersPerWs:      25,
        maxStorageMb:         10000,
        maxFileSizeMb:        50,
        maxMeetingsPerMo:     -1,
        maxProjects:          -1,
        analyticsAccess:      true,
        prioritySupport:      false,
        apiAccess:            false,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
        stripePriceIdYearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
        monthlyPriceCents:    1200,
        yearlyPriceCents:     12000,
        sortOrder:            1,
      },
      {
        name:                 'BUSINESS',
        displayName:          'Business',
        maxWorkspacesOwned:   -1,
        maxMembersPerWs:      -1,
        maxStorageMb:         100000,
        maxFileSizeMb:        100,
        maxMeetingsPerMo:     -1,
        maxProjects:          -1,
        analyticsAccess:      true,
        prioritySupport:      true,
        apiAccess:            true,
        stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
        stripePriceIdYearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY,
        monthlyPriceCents:    4900,
        yearlyPriceCents:     48000,
        sortOrder:            2,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Plans seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });