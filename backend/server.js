// server.js - Goal Tracker – backend com Prisma 6 + SQLite + JWT

const express = require("express");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// A aplicação roda atrás de proxy (Render), então
// habilitamos trust proxy para que o express-rate-limit
// consiga identificar corretamente o IP do cliente.
app.set("trust proxy", 1);

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET é obrigatório em produção.");
  }

  console.warn(
    "[dev-warning] JWT_SECRET não definido; usando segredo inseguro apenas para desenvolvimento."
  );
  return "dev-secret-super-simples";
})();

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 tentativas
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: { error: "Muitas requisições de refresh. Aguarde um pouco." },
});

const backupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: { error: "Muitas requisições. Aguarde um pouco." },
});

function getYearMonthFromWeekKey(weekKey) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(week)) return null;

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  const isoWeekStart = new Date(simple);
  isoWeekStart.setUTCDate(simple.getUTCDate() + 1 - dow);

  const month = isoWeekStart.getUTCMonth() + 1;
  const resultYear = isoWeekStart.getUTCFullYear();
  return { year: resultYear, month };
}

function getYearMonthFromDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  return { year, month };
}

// ===== MIDDLEWARES GERAIS =====

app.use(
  cors({
    // Em produção estamos servindo o frontend e o backend no mesmo domínio.
    // Mantemos origin: true para refletir qualquer origem que fizer requisição,
    // e credentials: true para permitir cookies.
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(plain), salt);
}

function isBcryptHash(value) {
  return typeof value === "string" && value.startsWith("$2");
}

// memória simples para bloqueio de login por email
const loginFailures = new Map(); // email -> { count, until }
const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;

function isBlocked(email) {
  const entry = loginFailures.get(email);
  if (!entry) return false;
  if (entry.until && entry.until > Date.now()) return true;
  loginFailures.delete(email);
  return false;
}

function registerFailure(email) {
  const entry = loginFailures.get(email) || { count: 0, until: 0 };
  const count = entry.count + 1;
  const until = count >= MAX_ATTEMPTS ? Date.now() + BLOCK_WINDOW_MS : 0;
  loginFailures.set(email, { count, until });
}

function resetFailures(email) {
  loginFailures.delete(email);
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ===== EMAIL (ENV-BASED) =====

function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

function getMailFrom() {
  const raw = process.env.MAIL_FROM || "no-reply@goal-tracker.local";
  const emailMatch = raw.match(/<(.+?)>/);
  const nameMatch = raw.match(/"(.+?)"/);
  const email = emailMatch ? emailMatch[1] : raw;
  const name = nameMatch ? nameMatch[1] : "Goal Tracker";
  return { email, name };
}

async function sendResetEmailBrevo(toEmail, token) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn(
      "[mail] BREVO_API_KEY não definido; e-mails de recuperação NÃO serão enviados."
    );
    return;
  }

  const appBase = getAppBaseUrl().replace(/\/+$/, "");
  const resetLink = `${appBase}/?resetToken=${encodeURIComponent(token)}`;
  const { email: fromEmail, name: fromName } = getMailFrom();

  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email: toEmail }],
    subject: "Redefinição de senha – Goal Tracker",
    textContent: `Olá,

Foi solicitada a redefinição de senha da sua conta.

Acesse o link abaixo para definir uma nova senha (válido por 30 minutos):

${resetLink}

Se você não solicitou, ignore este e-mail.`,
    htmlContent: `<p>Olá,</p>
<p>Foi solicitada a redefinição de senha da sua conta.</p>
<p>Acesse o link abaixo para definir uma nova senha (válido por 30 minutos):</p>
<p><a href="${resetLink}">${resetLink}</a></p>
<p>Se você não solicitou, ignore este e-mail.</p>`,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[mail] Falha ao enviar e-mail via Brevo: ${res.status} – ${body}`
    );
  }
}

function buildCookieOptions(maxAgeMs) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    // Em produção usamos SameSite=None para permitir cookies
    // entre domínios diferentes (Netlify -> Render) com HTTPS.
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: maxAgeMs,
    path: "/",
  };
}

function issueTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };

  const accessToken = jwt.sign({ ...payload, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

  const refreshToken = jwt.sign({ ...payload, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

  return { accessToken, refreshToken };
}

function attachAuthCookies(res, tokens) {
  const fifteenMinutesMs = 15 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  res.cookie("gt_access", tokens.accessToken, buildCookieOptions(fifteenMinutesMs));
  res.cookie("gt_refresh", tokens.refreshToken, buildCookieOptions(sevenDaysMs));
}

function clearAuthCookies(res) {
  res.clearCookie("gt_access", buildCookieOptions(0));
  res.clearCookie("gt_refresh", buildCookieOptions(0));
}

// ===== HELPER: AUTH JWT =====

function authMiddleware(req, res, next) {
  const cookieToken = req.cookies?.gt_access;
  const authHeader = req.headers.authorization || "";
  const [type, headerToken] = authHeader.split(" ");
  const token = cookieToken || (type === "Bearer" ? headerToken : null);

  if (!token) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type && decoded.type !== "access") {
      return res.status(401).json({ error: "Token inválido." });
    }
    req.user = decoded; // { id, email, role, type }
    next();
  } catch (err) {
    console.error("Erro ao validar token:", err);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao admin." });
  }
  next();
}

// ===== LOGIN (sem JWT obrigatório) =====

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (isBlocked(normalizedEmail)) {
      return res
        .status(429)
        .json({ error: "Muitas tentativas. Aguarde alguns minutos." });
    }

    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      registerFailure(normalizedEmail);
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    const storedPassword = user.password || "";
    const isLegacyPlain = !isBcryptHash(storedPassword);
    const passwordOk = isLegacyPlain
      ? storedPassword === password
      : await bcrypt.compare(password, storedPassword);

    if (!passwordOk) {
      registerFailure(normalizedEmail);
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }

    resetFailures(normalizedEmail);

    const tokens = issueTokens(user);
    attachAuthCookies(res, tokens);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        unit: user.unit,
        mustChangePassword: user.mustChangePassword,
      },
      token: tokens.accessToken,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// renovar access token usando refresh cookie
app.post("/api/refresh", refreshLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies?.gt_refresh;
    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token ausente." });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Token inválido." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
        mustChangePassword: true,
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    const tokens = issueTokens(user);
    attachAuthCookies(res, tokens);

    res.json({ user });
  } catch (err) {
    console.error("Erro ao renovar token:", err);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
});

// logout limpa cookies
app.post("/api/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

// ===== USERS =====

// obter usuário atual
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
        mustChangePassword: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    res.json({ user });
  } catch (err) {
    console.error("Erro ao buscar usuário atual:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

// alterar senha logado
app.post("/api/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Informe senha atual e a nova senha." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const storedPassword = user.password || "";
    const isLegacyPlain = !isBcryptHash(storedPassword);
    const passwordOk = isLegacyPlain
      ? storedPassword === currentPassword
      : await bcrypt.compare(currentPassword, storedPassword);

    if (!passwordOk) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newHash, mustChangePassword: false },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao trocar senha:", err);
    res.status(500).json({ error: "Erro ao trocar senha." });
  }
});

// iniciar fluxo de esqueci a senha (gera token)
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Informe o e-mail." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // resposta genérica para não vazar existência
      return res.json({ message: "Se existir, enviaremos instruções." });
    }

    // invalida tokens anteriores
    await prisma.passwordReset.deleteMany({
      where: { email: normalizedEmail, used: false },
    });

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await prisma.passwordReset.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
        userId: user.id,
      },
    });

    // tenta enviar e-mail via Brevo (HTTP API)
    try {
      await sendResetEmailBrevo(normalizedEmail, token);
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de recuperação:", mailErr);
    }

    // resposta sempre genérica
    res.json({
      message: "Se existir, você receberá instruções para redefinir a senha.",
    });
  } catch (err) {
    console.error("Erro no forgot-password:", err);
    res.status(500).json({ error: "Erro ao gerar token de recuperação." });
  }
});

// concluir reset de senha com token
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token e nova senha são obrigatórios." });
    }

    const record = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (
      !record ||
      record.used ||
      (record.expiresAt && new Date(record.expiresAt) < new Date())
    ) {
      return res.status(400).json({ error: "Token inválido ou expirado." });
    }

    const user = await prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado." });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: newHash, mustChangePassword: false },
      }),
      prisma.passwordReset.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao resetar senha:", err);
    res.status(500).json({ error: "Erro ao redefinir senha." });
  }
});

// listar usuários (sem senha)
app.get("/api/users", authMiddleware, async (req, res) => {
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
app.post("/api/users", authMiddleware, adminOnly, async (req, res) => {
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
        password: await hashPassword(password),
        role: "user",
        unit: (unit || "Clínica").trim(),
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
        mustChangePassword: true,
      },
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// deletar usuário + KPIs + progresso dele
app.delete("/api/users/:id", authMiddleware, adminOnly, async (req, res) => {
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

    // Desassocia KPIs para não perder dados
    await prisma.kpi.updateMany({
      where: { ownerId: id },
      data: { ownerId: null },
    });
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "user_delete",
        details: JSON.stringify({ deletedUserId: id }),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar usuário:", err);
    res.status(500).json({ error: "Erro ao deletar usuário." });
  }
});

// tornar usuário admin
app.post("/api/users/:id/make-admin", authMiddleware, adminOnly, async (req, res) => {
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
      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        unit: user.unit,
        mustChangePassword: user.mustChangePassword,
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
        mustChangePassword: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "user_promote_admin",
        details: JSON.stringify({ promotedUserId: id }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao promover usuário para admin:", err);
    res.status(500).json({ error: "Erro ao promover usuário." });
  }
});

// ===== KPIS =====

// listar KPIs
app.get("/api/kpis", authMiddleware, async (req, res) => {
  try {
    const kpis = await prisma.kpi.findMany();
    res.json(kpis);
  } catch (err) {
    console.error("Erro ao listar KPIs:", err);
    res.status(500).json({ error: "Erro ao listar KPIs." });
  }
});

// criar KPI
app.post("/api/kpis", authMiddleware, adminOnly, async (req, res) => {
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

    if (!name || !unitType || !periodicity) {
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
        ownerId: ownerId ? Number(ownerId) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "kpi_create",
        details: JSON.stringify({ kpiId: newKpi.id, name: newKpi.name }),
      },
    });

    res.status(201).json(newKpi);
  } catch (err) {
    console.error("Erro ao criar KPI:", err);
    res.status(500).json({ error: "Erro ao criar KPI." });
  }
});

// atualizar KPI
app.put("/api/kpis/:id", authMiddleware, adminOnly, async (req, res) => {
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

    if (ownerId !== undefined) data.ownerId = ownerId === null ? null : Number(ownerId);

    const updated = await prisma.kpi.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "kpi_update",
        details: JSON.stringify({ kpiId: updated.id }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar KPI:", err);
    res.status(500).json({ error: "Erro ao atualizar KPI." });
  }
});

// deletar KPI + progresso dele
app.delete("/api/kpis/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const existing = await prisma.kpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "KPI não encontrado." });
    }

    const nameLower = existing.name.toLowerCase();
    if (
      existing.unitType === "valor" &&
      (nameLower.includes("faturamento") || nameLower.includes("faturacao"))
    ) {
      return res.status(400).json({
        error:
          "Este KPI é usado na planilha e no calendário de faturamento e não pode ser excluído. Ajuste o nome/descrição em vez de apagar.",
      });
    }

    // onDelete: Cascade já remove Progress, mas se quiser garantir:
    await prisma.progress.deleteMany({ where: { kpiId: id } });
    await prisma.kpi.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "kpi_delete",
        details: JSON.stringify({ kpiId: id }),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar KPI:", err);
    res.status(500).json({ error: "Erro ao deletar KPI." });
  }
});

// ===== PROGRESSO =====

// registrar progresso (upsert manual)
function isAdminUser(user) {
  if (!user) return false;
  const adminEmails = new Set([
    "sanjaymir@icloud.com",
    "w.larasouto@gmail.com",
    "gabriel_mfqueiroz@hotmail.com",
  ]);
  return user.role === "admin" || adminEmails.has(user.email.toLowerCase());
}

function getManausLocalDate(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(baseDate).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return { year, month, day, date };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function isHolidayDate(date) {
  // date: Date em UTC representando meia-noite da data local
  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const nextDay = addDays(dayStart, 1);
  const holiday = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: dayStart,
        lt: nextDay,
      },
    },
  });
  return !!holiday;
}

async function adjustDueDateForHolidays(date) {
  let current = date;
  // Avança enquanto for feriado
  // (não nos preocupamos com fim de semana aqui, apenas feriados)
  // para evitar loop infinito, limitamos a alguns dias
  for (let i = 0; i < 7; i += 1) {
    const isHoliday = await isHolidayDate(current);
    if (!isHoliday) return current;
    current = addDays(current, 1);
  }
  return current;
}

async function computeWeeklyPeriodNow() {
  const { date: today } = getManausLocalDate();

  // Regra:
  // - O registro semanal sempre cobre SÁBADO -> SEXTA.
  // - O prazo (dueDate) é o SÁBADO imediatamente após essa sexta.
  // - No próprio sábado de vencimento, o usuário ainda está
  //   registrando a semana que terminou na sexta anterior.

  let endDate;

  if (today.getUTCDay() === 6) {
    // Hoje é sábado: semana que terminou ontem (sexta)
    endDate = addDays(today, -1);
  } else {
    // Qualquer outro dia: próxima sexta-feira desta semana
    endDate = today;
    while (endDate.getUTCDay() !== 5) {
      endDate = addDays(endDate, 1);
    }
  }

  const startDate = addDays(endDate, -6); // sábado anterior
  let dueDate = addDays(endDate, 1); // sábado de vencimento
  dueDate = await adjustDueDateForHolidays(dueDate);

  return { startDate, endDate, dueDate };
}

async function computeMonthlyPeriodNow() {
  const { year, month } = getManausLocalDate();
  // mês anterior
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const startDate = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const endDate = new Date(
    Date.UTC(prevYear, prevMonth, 0) // dia 0 do mês seguinte = último dia do mês anterior
  );

  // due date: dia 1 do mês atual, ajustando domingo -> dia 2
  let dueDate = new Date(Date.UTC(year, month - 1, 1));
  if (dueDate.getUTCDay() === 0) {
    // domingo
    dueDate = addDays(dueDate, 1);
  }
  dueDate = await adjustDueDateForHolidays(dueDate);

  return { startDate, endDate, dueDate };
}

app.post("/api/progress", authMiddleware, async (req, res) => {
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

    const kpi = await prisma.kpi.findUnique({ where: { id: kpiIdNum } });
    if (!kpi) {
      return res.status(404).json({ error: "KPI não encontrado." });
    }

    const userIsAdmin = isAdminUser(req.user);

    if (!userIsAdmin && kpi.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Sem permissão para este KPI." });
    }

    let startDate = null;
    let endDate = null;
    let dueDate = null;

    if (periodType === "semanal") {
      const period = await computeWeeklyPeriodNow();
      startDate = period.startDate;
      endDate = period.endDate;
      dueDate = period.dueDate;

      const { date: today } = getManausLocalDate();
      if (!userIsAdmin && today > dueDate) {
        return res.status(403).json({
          error:
            "Prazo de lançamento da semana expirou. Fale com o administrador para ajustes.",
        });
      }
    } else if (periodType === "mensal") {
      const period = await computeMonthlyPeriodNow();
      startDate = period.startDate;
      endDate = period.endDate;
      dueDate = period.dueDate;

      const { date: today } = getManausLocalDate();
      if (!userIsAdmin && today > dueDate) {
        return res.status(403).json({
          error:
            "Prazo de lançamento do mês expirou. Fale com o administrador para ajustes.",
        });
      }
    }

    const entry = await prisma.progressEntry.create({
      data: {
        kpiId: kpiIdNum,
        periodType,
        periodKey,
        delivered: !!delivered,
        value: value || "",
        comment: comment || "",
        startDate,
        endDate,
        dueDate,
        submittedAt: new Date(),
        userId: req.user.id,
      },
    });

    const existing = await prisma.progress.findFirst({
      where: { kpiId: kpiIdNum, periodType, periodKey },
    });

    if (existing) {
      await prisma.progress.update({
        where: { id: existing.id },
        data: {
          delivered: entry.delivered,
          value: entry.value,
          comment: entry.comment,
        },
      });
    } else {
      await prisma.progress.create({
        data: {
          kpiId: kpiIdNum,
          periodType,
          periodKey,
          delivered: entry.delivered,
          value: entry.value,
          comment: entry.comment,
        },
      });
    }

    // se for registro semanal de um KPI semanal+mensal, recalcula o mensal a partir das semanas
    if (periodType === "semanal" && kpi.periodicity === "semanal+mensal") {
      const ym = getYearMonthFromWeekKey(periodKey);
      if (ym) {
        const monthKey = `${ym.year}-${String(ym.month).padStart(2, "0")}`;

        const weeklyRows = await prisma.progress.findMany({
          where: { kpiId: kpiIdNum, periodType: "semanal" },
        });

        let total = 0;
        for (const row of weeklyRows) {
          if (!row.delivered) continue;
          const rowYm = getYearMonthFromWeekKey(row.periodKey);
          if (!rowYm) continue;
          if (rowYm.year !== ym.year || rowYm.month !== ym.month) continue;
          const parsed = parseFloat(row.value || "0");
          if (!Number.isNaN(parsed)) {
            total += parsed;
          }
        }

        const deliveredMonthly = total > 0;
        const monthlyValue = deliveredMonthly ? String(total) : "";

        const existingMonthly = await prisma.progress.findFirst({
          where: {
            kpiId: kpiIdNum,
            periodType: "mensal",
            periodKey: monthKey,
          },
        });

        if (existingMonthly) {
          await prisma.progress.update({
            where: { id: existingMonthly.id },
            data: {
              delivered: deliveredMonthly,
              value: monthlyValue,
              comment: "",
            },
          });
        } else {
          await prisma.progress.create({
            data: {
              kpiId: kpiIdNum,
              periodType: "mensal",
              periodKey: monthKey,
              delivered: deliveredMonthly,
              value: monthlyValue,
              comment: "",
            },
          });
        }
      }
    }

    // se for registro diário, recalcula o mensal a partir dos dias
    if (periodType === "diario") {
      const ym = getYearMonthFromDateKey(periodKey);
      if (ym) {
        const monthKey = `${ym.year}-${String(ym.month).padStart(2, "0")}`;

        const dailyRows = await prisma.progress.findMany({
          where: { kpiId: kpiIdNum, periodType: "diario" },
        });

        let total = 0;
        for (const row of dailyRows) {
          if (!row.delivered) continue;
          const rowYm = getYearMonthFromDateKey(row.periodKey);
          if (!rowYm) continue;
          if (rowYm.year !== ym.year || rowYm.month !== ym.month) continue;
          const parsed = parseFloat(row.value || "0");
          if (!Number.isNaN(parsed)) {
            total += parsed;
          }
        }

        const deliveredMonthly = total > 0;
        const monthlyValue = deliveredMonthly ? String(total) : "";

        const existingMonthly = await prisma.progress.findFirst({
          where: {
            kpiId: kpiIdNum,
            periodType: "mensal",
            periodKey: monthKey,
          },
        });

        if (existingMonthly) {
          await prisma.progress.update({
            where: { id: existingMonthly.id },
            data: {
              delivered: deliveredMonthly,
              value: monthlyValue,
              comment: "",
            },
          });
        } else {
          await prisma.progress.create({
            data: {
              kpiId: kpiIdNum,
              periodType: "mensal",
              periodKey: monthKey,
              delivered: deliveredMonthly,
              value: monthlyValue,
              comment: "",
            },
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "progress_upsert",
        details: JSON.stringify({ kpiId: kpiIdNum, periodType, periodKey }),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao registrar progresso:", err);
    res.status(500).json({ error: "Erro ao registrar progresso." });
  }
});

// pegar todo o progresso (formato: { "kpiId-periodType-periodKey": { delivered, value, comment } })
app.get("/api/progress", authMiddleware, async (req, res) => {
  try {
    const rows = await prisma.progress.findMany({
      where:
        req.user.role === "admin"
          ? {}
          : {
              kpi: {
                ownerId: req.user.id,
              },
            },
      include: { kpi: true },
    });
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

// histórico completo de submissões de progresso (com filtros simples)
app.get("/api/progress/history", authMiddleware, async (req, res) => {
  try {
    const {
      mine,
      userId,
      kpiId,
      periodType,
      from,
      to,
      limit = 200,
    } = req.query;

    const where = {};

    if (req.user.role === "admin") {
      if (mine === "true") {
        where.userId = req.user.id;
      } else if (userId) {
        where.userId = Number(userId);
      }
    } else {
      if (mine === "true") {
        where.userId = req.user.id;
      } else {
        where.kpi = { ownerId: req.user.id };
      }
    }

    if (kpiId) {
      where.kpiId = Number(kpiId);
    }

    if (periodType) {
      where.periodType = String(periodType);
    }

    if (from || to) {
      where.submittedAt = {};
      if (from) {
        where.submittedAt.gte = new Date(from);
      }
      if (to) {
        where.submittedAt.lte = new Date(to);
      }
    }

    const take = Math.min(Number(limit) || 200, 500);

    const entries = await prisma.progressEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        kpi: { select: { id: true, name: true, periodicity: true, unitType: true } },
      },
      take,
    });
    res.json(entries);
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

// status dos períodos atual (semana/mês) para o usuário logado
app.get("/api/progress/period-status", authMiddleware, async (req, res) => {
  try {
    const { date: today } = getManausLocalDate();
    const userIsAdmin = isAdminUser(req.user);

    const [weekly, monthly] = await Promise.all([
      computeWeeklyPeriodNow(),
      computeMonthlyPeriodNow(),
    ]);

    const weeklyOpen = userIsAdmin || today <= weekly.dueDate;
    const monthlyOpen = userIsAdmin || today <= monthly.dueDate;

    function serializePeriod(period, entryOpen) {
      if (!period) return null;
      return {
        startDate: period.startDate?.toISOString() || null,
        endDate: period.endDate?.toISOString() || null,
        dueDate: period.dueDate?.toISOString() || null,
        entryOpen,
      };
    }

    res.json({
      weekly: serializePeriod(weekly, weeklyOpen),
      monthly: serializePeriod(monthly, monthlyOpen),
    });
  } catch (err) {
    console.error("Erro ao calcular status dos períodos:", err);
    res.status(500).json({ error: "Erro ao calcular status dos períodos." });
  }
});

// série mensal agregada por KPI (para gráficos)
app.get("/api/kpis/:id/series/monthly", authMiddleware, async (req, res) => {
  try {
    const kpiId = Number(req.params.id);
    if (Number.isNaN(kpiId)) {
      return res.status(400).json({ error: "ID de KPI inválido." });
    }

    const kpi = await prisma.kpi.findUnique({ where: { id: kpiId } });
    if (!kpi) {
      return res.status(404).json({ error: "KPI não encontrado." });
    }

    const userIsAdmin = isAdminUser(req.user);
    if (!userIsAdmin && kpi.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Sem permissão para este KPI." });
    }

    let periodTypes = [];
    if (kpi.periodicity === "mensal") {
      periodTypes = ["mensal"];
    } else {
      // para KPIs com dado semanal, usamos apenas as semanas
      periodTypes = ["semanal"];
    }

    const entries = await prisma.progressEntry.findMany({
      where: {
        kpiId,
        periodType: { in: periodTypes },
        delivered: true,
      },
      orderBy: { startDate: "asc" },
    });

    const byMonth = new Map(); // "YYYY-MM" -> { total, count }

    for (const e of entries) {
      if (!e.value) continue;

      let ym = null;
      if (e.periodType === "semanal") {
        ym = getYearMonthFromWeekKey(e.periodKey);
      } else if (e.periodType === "mensal") {
        const match = /^(\d{4})-(\d{2})$/.exec(e.periodKey);
        if (match) {
          ym = { year: Number(match[1]), month: Number(match[2]) };
        }
      }

      if (!ym) continue;

      const key = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
      const parsed = parseFloat(e.value || "0");
      if (Number.isNaN(parsed)) continue;

      const agg = byMonth.get(key) || { total: 0, count: 0 };
      agg.total += parsed;
      agg.count += 1;
      byMonth.set(key, agg);
    }

    const series = Array.from(byMonth.entries())
      .map(([monthKey, agg]) => {
        const [yearStr, monthStr] = monthKey.split("-");
        const label = `${monthStr}/${yearStr}`;
        const total = agg.total;
        const target =
          kpi.targetMonthly && kpi.targetMonthly > 0 ? kpi.targetMonthly : null;
        let percent = null;
        if (target && target > 0) {
          percent = Math.round((total / target) * 100);
        }
        return {
          monthKey,
          label,
          value: total,
          target,
          percent,
        };
      })
      .sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));

    res.json({ kpiId, kpiName: kpi.name, series });
  } catch (err) {
    console.error("Erro ao calcular série mensal do KPI:", err);
    res.status(500).json({ error: "Erro ao calcular série mensal do KPI." });
  }
});

// ===== BACKUP (EXPORT / IMPORT) =====

// exportar tudo em um JSON (admin)
app.get("/api/backup/export", backupLimiter, authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        unit: true,
        mustChangePassword: true,
      },
    });
    const kpis = await prisma.kpi.findMany();
    const rows = await prisma.progress.findMany();
    const entries = await prisma.progressEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const progress = {};
    for (const row of rows) {
      const key = `${row.kpiId}-${row.periodType}-${row.periodKey}`;
      progress[key] = {
        delivered: row.delivered,
        value: row.value,
        comment: row.comment,
      };
    }

    res.json({ users, kpis, progress, entries });
  } catch (err) {
    console.error("Erro ao exportar backup:", err);
    res.status(500).json({ error: "Erro ao exportar backup." });
  }
});

// exportar CSV simples (users, kpis, progress)
app.get("/api/backup/export-csv", backupLimiter, authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, unit: true },
    });
    const kpis = await prisma.kpi.findMany();
    const progressRows = await prisma.progress.findMany();

    function toCsv(rows, headers) {
      const headerLine = headers.join(",");
      const lines = rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h] == null ? "" : String(r[h]).replace(/"/g, '""');
            return `"${v}"`;
          })
          .join(",")
      );
      return [headerLine, ...lines].join("\n");
    }

    const usersCsv = toCsv(users, ["id", "name", "email", "role", "unit"]);
    const kpisCsv = toCsv(kpis, [
      "id",
      "name",
      "description",
      "unitType",
      "periodicity",
      "targetWeekly",
      "targetMonthly",
      "ownerId",
    ]);
    const progressCsv = toCsv(progressRows, [
      "id",
      "kpiId",
      "periodType",
      "periodKey",
      "delivered",
      "value",
      "comment",
    ]);

    const fullCsv =
      "## Users\n" +
      usersCsv +
      "\n\n## KPIs\n" +
      kpisCsv +
      "\n\n## Progress\n" +
      progressCsv +
      "\n";

    res.header("Content-Type", "text/csv");
    res.attachment("goal-tracker-export.csv");
    res.send(fullCsv);
  } catch (err) {
    console.error("Erro ao exportar CSV:", err);
    res.status(500).json({ error: "Erro ao exportar CSV." });
  }
});

// importar backup (substitui tudo) – admin; permite parcial
app.post("/api/backup/import", backupLimiter, authMiddleware, adminOnly, async (req, res) => {
  try {
    const { users, kpis, progress, replaceAll = true } = req.body || {};

    const hasUsers = Array.isArray(users);
    const hasKpis = Array.isArray(kpis);
    const hasProgress = typeof progress === "object" && progress !== null;

    if (!hasUsers && !hasKpis && !hasProgress) {
      return res.status(400).json({ error: "Nada para importar." });
    }

    const normalizedUsers = [];

    if (hasUsers) {
      for (const u of users) {
        if (!u || typeof u !== "object") {
          return res.status(400).json({ error: "Usuário inválido no backup." });
        }

        if (!u.email || !u.name) {
          return res
            .status(400)
            .json({ error: "Usuário do backup sem nome ou e-mail." });
        }

        const role = u.role === "admin" ? "admin" : "user";
        const passwordSource = u.passwordHash || u.password;
        const passwordToStore = passwordSource
          ? isBcryptHash(passwordSource)
            ? passwordSource
            : await hashPassword(passwordSource)
          : await hashPassword("temp-password-change-me");

        normalizedUsers.push({
          id: u.id,
          name: String(u.name).trim(),
          email: String(u.email).trim().toLowerCase(),
          password: passwordToStore,
          role,
          unit: String(u.unit || "Clínica").trim(),
          mustChangePassword: !!u.mustChangePassword,
        });
      }
    }

    const userIds = new Set(normalizedUsers.map((u) => u.id));

    if (hasKpis) {
      for (const k of kpis) {
        if (!k || typeof k !== "object" || Number.isNaN(Number(k.ownerId))) {
          return res
            .status(400)
            .json({ error: "KPI inválido ou sem ownerId no backup." });
        }

        if (k.ownerId != null && userIds.size > 0 && !userIds.has(k.ownerId)) {
          return res.status(400).json({
            error: `OwnerId ${k.ownerId} não encontrado nos usuários importados.`,
          });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (replaceAll) {
        await tx.auditLog.deleteMany();
        await tx.passwordReset.deleteMany();
        await tx.progress.deleteMany();
        await tx.kpi.deleteMany();
        await tx.user.deleteMany();
      }

      if (hasUsers) {
        if (replaceAll) {
          for (const u of normalizedUsers) {
            await tx.user.create({ data: u });
          }
        } else {
          for (const u of normalizedUsers) {
            await tx.user.upsert({
              where: { email: u.email },
              update: u,
              create: u,
            });
          }
        }
      }

      if (hasKpis) {
        for (const k of kpis) {
          await tx.kpi.upsert({
            where: { id: k.id || 0 },
            update: {
              name: k.name,
              description: k.description,
              unitType: k.unitType,
              periodicity: k.periodicity,
              targetWeekly: k.targetWeekly,
              targetMonthly: k.targetMonthly,
              ownerId: k.ownerId,
            },
            create: {
              id: k.id,
              name: k.name,
              description: k.description,
              unitType: k.unitType,
              periodicity: k.periodicity,
              targetWeekly: k.targetWeekly,
              targetMonthly: k.targetMonthly,
              ownerId: k.ownerId,
            },
          });
        }
      }

      if (hasProgress) {
        const entries = Object.entries(progress);
        for (const [key, value] of entries) {
          const [kpiIdStr, periodType, periodKey] = key.split("-");
          const kpiIdNum = Number(kpiIdStr);
          if (Number.isNaN(kpiIdNum)) continue;

          await tx.progress.upsert({
            where: { kpiId_periodType_periodKey: { kpiId: kpiIdNum, periodType, periodKey } },
            update: {
              delivered: !!value.delivered,
              value: value.value || "",
              comment: value.comment || "",
            },
            create: {
              kpiId: kpiIdNum,
              periodType,
              periodKey,
              delivered: !!value.delivered,
              value: value.value || "",
              comment: value.comment || "",
            },
          });
        }
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao importar backup:", err);
    res.status(500).json({ error: "Erro ao importar backup." });
  }
});

// ===== SERVE FRONTEND (React build) =====
// Em produção no Render, servimos os arquivos estáticos gerados pelo Vite
// a partir da pasta dist localizada na raiz do repositório.

const distPath = path.join(__dirname, "..", "dist");

app.use(express.static(distPath));

// SPA fallback: qualquer rota que não comece com /api deve devolver index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  return res.sendFile(path.join(distPath, "index.html"));
});

// auditoria (admin)
app.get("/api/audit", authMiddleware, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.json(logs);
  } catch (err) {
    console.error("Erro ao buscar auditoria:", err);
    res.status(500).json({ error: "Erro ao buscar auditoria." });
  }
});

// healthcheck
app.get("/health", (req, res) => {
  res.json({ ok: true });
});
// ===== START =====

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
