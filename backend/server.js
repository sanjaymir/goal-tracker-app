// server.js - Goal Tracker – backend com Prisma + SQLite + JWT + Backup + CORS

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// ===== CORS (dev + produção) =====

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  // troque abaixo pela URL REAL do Netlify
  "sorridentsqms.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // chamadas sem origin (curl, Postman, etc) → libera
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin não permitido pelo CORS"), false);
    },
  })
);

app.use(express.json());

// ===== ROTA TESTE =====

app.get("/", (req, res) => {
  res.json({ ok: true, message: "API Goal Tracker rodando" });
});

// ===== LOGIN (gera JWT, mas ainda não obriga nas outras rotas) =====

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    // Gera token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Front espera { token, user }
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        unit: user.unit,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// ===== USERS =====

// listar usuários (sem senha)
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
      },
    });
    res.json(users);
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

// criar usuário
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, unit } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Nome, e-mail e senha são obrigatórios." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res
        .status(409)
        .json({ error: "Já existe um usuário com esse e-mail." });
    }

    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        password: String(password),
        role: "user",
        unit: (unit || "Clínica").trim(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
      },
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// deletar usuário + KPIs + progresso dele
app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (user.role === "admin") {
      return res
        .status(400)
        .json({ error: "Não é permitido excluir o usuário admin." });
    }

    // Relações com onDelete: Cascade no schema
    await prisma.user.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar usuário:", err);
    res.status(500).json({ error: "Erro ao deletar usuário." });
  }
});

// ===== KPIS =====

// listar KPIs
app.get("/api/kpis", async (req, res) => {
  try {
    const kpis = await prisma.kpi.findMany();
    res.json(kpis);
  } catch (err) {
    console.error("Erro ao listar KPIs:", err);
    res.status(500).json({ error: "Erro ao listar KPIs." });
  }
});

// criar KPI
app.post("/api/kpis", async (req, res) => {
  try {
    const {
      name,
      description,
      unitType,
      periodicity,
      targetWeekly,
      targetMonthly,
      ownerId,
    } = req.body || {};

    if (!name || !unitType || !periodicity || !ownerId) {
      return res
        .status(400)
        .json({ error: "Dados obrigatórios faltando." });
    }

    const newKpi = await prisma.kpi.create({
      data: {
        name: String(name).trim(),
        description: String(description || "").trim(),
        unitType,
        periodicity,
        targetWeekly:
          periodicity === "semanal" || periodicity === "semanal+mensal"
            ? Number(targetWeekly || 0)
            : null,
        targetMonthly:
          periodicity === "mensal" || periodicity === "semanal+mensal"
            ? Number(targetMonthly || 0)
            : null,
        ownerId: Number(ownerId),
      },
    });

    res.status(201).json(newKpi);
  } catch (err) {
    console.error("Erro ao criar KPI:", err);
    res.status(500).json({ error: "Erro ao criar KPI." });
  }
});

// atualizar KPI
app.put("/api/kpis/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const existing = await prisma.kpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "KPI não encontrado." });
    }

    const {
      name,
      description,
      unitType,
      periodicity,
      targetWeekly,
      targetMonthly,
      ownerId,
    } = req.body || {};

    const data = {};

    if (name != null) data.name = String(name).trim();
    if (description != null) data.description = String(description).trim();
    if (unitType) data.unitType = unitType;

    if (periodicity) {
      data.periodicity = periodicity;
      data.targetWeekly =
        periodicity === "semanal" || periodicity === "semanal+mensal"
          ? Number(targetWeekly || 0)
          : null;
      data.targetMonthly =
        periodicity === "mensal" || periodicity === "semanal+mensal"
          ? Number(targetMonthly || 0)
          : null;
    } else {
      if (targetWeekly != null) data.targetWeekly = Number(targetWeekly);
      if (targetMonthly != null) data.targetMonthly = Number(targetMonthly);
    }

    if (ownerId != null) data.ownerId = Number(ownerId);

    const updated = await prisma.kpi.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar KPI:", err);
    res.status(500).json({ error: "Erro ao atualizar KPI." });
  }
});

// deletar KPI + progresso dele
app.delete("/api/kpis/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const existing = await prisma.kpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "KPI não encontrado." });
    }

    await prisma.progress.deleteMany({ where: { kpiId: id } });
    await prisma.kpi.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar KPI:", err);
    res.status(500).json({ error: "Erro ao deletar KPI." });
  }
});

