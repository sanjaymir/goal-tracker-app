// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plain), salt);
}

async function main() {
  console.log("Limpando dados antigos...");

  await prisma.progress.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.user.deleteMany();

  console.log("Criando usuários...");

  const usersData = [
    {
      name: "Sanjay Mir (Admin)",
      email: "sanjaymir@icloud.com",
      password: "Bhagwanmir92",
      role: "admin",
      unit: "Diretoria",
      mustChangePassword: false,
    },
  ];

  const usersByEmail = {};

  for (const u of usersData) {
    const created = await prisma.user.create({
      data: {
        ...u,
        password: await hashPassword(u.password),
      },
    });
    usersByEmail[created.email] = created;
  }

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
