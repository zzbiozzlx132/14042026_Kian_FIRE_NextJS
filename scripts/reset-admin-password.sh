#!/bin/sh
# Dùng khi Admin quên mật khẩu và không thể đăng nhập
# Chạy trên VPS (sau khi SSH vào):
#   bash /opt/kian-fire/scripts/reset-admin-password.sh matkhaumoi123

if [ -z "$1" ]; then
  echo "Usage: bash reset-admin-password.sh <mật-khẩu-mới>"
  exit 1
fi

NEW_PASS="$1"

docker exec kian-fire-web node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
bcrypt.hash('${NEW_PASS}', 10).then(hash =>
  prisma.user.updateMany({ where: { role: 'ADMIN' }, data: { password: hash } })
).then(result => {
  console.log('✅ Đã đặt lại mật khẩu cho', result.count, 'admin.');
  return prisma.\$disconnect();
}).catch(e => { console.error('❌ Lỗi:', e.message); process.exit(1); });
"
