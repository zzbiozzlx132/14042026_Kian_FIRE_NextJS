import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // 1. Create Admin User
  const password = await bcrypt.hash('123456', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kiantr.com' },
    update: {},
    create: {
      email: 'admin@kiantr.com',
      name: 'Kian',
      password,
      role: 'ADMIN',
    },
  })
  console.log(`Created admin user: ${admin.email}`)

  // 2. Default Categories
  const categories = [
    { name: "Ăn uống", type: "EXPENSE", icon: "utensils", sortOrder: 1 },
    { name: "Đi lại", type: "EXPENSE", icon: "car", sortOrder: 2 },
    { name: "Nhà ở", type: "EXPENSE", icon: "home", sortOrder: 3 },
    { name: "Điện nước", type: "EXPENSE", icon: "zap", sortOrder: 4 },
    { name: "Internet & ĐT", type: "EXPENSE", icon: "wifi", sortOrder: 5 },
    { name: "Sức khỏe", type: "EXPENSE", icon: "heart-pulse", sortOrder: 6 },
    { name: "Giáo dục", type: "EXPENSE", icon: "graduation-cap", sortOrder: 7 },
    { name: "Giải trí", type: "EXPENSE", icon: "gamepad-2", sortOrder: 8 },
    { name: "Mua sắm", type: "EXPENSE", icon: "shopping-bag", sortOrder: 9 },
    { name: "Làm đẹp", type: "EXPENSE", icon: "sparkles", sortOrder: 10 },
    { name: "Gia đình", type: "EXPENSE", icon: "users", sortOrder: 11 },
    { name: "Chi phí khác", type: "EXPENSE", icon: "more-horizontal", sortOrder: 12 },
    
    { name: "Lương", type: "INCOME", icon: "banknote", sortOrder: 1 },
    { name: "Thưởng", type: "INCOME", icon: "gift", sortOrder: 2 },
    { name: "Đầu tư", type: "INCOME", icon: "trending-up", sortOrder: 3 },
    { name: "Freelance", type: "INCOME", icon: "laptop", sortOrder: 4 },
    { name: "Thu nhập khác", type: "INCOME", icon: "plus-circle", sortOrder: 5 },
    
    { name: "Chuyển khoản", type: "TRANSFER", icon: "arrow-right-left", sortOrder: 1 },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      // We don't have a unique constraint on name+type, but we can just use createMany in a real scenario
      // For seed, we'll try to find first to avoid duplicates
      where: { id: `seed_${cat.name}_${cat.type}` }, // Faking unique ID for upsert using uuid or just create if not found
      update: {},
      create: {
        id: `cat_${cat.type}_${cat.sortOrder}`,
        name: cat.name,
        type: cat.type as any,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      }
    }).catch(async (e) => {
        // If it fails because ID exists, ignore. If it is another error, log it.
        const existing = await prisma.category.findFirst({
            where: { name: cat.name, type: cat.type as any }
        })
        if (!existing) {
            await prisma.category.create({
                data: {
                    name: cat.name,
                    type: cat.type as any,
                    icon: cat.icon,
                    sortOrder: cat.sortOrder,
                }
            })
        }
    })
  }
  console.log('Created default categories')

  // 3. Default Goals
  const goals = [
    { name: "Quỹ khẩn cấp 6 tháng", type: "EMERGENCY", priority: 1, emergencyMonths: 6 },
    { name: "Trả sạch nợ", type: "DEBT_FREE", priority: 2 },
    { name: "Mục tiêu FIRE", type: "FIRE", priority: 3 },
  ]
  
  for (const goal of goals) {
    const existing = await prisma.goal.findFirst({ where: { type: goal.type as any } })
    if (!existing) {
        await prisma.goal.create({
            data: {
                name: goal.name,
                type: goal.type as any,
                priority: goal.priority,
                emergencyMonths: goal.emergencyMonths || 6
            }
        })
    }
  }
  console.log('Created default goals')

  // 4. Default Life Plan Settings
  await prisma.lifePlanSettings.upsert({
      where: { id: "default" },
      update: {},
      create: {
          id: "default",
          currentAge: 27,
          targetAge: 40,
          expectedReturnPct: 10,
          inflationPct: 3,
          swrPct: 4
      }
  })
  console.log('Created default life plan settings')

  console.log('=== SEEDING COMPLETED ===')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
