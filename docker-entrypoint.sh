#!/bin/sh
set -e

echo "=== Running Prisma DB Push ==="
npx prisma db push --skip-generate 2>&1 || echo "DB Push warning (may already exist)"

echo "=== Running Seed ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  // 1. Admin user
  const existing = await prisma.user.findUnique({ where: { email: 'admin@kiantr.com' } });
  if (!existing) {
    const pw = await bcrypt.hash('Kian@2026', 10);
    await prisma.user.create({
      data: { email: 'admin@kiantr.com', name: 'Kian', password: pw, role: 'ADMIN' }
    });
    console.log('Created admin: admin@kiantr.com / Kian@2026');
  } else {
    console.log('Admin user already exists');
  }

  // 2. Categories
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    const cats = [
      { name: 'Ăn uống', type: 'EXPENSE', icon: 'utensils', sortOrder: 1 },
      { name: 'Đi lại', type: 'EXPENSE', icon: 'car', sortOrder: 2 },
      { name: 'Nhà ở', type: 'EXPENSE', icon: 'home', sortOrder: 3 },
      { name: 'Điện nước', type: 'EXPENSE', icon: 'zap', sortOrder: 4 },
      { name: 'Internet & ĐT', type: 'EXPENSE', icon: 'wifi', sortOrder: 5 },
      { name: 'Sức khỏe', type: 'EXPENSE', icon: 'heart-pulse', sortOrder: 6 },
      { name: 'Giáo dục', type: 'EXPENSE', icon: 'graduation-cap', sortOrder: 7 },
      { name: 'Giải trí', type: 'EXPENSE', icon: 'gamepad-2', sortOrder: 8 },
      { name: 'Mua sắm', type: 'EXPENSE', icon: 'shopping-bag', sortOrder: 9 },
      { name: 'Làm đẹp', type: 'EXPENSE', icon: 'sparkles', sortOrder: 10 },
      { name: 'Gia đình', type: 'EXPENSE', icon: 'users', sortOrder: 11 },
      { name: 'Chi phí khác', type: 'EXPENSE', icon: 'more-horizontal', sortOrder: 12 },
      { name: 'Lương', type: 'INCOME', icon: 'banknote', sortOrder: 1 },
      { name: 'Thưởng', type: 'INCOME', icon: 'gift', sortOrder: 2 },
      { name: 'Đầu tư', type: 'INCOME', icon: 'trending-up', sortOrder: 3 },
      { name: 'Freelance', type: 'INCOME', icon: 'laptop', sortOrder: 4 },
      { name: 'Thu nhập khác', type: 'INCOME', icon: 'plus-circle', sortOrder: 5 },
    ];
    for (const c of cats) {
      await prisma.category.create({ data: c });
    }
    console.log('Created ' + cats.length + ' categories');
  }

  // 3. Default accounts
  const accCount = await prisma.account.count();
  if (accCount === 0) {
    await prisma.account.createMany({
      data: [
        { name: 'Ví tiền mặt', type: 'CASH', initialBalance: 0 },
        { name: 'Ngân hàng chính', type: 'BANK', initialBalance: 0 },
        { name: 'Ví Momo', type: 'E_WALLET', initialBalance: 0 },
      ]
    });
    console.log('Created default accounts');
  }

  // 4. Life plan settings
  const settings = await prisma.lifePlanSettings.findFirst();
  if (!settings) {
    await prisma.lifePlanSettings.create({
      data: { id: 'default', currentAge: 27, targetAge: 40, expectedReturnPct: 10, inflationPct: 3, swrPct: 4 }
    });
    console.log('Created life plan settings');
  }

  await prisma.\$disconnect();
  console.log('=== Seed completed ===');
}

seed().catch(e => { console.error('Seed error:', e); process.exit(0); });
" 2>&1 || echo "Seed warning"

echo "=== Starting Next.js ==="
exec node server.js
