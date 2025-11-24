// prisma/seed.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Limpando dados antigos...");

  await prisma.progress.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.user.deleteMany();

  console.log("Criando usuários...");

  const usersData = [
    {
      name: "Sanjay (Admin)",
      email: "admin@clinica.com",
      password: "admin123",
      role: "admin",
      unit: "Diretoria",
    },
    {
      name: "Ana – Adm. Técnica",
      email: "ana@clinica.com",
      password: "ana123",
      role: "user",
      unit: "Adm Técnica",
    },
    {
      name: "Marcia – Marketing",
      email: "marcia@clinica.com",
      password: "marcia123",
      role: "user",
      unit: "Marketing",
    },
    {
      name: "Gabriel – Atendimento",
      email: "gabriel@clinica.com",
      password: "gabriel123",
      role: "user",
      unit: "Atendimento",
    },
    {
      name: "Michelle – Recepção",
      email: "michelle@clinica.com",
      password: "michelle123",
      role: "user",
      unit: "Recepção",
    },
  ];

  const usersByEmail = {};

  for (const u of usersData) {
    const created = await prisma.user.create({ data: u });
    usersByEmail[created.email] = created;
  }

  console.log("Criando KPIs...");

  const kpisData = [
    {
      name: "Vídeos nas redes sociais",
      description:
        "Postar 8 vídeos mensais (mínimo 2 por semana) nas redes sociais da clínica.",
      unitType: "unidades",
      periodicity: "semanal+mensal",
      targetWeekly: 2,
      targetMonthly: 8,
      ownerEmail: "ana@clinica.com",
    },
    {
      name: "Ligações para lista fria",
      description:
        "Realizar ligações ativas para lista fria de pacientes, buscando reativação e agendamento.",
      unitType: "unidades",
      periodicity: "semanal+mensal",
      targetWeekly: 40,
      targetMonthly: 160,
      ownerEmail: "gabriel@clinica.com",
    },
    {
      name: "Comparecimento em consultas confirmadas",
      description:
        "Garantir que os pacientes confirmados compareçam à consulta agendada.",
      unitType: "percentual",
      periodicity: "mensal",
      targetWeekly: null,
      targetMonthly: 90,
      ownerEmail: "michelle@clinica.com",
    },
    {
      name: "NPS – Satisfação dos pacientes",
      description:
        "Aplicar pesquisa rápida de satisfação (NPS) e manter nota média alta.",
      unitType: "percentual",
      periodicity: "mensal",
      targetWeekly: null,
      targetMonthly: 85,
      ownerEmail: "ana@clinica.com",
    },
    {
      name: "Vendas de planos odontológicos",
      description:
        "Meta de venda de planos/serviços odontológicos da clínica no mês.",
      unitType: "valor",
      periodicity: "mensal",
      targetWeekly: null,
      targetMonthly: 30000,
      ownerEmail: "marcia@clinica.com",
    },
  ];

  for (const k of kpisData) {
    const owner = usersByEmail[k.ownerEmail];
    if (!owner) {
      console.warn(`Usuário não encontrado para KPI: ${k.name}`);
      continue;
    }

    await prisma.kpi.create({
      data: {
        name: k.name,
        description: k.description,
        unitType: k.unitType,
        periodicity: k.periodicity,
        targetWeekly: k.targetWeekly,
        targetMonthly: k.targetMonthly,
        ownerId: owner.id,
      },
    });
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
