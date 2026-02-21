const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.count();
  console.log(`Users: ${users}`);
}
main().catch(e => console.error(e)).finally(async () => { await prisma.$disconnect(); });
