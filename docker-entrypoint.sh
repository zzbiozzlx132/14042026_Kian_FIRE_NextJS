#!/bin/sh
set -e

echo "=== KianFIRE: Running DB Migration ==="
# Use prisma db push to sync schema with database
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "DB Push failed, retrying in 3s..."
  sleep 3
  npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "DB Push still failing - tables may already exist"
}

echo "=== KianFIRE: Running Seed ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  try {
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
    } else {
      console.log('Categories already exist (' + catCount + ')');
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
    } else {
      console.log('Accounts already exist (' + accCount + ')');
    }

    // 4. Life plan settings
    const settings = await prisma.lifePlanSettings.findFirst();
    if (!settings) {
      await prisma.lifePlanSettings.create({
        data: { id: 'default', currentAge: 27, targetAge: 40, expectedReturnPct: 10, inflationPct: 3, swrPct: 4 }
      });
      console.log('Created life plan settings');
    } else {
      console.log('Life plan settings already exist');
    }

    console.log('=== Seed completed ===');
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await prisma.\$disconnect();
  }
}

seed();
" 2>&1

echo "=== KianFIRE: Starting Next.js ==="
exec node server.js