// ===== PROGRESSO =====

// registrar progresso (upsert manual)
app.post("/api/progress", async (req, res) => {
  try {
    const { kpiId, periodType, periodKey, delivered, value, comment } =
      req.body || {};

    if (!kpiId || !periodType || !periodKey) {
      return res.status(400).json({ error: "Dados insuficientes." });
    }

    const kpiIdNum = Number(kpiId);
    if (Number.isNaN(kpiIdNum)) {
      return res.status(400).json({ error: "kpiId inválido." });
    }

    const existing = await prisma.progress.findFirst({
      where: { kpiId: kpiIdNum, periodType, periodKey },
    });

    if (existing) {
      await prisma.progress.update({
        where: { id: existing.id },
        data: {
          delivered: !!delivered,
          value: value || "",
          comment: comment || "",
        },
      });
    } else {
      await prisma.progress.create({
        data: {
          kpiId: kpiIdNum,
          periodType,
          periodKey,
          delivered: !!delivered,
          value: value || "",
          comment: comment || "",
        },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao registrar progresso:", err);
    res.status(500).json({ error: "Erro ao registrar progresso." });
  }
});

// pegar todo o progresso (formato: { "kpiId-periodType-periodKey": { delivered, value, comment } })
app.get("/api/progress", async (req, res) => {
  try {
    const rows = await prisma.progress.findMany();
    const result = {};

    for (const row of rows) {
      const key = `${row.kpiId}-${row.periodType}-${row.periodKey}`;
      result[key] = {
        delivered: row.delivered,
        value: row.value,
        comment: row.comment,
      };
    }

    res.json(result);
  } catch (err) {
    console.error("Erro ao buscar progresso:", err);
    res.status(500).json({ error: "Erro ao buscar progresso." });
  }
});

// ===== BACKUP (EXPORT / IMPORT) =====

// exporta tudo (users, kpis, progress)
app.get("/api/backup/export", async (req, res) => {
  try {
    const users = await prisma.user.findMany(); // inclui senha no backup
    const kpis = await prisma.kpi.findMany();
    const rows = await prisma.progress.findMany();

    const progress = {};
    for (const row of rows) {
      const key = `${row.kpiId}-${row.periodType}-${row.periodKey}`;
      progress[key] = {
        delivered: row.delivered,
        value: row.value,
        comment: row.comment,
      };
    }

    res.json({ users, kpis, progress });
  } catch (err) {
    console.error("Erro ao exportar backup:", err);
    res.status(500).json({ error: "Erro ao exportar backup." });
  }
});

// importa backup (substitui tudo no banco)
app.post("/api/backup/import", async (req, res) => {
  try {
    const { users, kpis, progress } = req.body || {};

    if (
      !Array.isArray(users) ||
      !Array.isArray(kpis) ||
      typeof progress !== "object" ||
      progress === null
    ) {
      return res.status(400).json({ error: "Formato de backup inválido." });
    }

    await prisma.$transaction(async (tx) => {
      // apaga tudo
      await tx.progress.deleteMany({});
      await tx.kpi.deleteMany({});
      await tx.user.deleteMany({});

      // recria usuários (com id, senha etc)
      if (users.length > 0) {
        await tx.user.createMany({
          data: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            password: u.password,
            role: u.role,
            unit: u.unit,
          })),
        });
      }

      // recria KPIs
      if (kpis.length > 0) {
        await tx.kpi.createMany({
          data: kpis.map((k) => ({
            id: k.id,
            name: k.name,
            description: k.description,
            unitType: k.unitType,
            periodicity: k.periodicity,
            targetWeekly: k.targetWeekly,
            targetMonthly: k.targetMonthly,
            ownerId: k.ownerId,
          })),
        });
      }

      // recria progressos
      const progressRows = [];

      for (const [key, value] of Object.entries(progress)) {
        const [kpiIdStr, periodType, periodKey] = key.split("-");
        const kpiId = Number(kpiIdStr);
        if (!kpiId || !periodType || !periodKey) continue;

        progressRows.push({
          kpiId,
          periodType,
          periodKey,
          delivered: !!value.delivered,
          value: value.value || "",
          comment: value.comment || "",
        });
      }

      if (progressRows.length > 0) {
        await tx.progress.createMany({ data: progressRows });
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao importar backup:", err);
    res.status(500).json({ error: "Erro ao importar backup." });
  }
});

// ===== START =====

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
