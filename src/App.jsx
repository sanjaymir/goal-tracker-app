import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Line,
} from "recharts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.MODE === "production"
    ? window.location.origin
    : "http://localhost:3000");

const SPECIAL_ADMIN_EMAILS = [
  "sanjaymir@icloud.com",
  "w.larasouto@gmail.com",
  "gabriel_mfqueiroz@hotmail.com",
];

function isAdminUserClient(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const email = String(user.email || "").toLowerCase();
  return SPECIAL_ADMIN_EMAILS.includes(email);
}

// --------- HELPERS DE FORMATAÇÃO / NUMÉRICO ----------

function normalizeMoneyInput(raw) {
  if (raw == null) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return "";
  return String(num);
}

function formatCurrency(value) {
  if (value == null || value === "") return "R$\u00a00,00";
  const num =
    typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

// --------- HELPERS DE PERÍODO (SEMANA / MÊS) ----------

function getWeekKey(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getCurrentWeekKey() {
  return getWeekKey(new Date());
}

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// progress indexado por período:
// { "kpiId-periodType-periodKey": { delivered, value, comment } }

function getCurrentProgress(progress, kpiId, periodType) {
  const periodKey =
    periodType === "semanal" ? getCurrentWeekKey() : getCurrentMonthKey();
  const key = `${kpiId}-${periodType}-${periodKey}`;
  return progress[key];
}

// --------- CÁLCULO DE % E SEMÁFORO (ATUAL) ----------
// Retorna { level: "verde" | "amarelo" | "vermelho" | "neutro", percent, base }

function getKpiPerformance(kpi, progress) {
  const weeklyStatus = getCurrentProgress(progress, kpi.id, "semanal");
  const monthlyStatus = getCurrentProgress(progress, kpi.id, "mensal");

  let base = null; // "semanal" ou "mensal"
  let target = 0;
  let deliveredValue = 0;
  let hasRegistro = false;

  if (
    (kpi.periodicity === "mensal" || kpi.periodicity === "semanal+mensal") &&
    monthlyStatus &&
    (monthlyStatus.delivered || monthlyStatus.comment)
  ) {
    base = "mensal";
    hasRegistro = true;
    target = kpi.targetMonthly || 0;
    if (monthlyStatus.delivered) {
      const parsed = parseFloat(monthlyStatus.value || "0");
      deliveredValue = isNaN(parsed) ? 0 : parsed;
    } else {
      deliveredValue = 0;
    }
  } else if (
    (kpi.periodicity === "semanal" || kpi.periodicity === "semanal+mensal") &&
    weeklyStatus &&
    (weeklyStatus.delivered || weeklyStatus.comment)
  ) {
    base = "semanal";
    hasRegistro = true;
    target = kpi.targetWeekly || 0;
    if (weeklyStatus.delivered) {
      const parsed = parseFloat(weeklyStatus.value || "0");
      deliveredValue = isNaN(parsed) ? 0 : parsed;
    } else {
      deliveredValue = 0;
    }
  }

  if (!hasRegistro) {
    return { level: "neutro", percent: 0, base: null };
  }

  let percent = 0;

  if (target && target > 0) {
    percent = Math.round((deliveredValue / target) * 100);
  } else {
    percent = deliveredValue > 0 ? 100 : 0;
  }

  // trava entre 0 e 200 só pra não explodir
  percent = Math.max(0, Math.min(percent, 200));

  let level;
  if (percent >= 100) level = "verde";
  else if (percent >= 70) level = "amarelo";
  else level = "vermelho";

  return { level, percent, base };
}

// --------- CÁLCULO DE % PARA HISTÓRICO ----------

function computeHistoricalPerformance(kpi, periodType, status) {
  if (!status) return { level: "neutro", percent: 0 };

  let target =
    periodType === "mensal" ? kpi.targetMonthly || 0 : kpi.targetWeekly || 0;

  let deliveredValue = 0;
  if (status.delivered) {
    const parsed = parseFloat(status.value || "0");
    deliveredValue = isNaN(parsed) ? 0 : parsed;
  }

  let percent = 0;
  if (target && target > 0) {
    percent = Math.round((deliveredValue / target) * 100);
  } else {
    percent = status.delivered ? 100 : 0;
  }

  percent = Math.max(0, Math.min(percent, 200));

  let level;
  if (percent >= 100) level = "verde";
  else if (percent >= 70) level = "amarelo";
  else level = "vermelho";

  return { level, percent };
}

function getKpiHistory(kpi, periodType, progress, limit = 6) {
  const prefix = `${kpi.id}-${periodType}-`;

  const records = Object.entries(progress)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, status]) => {
      const periodKey = key.slice(prefix.length);
      const perf = computeHistoricalPerformance(kpi, periodType, status);

      const label =
        periodType === "semanal"
          ? periodKey.replace(/(\d{4})-W(\d{2})/, "Semana $2 / $1")
          : periodKey.replace(/(\d{4})-(\d{2})/, "$2/$1");

      return {
        periodKey,
        label,
        status,
        ...perf,
      };
    })
    .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1))
    .slice(0, limit);

  return records;
}

// ============= APP PRINCIPAL =============

function App() {
  const [users, setUsers] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [progress, setProgress] = useState({});

  const [currentUser, setCurrentUser] = useState(null);
  const [periodStatus, setPeriodStatus] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverMessage, setRecoverMessage] = useState("");
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken") || "";
  });
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const [globalError, setGlobalError] = useState("");

  // carrega dados iniciais do backend após login (via cookies)
  useEffect(() => {
    if (!currentUser) {
      setUsers([]);
      setKpis([]);
      setProgress({});
       setPeriodStatus(null);
       setHistoryEntries([]);
      return;
    }

    async function loadAll() {
      try {
        const historyUrl =
          currentUser.role === "admin"
            ? `${API_BASE_URL}/api/progress/history`
            : `${API_BASE_URL}/api/progress/history?mine=true`;

        const [usersRes, kpisRes, progressRes, statusRes, historyRes] =
          await Promise.all([
            fetch(`${API_BASE_URL}/api/users`, {
              credentials: "include",
            }),
            fetch(`${API_BASE_URL}/api/kpis`, {
              credentials: "include",
            }),
            fetch(`${API_BASE_URL}/api/progress`, {
              credentials: "include",
            }),
            fetch(`${API_BASE_URL}/api/progress/period-status`, {
              credentials: "include",
            }),
            fetch(historyUrl, {
              credentials: "include",
            }),
          ]);

        if (
          usersRes.status === 401 ||
          kpisRes.status === 401 ||
          progressRes.status === 401 ||
          statusRes.status === 401 ||
          historyRes.status === 401
        ) {
          setGlobalError("Sessão expirada. Faça login novamente.");
          handleLogout();
          return;
        }

        if (
          !usersRes.ok ||
          !kpisRes.ok ||
          !progressRes.ok ||
          !statusRes.ok ||
          !historyRes.ok
        ) {
          throw new Error("Falha ao carregar dados iniciais.");
        }

        const [
          usersData,
          kpisData,
          progressData,
          statusData,
          historyData,
        ] = await Promise.all([
          usersRes.json(),
          kpisRes.json(),
          progressRes.json(),
          statusRes.json(),
          historyRes.json(),
        ]);

        setUsers(usersData);
        setKpis(kpisData);
        setProgress(progressData);
        setPeriodStatus(statusData || null);
        setHistoryEntries(Array.isArray(historyData) ? historyData : []);
        setGlobalError("");
      } catch (err) {
        console.error(err);
        setGlobalError("Erro ao carregar dados do servidor.");
      }
    }

    loadAll();
  }, [currentUser]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setGlobalError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      if (!res.ok) {
        setLoginError("E-mail ou senha inválidos.");
        return;
      }

      const data = await res.json();
      // backend pode retornar { user, token } ou apenas { user }
      if (!data || !data.user) {
        setLoginError("Resposta inválida do servidor.");
        return;
      }

      setCurrentUser(data.user);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      console.error(err);
      setLoginError("Erro ao conectar com o servidor.");
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setUsers([]);
    setKpis([]);
    setProgress({});
    setLoginEmail("");
    setLoginPassword("");
  }

  function handleRecoverSubmit(e) {
    e.preventDefault();
    const email = recoverEmail.trim();
    if (!email) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setRecoverMessage(
            data.message ||
              "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
          );
        } else {
          setRecoverMessage(
            "Não foi possível iniciar a recuperação. Tente novamente mais tarde."
          );
        }
      } catch (err) {
        console.error("Erro ao chamar forgot-password:", err);
        setRecoverMessage(
          "Erro de conexão ao iniciar a recuperação de senha."
        );
      }
    })();
  }

  // --------- PROGRESSO (chama backend) ----------

  async function updateProgress(
    kpiId,
    periodType,
    delivered,
    value,
    comment,
    options = {}
  ) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return false;
    }

    let periodKey = options.periodKey;
    if (!periodKey) {
      if (periodType === "semanal") {
        periodKey = getCurrentWeekKey();
      } else if (periodType === "mensal") {
        periodKey = getCurrentMonthKey();
      } else if (periodType === "diario") {
        const d = new Date();
        periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
      } else {
        periodKey = getCurrentMonthKey();
      }
    }

    const key = `${kpiId}-${periodType}-${periodKey}`;

    try {
      const res = await fetch(`${API_BASE_URL}/api/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          kpiId,
          periodType,
          periodKey,
          delivered,
          value,
          comment,
        }),
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return false;
      }

      if (!res.ok) {
        let msg = "Erro ao registrar progresso.";
        try {
          const data = await res.json();
          if (data && data.error) msg = data.error;
        } catch (e) {
          // ignore parse error
        }
        alert(msg);
        return false;
      }

      const newEntry = {
        delivered,
        value: value || "",
        comment: comment || "",
      };

      setProgress((prev) => ({
        ...prev,
        [key]: newEntry,
      }));
      return true;
    } catch (err) {
      console.error("Erro ao salvar progresso no backend", err);
      alert("Erro ao salvar progresso no servidor.");
      return false;
    }
  }

  // --------- EXPORT / IMPORT (via backend) ----------

  async function handleExportData() {
    if (!currentUser) {
      alert("Você precisa estar logado para exportar o backup.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/backup/export`, {
        credentials: "include",
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao exportar dados do servidor.");
        return;
      }

      const data = await res.json();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;

      a.href = url;
      a.download = `goal-tracker-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao exportar dados.");
    }
  }

  async function handleImportData(backupData) {
    if (!currentUser) {
      alert("Você precisa estar logado para importar o backup.");
      return;
    }

    if (!backupData || typeof backupData !== "object") {
      alert("Arquivo de backup inválido.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/backup/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(backupData),
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao importar backup no servidor.");
        return;
      }

      alert("Backup importado com sucesso. A página será recarregada.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao importar backup.");
    }
  }

  // --------- CRUD Usuário (via backend) ----------

  async function handleCreateUser(userData) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(userData),
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (res.status === 409) {
        alert("Já existe um usuário com esse e-mail.");
        return;
      }

      if (!res.ok) {
        alert("Erro ao criar usuário.");
        return;
      }

      const created = await res.json();
      setUsers((prev) => [...prev, created]);
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao criar usuário.");
    }
  }

  async function handleDeleteUser(userId) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (user.role === "admin") {
      alert("Não é permitido excluir o usuário admin.");
      return;
    }

    const confirmDelete = window.confirm(
      `Excluir usuário ${user.name} e todos os KPIs dele?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao excluir usuário.");
        return;
      }

      // remove também no front
      const kpisToRemove = kpis
        .filter((k) => k.ownerId === userId)
        .map((k) => k.id);

      setProgress((prev) => {
        const updated = {};
        Object.keys(prev).forEach((key) => {
          const [idStr] = key.split("-");
          const idNum = Number(idStr);
          if (!kpisToRemove.includes(idNum)) {
            updated[key] = prev[key];
          }
        });
        return updated;
      });

      setKpis((prev) => prev.filter((k) => k.ownerId !== userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao excluir usuário.");
    }
  }

  async function handleMakeUserAdmin(userId) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const confirmPromote = window.confirm(
      `Tornar "${user.name}" um administrador?`
    );
    if (!confirmPromote) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/users/${userId}/make-admin`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao promover usuário para admin.");
        return;
      }

      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao promover usuário.");
    }
  }

  // --------- CRUD KPI (via backend) ----------

  async function handleCreateKpi(kpiData) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/kpis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(kpiData),
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao criar KPI.");
        return;
      }

      const created = await res.json();
      setKpis((prev) => [...prev, created]);
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao criar KPI.");
    }
  }

  async function handleUpdateKpi(kpiId, updates) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/kpis/${kpiId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao atualizar KPI.");
        return;
      }

      const updated = await res.json();

      setKpis((prev) => prev.map((k) => (k.id === kpiId ? updated : k)));
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao atualizar KPI.");
    }
  }

  async function handleDeleteKpi(kpiId) {
    if (!currentUser) {
      alert("Sessão expirada. Faça login novamente.");
      handleLogout();
      return;
    }

    const kpi = kpis.find((k) => k.id === kpiId);
    if (!kpi) return;

    const confirmDelete = window.confirm(
      `Excluir o KPI "${kpi.name}" e seus registros?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/kpis/${kpiId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        handleLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao excluir KPI.");
        return;
      }

      setKpis((prev) => prev.filter((k) => k.id !== kpiId));

      setProgress((prev) => {
        const updated = {};
        Object.keys(prev).forEach((key) => {
          const [idStr] = key.split("-");
          const idNum = Number(idStr);
          if (idNum !== kpiId) {
            updated[key] = prev[key];
          }
        });
        return updated;
      });
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor ao excluir KPI.");
    }
  }

  // --------- TELA DE LOGIN ---------

  if (!currentUser && resetToken) {
    // Tela de redefinição de senha via link de e-mail
    const handleResetSubmit = async (e) => {
      e.preventDefault();
      setResetMessage("");
      if (!resetPassword || resetPassword.length < 6) {
        setResetMessage("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (resetPassword !== resetConfirm) {
        setResetMessage("A confirmação de senha não confere.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetToken,
            newPassword: resetPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResetMessage(
            data.error || "Não foi possível redefinir a senha."
          );
          return;
        }
        setResetMessage(
          "Senha redefinida com sucesso. Você já pode fazer login com a nova senha."
        );
        // limpa token da URL
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("resetToken");
          window.history.replaceState({}, "", url.toString());
        }
        setResetToken("");
      } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        setResetMessage("Erro de conexão ao redefinir a senha.");
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Goal Tracker – Clínica
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            Redefinir senha da sua conta.
          </p>
          <form className="space-y-3" onSubmit={handleResetSubmit}>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nova senha
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="Nova senha"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="Repita a nova senha"
              />
            </div>
            {resetMessage && (
              <p className="text-xs text-slate-600">{resetMessage}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
            >
              Redefinir senha
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Goal Tracker – Clínica
          </h1>
          <p className="text-sm text-slate-600 mb-2">
            Acompanhe metas semanais e mensais da equipe.
          </p>
          {globalError && (
            <p className="text-xs text-red-500 mb-2">{globalError}</p>
          )}

          {!showRecover ? (
            <>
              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="seuemail@clinica.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Sua senha"
                  />
                </div>

                {loginError && (
                  <p className="text-xs text-red-500">{loginError}</p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
                >
                  Entrar
                </button>
              </form>

              <div className="mt-3 text-xs text-slate-600 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecover(true);
                    setRecoverEmail("");
                    setRecoverMessage("");
                  }}
                  className="text-sky-600 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-900 mb-2">
                Recuperar senha
              </h2>
              <p className="text-xs text-slate-600 mb-3">
                Informe o e-mail cadastrado. Vamos simular o envio de um link de
                redefinição de senha.
              </p>
              <form className="space-y-3" onSubmit={handleRecoverSubmit}>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="seuemail@clinica.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
                >
                  Enviar link de recuperação
                </button>
              </form>
              {recoverMessage && (
                <p className="mt-3 text-xs text-slate-600">{recoverMessage}</p>
              )}
              <div className="mt-3 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecover(false);
                    setRecoverEmail("");
                    setRecoverMessage("");
                  }}
                  className="text-sky-600 hover:underline"
                >
                  Voltar para login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Goal Tracker – Clínica
            </h1>
            <p className="text-xs text-slate-500">
              Usuário: {currentUser.name} (
              {currentUser.role === "admin" ? "Admin" : currentUser.unit})
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {currentUser.role === "admin" ? (
          <AdminDashboard
            users={users}
            allUsers={users}
            kpis={kpis}
            progress={progress}
            periodStatus={periodStatus}
            historyEntries={historyEntries}
            onCreateUser={handleCreateUser}
            onDeleteUser={handleDeleteUser}
            onMakeUserAdmin={handleMakeUserAdmin}
            onCreateKpi={handleCreateKpi}
            onUpdateKpi={handleUpdateKpi}
            onDeleteKpi={handleDeleteKpi}
            onImportData={handleImportData}
            onExportData={handleExportData}
          />
        ) : (
          <UserDashboard
            currentUser={currentUser}
            kpis={kpis}
            progress={progress}
            periodStatus={periodStatus}
            historyEntries={historyEntries}
            updateProgress={updateProgress}
          />
        )}
      </main>
    </div>
  );
}

// ================== ADMIN ==================

function AdminDashboard({
  users,
  allUsers,
  kpis,
  progress,
  periodStatus,
  historyEntries,
  onCreateUser,
  onDeleteUser,
  onMakeUserAdmin,
  onCreateKpi,
  onUpdateKpi,
  onDeleteKpi,
  onImportData,
  onExportData,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitType, setUnitType] = useState("unidades");
  const [periodicity, setPeriodicity] = useState("semanal+mensal");
  const [targetWeekly, setTargetWeekly] = useState("");
  const [targetMonthly, setTargetMonthly] = useState("");
  const [ownerId, setOwnerId] = useState(users[0]?.id || "");

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userUnit, setUserUnit] = useState("");

  // edição de KPI
  const [editingKpiId, setEditingKpiId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUnitType, setEditUnitType] = useState("unidades");
  const [editPeriodicity, setEditPeriodicity] = useState("semanal+mensal");
  const [editTargetWeekly, setEditTargetWeekly] = useState("");
  const [editTargetMonthly, setEditTargetMonthly] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [faturamentoYear, setFaturamentoYear] = useState(
    new Date().getFullYear()
  );
  const [faturamentoInputs, setFaturamentoInputs] = useState({});
  const [faturamentoMetaInputs, setFaturamentoMetaInputs] = useState({});
  const [dailyMonthFilter, setDailyMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  });
  const [dailyDate, setDailyDate] = useState("");
  const [dailyValue, setDailyValue] = useState("");
  const [dailyEditValues, setDailyEditValues] = useState({});

  // lançamento manual por período (qualquer KPI)
  const [entryKpiId, setEntryKpiId] = useState("");
  const [entryPeriodType, setEntryPeriodType] = useState("mensal"); // "mensal" | "semanal"
  const [entryMonth, setEntryMonth] = useState(""); // YYYY-MM
  const [entryWeekDate, setEntryWeekDate] = useState(""); // YYYY-MM-DD
  const [entryMetaValue, setEntryMetaValue] = useState("");
  const [entryResultValue, setEntryResultValue] = useState("");
  const [entryComment, setEntryComment] = useState("");

  function isKpiDelivered(kpi) {
    // Considera meta "cumprida" apenas quando
    // o desempenho do período atual SUPERA 100%
    // e existe uma meta definida (> 0).
    const perf = getKpiPerformance(kpi, progress);
    if (perf.level === "neutro") return false;

    let target = 0;
    if (perf.base === "mensal") {
      target = kpi.targetMonthly || 0;
    } else if (perf.base === "semanal") {
      target = kpi.targetWeekly || 0;
    }

    if (!target || target <= 0) return false;

    return perf.percent > 100;
  }

  const adminUsers = allUsers.filter((u) => u.role === "user");

  const kpiByUserData = adminUsers.map((u) => {
    const userKpis = kpis.filter((k) => k.ownerId === u.id);
    const total = userKpis.length;
    let completed = 0;
    userKpis.forEach((k) => {
      if (isKpiDelivered(k)) completed++;
    });
    return {
      name: u.name.split("–")[0].trim(),
      Cumpridas: completed,
      "Não cumpridas": Math.max(total - completed, 0),
    };
  });

  const totalKpis = kpis.length;
  let totalDelivered = 0;
  kpis.forEach((k) => {
    if (isKpiDelivered(k)) totalDelivered++;
  });
  const pendingKpis = Math.max(totalKpis - totalDelivered, 0);
  const clinicCompletionRate =
    totalKpis === 0 ? 0 : Math.round((totalDelivered / totalKpis) * 100);

  const totalUsers = adminUsers.length;

  const adminOverallPie =
    totalKpis === 0
      ? []
      : [
          { name: "Cumpridas", value: totalDelivered },
          { name: "Pendentes", value: pendingKpis },
        ];

  const rankingData = adminUsers
    .map((u) => {
      const userKpis = kpis.filter((k) => k.ownerId === u.id);
      const total = userKpis.length;

      if (total === 0) {
        return { user: u, total: 0, completed: 0, averagePercent: 0 };
      }

      let completed = 0;
      let sumPercent = 0;
      let countWithData = 0;

      userKpis.forEach((k) => {
        const perf = getKpiPerformance(k, progress);

        if (perf.level !== "neutro") {
          sumPercent += perf.percent;
          countWithData++;

          if (perf.percent > 100) {
            completed++;
          }
        }
      });

      const averagePercent =
        countWithData === 0 ? 0 : Math.round(sumPercent / countWithData);

      return {
        user: u,
        total,
        completed,
        averagePercent,
      };
    })
    .sort((a, b) => b.averagePercent - a.averagePercent);

  const faturamentoKpi = kpis.find(
    (k) =>
      k.unitType === "valor" &&
      (k.periodicity === "mensal" || k.periodicity === "semanal+mensal")
  );

  const faturamentoMonthlyChartData =
    faturamentoKpi && progress
      ? Array.from({ length: 12 }).map((_, idx) => {
          const month = idx + 1;
          const monthKey = `${faturamentoYear}-${String(month).padStart(
            2,
            "0"
          )}`;
          const mensalKey = `${faturamentoKpi.id}-mensal-${monthKey}`;
          const metaKey = `${faturamentoKpi.id}-meta-mensal-${monthKey}`;

          const mensalStatus = progress[mensalKey];
          const metaStatus = progress[metaKey];

          const mensalRaw = mensalStatus?.value ?? "";
          const metaBaseRaw = metaStatus?.value ?? 0;

          const mensalNum =
            typeof mensalRaw === "number"
              ? mensalRaw
              : parseFloat(String(mensalRaw).replace(",", ".") || "0");
          const metaNum =
            typeof metaBaseRaw === "number"
              ? metaBaseRaw
              : parseFloat(String(metaBaseRaw).replace(",", ".") || "0");

          const safeMensal = Number.isNaN(mensalNum) ? 0 : mensalNum;
          const safeMeta = Number.isNaN(metaNum) ? 0 : metaNum;

          const percent =
            safeMeta > 0 ? Math.round((safeMensal / safeMeta) * 100) : 0;

          return {
            mes: String(month).padStart(2, "0"),
            Faturamento: safeMensal,
            Meta: safeMeta,
            Percentual: percent,
          };
        })
      : [];

  const faturamentoDailyRows =
    faturamentoKpi && progress
      ? Object.entries(progress)
          .filter(([key]) =>
            key.startsWith(`${faturamentoKpi.id}-diario-`)
          )
          .map(([key, status]) => {
            const parts = key.split("-");
            const dateKey = parts.slice(2).join("-");
            return { dateKey, status };
          })
          .filter((row) => row.dateKey.startsWith(dailyMonthFilter))
          .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
      : [];

  const faturamentoDailyMap = {};
  faturamentoDailyRows.forEach((row) => {
    faturamentoDailyMap[row.dateKey] = row.status;
  });

  function buildCalendarMatrix(monthKey) {
    if (!monthKey) return [];
    const [yearStr, monthStr] = monthKey.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) return [];

    const firstDay = new Date(year, monthIndex, 1);
    const firstWeekday = firstDay.getDay(); // 0 (Domingo) ... 6 (Sábado)
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const weeks = [];
    let currentDay = 1 - firstWeekday;
    while (currentDay <= daysInMonth) {
      const week = [];
      for (let i = 0; i < 7; i += 1, currentDay += 1) {
        if (currentDay < 1 || currentDay > daysInMonth) {
          week.push(null);
        } else {
          const dateKey = `${year}-${String(monthIndex + 1).padStart(
            2,
            "0"
          )}-${String(currentDay).padStart(2, "0")}`;
          week.push({ day: currentDay, dateKey });
        }
      }
      weeks.push(week);
    }
    return weeks;
  }

  const calendarWeeks =
    faturamentoKpi && dailyMonthFilter
      ? buildCalendarMatrix(dailyMonthFilter)
      : [];

  async function handleManualPeriodSubmit(e) {
    e.preventDefault();
    if (!entryKpiId) {
      alert("Selecione um KPI.");
      return;
    }

    const kpi = kpis.find((k) => k.id === Number(entryKpiId));
    if (!kpi) {
      alert("KPI selecionado não encontrado.");
      return;
    }

    let periodKey = "";
    if (entryPeriodType === "mensal") {
      if (!entryMonth) {
        alert("Selecione o mês de referência.");
        return;
      }
      periodKey = entryMonth;
    } else if (entryPeriodType === "semanal") {
      if (!entryWeekDate) {
        alert("Selecione um dia de referência da semana.");
        return;
      }
      periodKey = getWeekKey(new Date(entryWeekDate));
    }

    const hasMeta = entryMetaValue.trim() !== "";
    const hasResult = entryResultValue.trim() !== "";

    if (!hasMeta && !hasResult) {
      alert("Informe meta, resultado ou ambos para registrar.");
      return;
    }

    let metaToSave = entryMetaValue.trim();
    let resultToSave = entryResultValue.trim();

    if (kpi.unitType === "valor") {
      if (hasMeta) {
        const normalized = normalizeMoneyInput(metaToSave);
        if (!normalized) {
          alert("Meta inválida para este período.");
          return;
        }
        metaToSave = normalized;
      }
      if (hasResult) {
        const normalized = normalizeMoneyInput(resultToSave);
        if (!normalized) {
          alert("Resultado inválido para este período.");
          return;
        }
        resultToSave = normalized;
      }
    }

    const kpiIdNum = Number(entryKpiId);
    const promises = [];

    if (hasMeta) {
      const metaPeriodType =
        entryPeriodType === "mensal" ? "meta-mensal" : "meta-semanal";
      promises.push(
        updateProgress(
          kpiIdNum,
          metaPeriodType,
          true,
          metaToSave,
          "",
          { periodKey }
        )
      );
    }

    if (hasResult) {
      promises.push(
        updateProgress(
          kpiIdNum,
          entryPeriodType,
          true,
          resultToSave,
          entryComment.trim(),
          { periodKey }
        )
      );
    }

    const results = await Promise.all(promises);
    const allOk = results.every((r) => r);

    if (allOk) {
      setEntryMetaValue("");
      setEntryResultValue("");
      setEntryComment("");
    }
  }

  function handleCreateKpiSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !ownerId) return;

    const kpiData = {
      name: name.trim(),
      description: description.trim(),
      unitType,
      periodicity,
      targetWeekly:
        periodicity === "semanal" || periodicity === "semanal+mensal"
          ? Number(targetWeekly || 0)
          : undefined,
      targetMonthly:
        periodicity === "mensal" || periodicity === "semanal+mensal"
          ? Number(targetMonthly || 0)
          : undefined,
      ownerId: Number(ownerId),
    };

    onCreateKpi(kpiData);

    setName("");
    setDescription("");
    setUnitType("unidades");
    setPeriodicity("semanal+mensal");
    setTargetWeekly("");
    setTargetMonthly("");
    setOwnerId(users[0]?.id || "");
  }

  function handleCreateUserSubmit(e) {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) return;

    onCreateUser({
      name: userName,
      email: userEmail,
      password: userPassword,
      unit: userUnit || "Clínica",
    });

    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserUnit("");
  }

  function formatUnit(unitType) {
    if (unitType === "unidades") return "unid.";
    if (unitType === "percentual") return "%";
    if (unitType === "valor") return "R$";
    return "";
  }

  function getOwnerName(id) {
    const u = allUsers.find((user) => user.id === id);
    return u ? u.name : "Desconhecido";
  }

  function getProgressLabel(kpi, periodType) {
    const status = getCurrentProgress(progress, kpi.id, periodType);
    if (!status) return "Sem registro ainda";

    if (status.delivered) {
      let valueText = "";
      if (status.value) {
        if (kpi.unitType === "valor") {
          valueText = formatCurrency(status.value);
        } else {
          valueText = status.value;
        }
      }

      let text = valueText ? `Entregue (${valueText})` : "Entregue";
      if (status.comment) {
        text += ` – ${status.comment}`;
      }
      return text;
    }
    return status.comment ? `Não entregue (${status.comment})` : "Não entregue";
  }

  function renderPerfBadge(kpi) {
    const perf = getKpiPerformance(kpi, progress);

    if (perf.level === "neutro") {
      return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          Status: sem registro no período
        </span>
      );
    }

    const classes =
      perf.level === "verde"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : perf.level === "amarelo"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

    const label =
      perf.level === "verde"
        ? "Verde"
        : perf.level === "amarelo"
        ? "Amarelo"
        : "Vermelho";

    const baseText =
      perf.base === "mensal"
        ? "mês atual"
        : perf.base === "semanal"
        ? "semana atual"
        : "período atual";

    return (
      <span
        className={
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
          classes
        }
      >
        {label} · {perf.percent}% ({baseText})
      </span>
    );
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmImport = window.confirm(
      "Isso vai substituir TODOS os usuários, KPIs e registros atuais pelos dados do arquivo. Continuar?"
    );
    if (!confirmImport) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const data = JSON.parse(text);
        onImportData(data);
      } catch (err) {
        console.error(err);
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function startEditKpi(kpi) {
    setEditingKpiId(kpi.id);
    setEditName(kpi.name);
    setEditDescription(kpi.description || "");
    setEditUnitType(kpi.unitType);
    setEditPeriodicity(kpi.periodicity);
    setEditTargetWeekly(
      kpi.targetWeekly != null ? String(kpi.targetWeekly) : ""
    );
    setEditTargetMonthly(
      kpi.targetMonthly != null ? String(kpi.targetMonthly) : ""
    );
    setEditOwnerId(String(kpi.ownerId));
  }

  function cancelEditKpi() {
    setEditingKpiId(null);
    setEditName("");
    setEditDescription("");
    setEditUnitType("unidades");
    setEditPeriodicity("semanal+mensal");
    setEditTargetWeekly("");
    setEditTargetMonthly("");
    setEditOwnerId("");
  }

  function handleUpdateKpiSubmit(e) {
    e.preventDefault();
    if (!editingKpiId || !editName.trim() || !editOwnerId) return;

    const updates = {
      name: editName.trim(),
      description: editDescription.trim(),
      unitType: editUnitType,
      periodicity: editPeriodicity,
      targetWeekly:
        editPeriodicity === "semanal" || editPeriodicity === "semanal+mensal"
          ? Number(editTargetWeekly || 0)
          : undefined,
      targetMonthly:
        editPeriodicity === "mensal" || editPeriodicity === "semanal+mensal"
          ? Number(editTargetMonthly || 0)
          : undefined,
      ownerId: Number(editOwnerId),
    };

    onUpdateKpi(editingKpiId, updates);
    cancelEditKpi();
  }

  return (
    <div className="space-y-8">
      {/* DASHBOARD GERAL + BACKUP */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Dashboard geral
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportData}
              className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Exportar dados
            </button>
            <label className="text-xs rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50 cursor-pointer">
              Importar dados
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-3 md:grid-cols-4 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200">
            <div className="text-[11px] text-slate-500">KPIs cadastrados</div>
            <div className="text-xl font-semibold text-slate-900">
              {totalKpis}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200">
            <div className="text-[11px] text-slate-500">Metas cumpridas</div>
            <div className="text-xl font-semibold text-emerald-700">
              {totalDelivered}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200">
            <div className="text-[11px] text-slate-500">
              % da clínica no verde
            </div>
            <div className="text-xl font-semibold text-slate-900">
              {clinicCompletionRate}%
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 border border-slate-200">
            <div className="text-[11px] text-slate-500">
              Responsáveis ativos
            </div>
            <div className="text-xl font-semibold text-slate-900">
              {totalUsers}
            </div>
          </div>
        </div>

        {kpis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Cadastre alguns KPIs para ver os gráficos.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Metas por responsável
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpiByUserData}>
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Cumpridas" />
                    <Bar dataKey="Não cumpridas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Status geral das metas
                </h3>
                {adminOverallPie.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Sem dados de acompanhamento ainda.
                  </p>
                ) : (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={adminOverallPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          label
                        />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Ranking de responsáveis
                </h3>
                {rankingData.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhum responsável com KPIs atribuídos.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {rankingData.slice(0, 5).map((item, index) => (
                      <li
                        key={item.user.id}
                        className="flex items-center justify-between border border-slate-200 rounded-md px-2 py-1.5"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {index + 1}. {item.user.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.total === 0
                              ? "Nenhum KPI atribuído"
                              : `${item.completed}/${item.total} KPIs ≥ 100%`}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-800">
                          {item.total === 0 ? "–" : `${item.averagePercent}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Lançamento manual por período (qualquer KPI) */}
      <section className="mt-4">
	        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 mb-4">
	          <h3 className="text-sm font-semibold text-slate-800 mb-2">
	            Lançar meta e resultado por período (admin)
	          </h3>
	          <p className="text-[11px] text-slate-500 mb-3">
	            Use este painel para registrar ou corrigir metas e resultados de
	            qualquer KPI em semanas ou meses específicos. Usuários comuns
	            continuam registrando apenas o período atual.
	          </p>
	          <form
	            className="grid gap-3 md:grid-cols-4 items-end text-[11px]"
	            onSubmit={handleManualPeriodSubmit}
	          >
	            <div>
	              <label className="block text-slate-600 mb-1">KPI</label>
	              <select
	                value={entryKpiId}
	                onChange={(e) => setEntryKpiId(e.target.value)}
	                className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	              >
	                <option value="">Selecione</option>
	                {kpis.map((kpi) => (
	                  <option key={kpi.id} value={kpi.id}>
	                    {kpi.name} ({getOwnerName(kpi.ownerId)})
	                  </option>
	                ))}
	              </select>
	            </div>
	            <div>
	              <label className="block text-slate-600 mb-1">
	                Tipo de período
	              </label>
	              <select
	                value={entryPeriodType}
	                onChange={(e) => setEntryPeriodType(e.target.value)}
	                className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	              >
	                <option value="mensal">Mensal (YYYY-MM)</option>
	                <option value="semanal">Semanal (por data da semana)</option>
	              </select>
	            </div>
	            {entryPeriodType === "mensal" ? (
	              <div>
	                <label className="block text-slate-600 mb-1">
	                  Mês de referência
	                </label>
	                <input
	                  type="month"
	                  value={entryMonth}
	                  onChange={(e) => setEntryMonth(e.target.value)}
	                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	                />
	              </div>
	            ) : (
	              <div>
	                <label className="block text-slate-600 mb-1">
	                  Dia de referência da semana
	                </label>
	                <input
	                  type="date"
	                  value={entryWeekDate}
	                  onChange={(e) => setEntryWeekDate(e.target.value)}
	                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	                />
	              </div>
	            )}
	            <div className="md:col-span-4 grid gap-3 md:grid-cols-3 items-end">
	              <div>
	                <label className="block text-slate-600 mb-1">
	                  Meta para o período (opcional)
	                </label>
	                <input
	                  type="text"
	                  value={entryMetaValue}
	                  onChange={(e) => setEntryMetaValue(e.target.value)}
	                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	                  placeholder="Ex.: 80.000,00"
	                />
	              </div>
	              <div>
	                <label className="block text-slate-600 mb-1">
	                  Resultado real do período
	                </label>
	                <input
	                  type="text"
	                  value={entryResultValue}
	                  onChange={(e) => setEntryResultValue(e.target.value)}
	                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	                  placeholder="Ex.: 75.432,10"
	                />
	              </div>
	              <div>
	                <label className="block text-slate-600 mb-1">
	                  Comentário (opcional)
	                </label>
	                <input
	                  type="text"
	                  value={entryComment}
	                  onChange={(e) => setEntryComment(e.target.value)}
	                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
	                  placeholder="Atraso, campanha, etc."
	                />
	              </div>
	            </div>
	            <div className="md:col-span-4">
	              <button
	                type="submit"
	                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
	              >
	                Salvar período
	              </button>
	            </div>
	          </form>
	        </div>

	        {/* Bloco específico de faturamento */}
	        <div className="space-y-4">
	          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Faturamento mensal – edição rápida
              {faturamentoKpi ? ` (${faturamentoKpi.name})` : ""}
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Preencha os valores de faturamento bruto por mês. Você pode usar
              formato brasileiro (ex.: 68.333,79). Esses valores alimentam os
              gráficos e relatórios mensais.
            </p>
            {!faturamentoKpi && (
              <p className="text-[11px] text-red-600 mb-3">
                Nenhum KPI de faturamento foi configurado. Crie ou edite um KPI
                com unidade "Valor (R$)" e periodicidade mensal (ou semanal +
                mensal) contendo a palavra "faturamento" no nome para que os
                lançamentos sejam gravados nesta planilha.
              </p>
            )}
            <div className="mb-2 text-[11px] flex items-center gap-2">
              <span className="text-slate-600">Ano:</span>
              <input
                type="number"
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={faturamentoYear}
                onChange={(e) => {
                  const val = parseInt(e.target.value || "0", 10);
                  if (!Number.isNaN(val)) {
                    setFaturamentoYear(val);
                  }
                }}
              />
            </div>
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full text-[11px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Mês
                    </th>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Meta do mês
                    </th>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Faturamento
                    </th>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      % atingimento
                    </th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const month = idx + 1;
                    const year = faturamentoYear;
                    const monthKey = `${year}-${String(month).padStart(
                      2,
                      "0"
                    )}`;
                    const mensalKey = faturamentoKpi
                      ? `${faturamentoKpi.id}-mensal-${monthKey}`
                      : null;
                    const mensalStatus =
                      mensalKey && progress ? progress[mensalKey] : null;
                    const currentFaturamentoRaw = mensalStatus?.value || "";

                    const metaKey = faturamentoKpi
                      ? `${faturamentoKpi.id}-meta-mensal-${monthKey}`
                      : null;
                    const metaStatus =
                      metaKey && progress ? progress[metaKey] : null;
                    const metaRaw = metaStatus?.value || "";

                    const baseMetaRaw = metaRaw || "";

                    const displayMeta =
                      baseMetaRaw &&
                      faturamentoKpi &&
                      faturamentoKpi.unitType === "valor"
                        ? formatCurrency(baseMetaRaw)
                        : baseMetaRaw || "–";

                    const displayFaturamento =
                      currentFaturamentoRaw &&
                      faturamentoKpi &&
                      faturamentoKpi.unitType === "valor"
                        ? formatCurrency(currentFaturamentoRaw)
                        : currentFaturamentoRaw || "–";

                    const metaInput =
                      faturamentoMetaInputs[monthKey] ?? metaRaw ?? "";
                    const faturamentoInput =
                      faturamentoInputs[monthKey] ?? currentFaturamentoRaw ?? "";

                    const metaNum = baseMetaRaw
                      ? parseFloat(
                          String(baseMetaRaw).replace(",", ".") || "0"
                        )
                      : 0;
                    const faturamentoNum = currentFaturamentoRaw
                      ? parseFloat(
                          String(currentFaturamentoRaw).replace(",", ".") || "0"
                        )
                      : 0;

                    const hasMeta = metaNum > 0;
                    const percent =
                      hasMeta && !Number.isNaN(faturamentoNum)
                        ? Math.round((faturamentoNum / metaNum) * 100)
                        : 0;

                    return (
                      <tr
                        key={monthKey}
                        className="border-t border-slate-100"
                      >
                        <td className="px-2 py-1 text-slate-700">
                          {String(month).padStart(2, "0")}/{year}
                        </td>
                        <td className="px-2 py-1">
                          <div className="text-slate-900 mb-1">
                            {displayMeta}
                          </div>
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            placeholder="R$ 0,00"
                            value={metaInput}
                            onChange={(e) =>
                              setFaturamentoMetaInputs((prev) => ({
                                ...prev,
                                [monthKey]: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="text-slate-900 mb-1">
                            {displayFaturamento}
                          </div>
                          <input
                            type="text"
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            placeholder="R$ 0,00"
                            value={faturamentoInput}
                            onChange={(e) =>
                              setFaturamentoInputs((prev) => ({
                                ...prev,
                                [monthKey]: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-2 py-1 text-slate-900">
                          {hasMeta ? `${percent}%` : "–"}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            className="rounded-md bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
                            onClick={() => {
                              if (!faturamentoKpi) {
                                alert(
                                  "Configure primeiro um KPI de faturamento para salvar valores."
                                );
                                return;
                              }
                              const rawMeta = faturamentoMetaInputs[monthKey];
                              const rawFaturamento =
                                faturamentoInputs[monthKey];

                              if (!rawMeta && !rawFaturamento) {
                                alert(
                                  "Informe meta e/ou faturamento para atualizar."
                                );
                                return;
                              }

                              (async () => {
                                let ok = true;

                                if (rawMeta) {
                                  const normalizedMeta =
                                    normalizeMoneyInput(rawMeta);
                                  if (!normalizedMeta) {
                                    alert("Meta do mês inválida.");
                                    return;
                                  }
                                  const resOk = await updateProgress(
                                    faturamentoKpi.id,
                                    "meta-mensal",
                                    true,
                                    normalizedMeta,
                                    "",
                                    { periodKey: monthKey }
                                  );
                                  ok = ok && resOk;
                                }

                                if (rawFaturamento) {
                                  const normalizedFat =
                                    normalizeMoneyInput(rawFaturamento);
                                  if (!normalizedFat) {
                                    alert("Valor de faturamento inválido.");
                                    return;
                                  }
                                  const resOk = await updateProgress(
                                    faturamentoKpi.id,
                                    "mensal",
                                    true,
                                    normalizedFat,
                                    "",
                                    { periodKey: monthKey }
                                  );
                                  ok = ok && resOk;
                                }

                                if (ok) {
                                  setFaturamentoMetaInputs((prev) => ({
                                    ...prev,
                                    [monthKey]: "",
                                  }));
                                  setFaturamentoInputs((prev) => ({
                                    ...prev,
                                    [monthKey]: "",
                                  }));
                                }
                              })();
                            }}
                          >
                            Salvar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-800 mb-1">
                Gráfico de faturamento mensal (ano selecionado)
              </h4>
              <p className="text-[11px] text-slate-500 mb-2">
                Barras mostram o faturamento realizado; a linha indica a meta do
                mês.
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faturamentoMonthlyChartData}>
                    <XAxis dataKey="mes" fontSize={10} />
                    <YAxis
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }).format(v)
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(value),
                        name,
                      ]}
                      labelFormatter={(label) =>
                        `Mês ${label}/${faturamentoYear}`
                      }
                    />
                    <Legend />
                    <Bar dataKey="Faturamento" fill="#0ea5e9" />
                    <Line
                      type="monotone"
                      dataKey="Meta"
                      stroke="#64748b"
                      dot={{ r: 2 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Faturamento diário – calendário em grade
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Registre o faturamento bruto do dia. Os valores diários do mês
              são somados automaticamente para compor o faturamento mensal.
            </p>
            {!faturamentoKpi && (
              <p className="text-[11px] text-red-600 mb-3">
                Nenhum KPI de faturamento foi configurado. Crie ou edite um KPI
                com unidade "Valor (R$)" e periodicidade mensal (ou semanal +
                mensal) contendo "faturamento" no nome para que os lançamentos
                fiquem vinculados corretamente.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px]">
              <span className="text-slate-600">Mês de referência:</span>
              <input
                type="month"
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={dailyMonthFilter}
                onChange={(e) => setDailyMonthFilter(e.target.value)}
              />
            </div>

            {calendarWeeks.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-slate-500 mb-1">
                  <div>Dom</div>
                  <div>Seg</div>
                  <div>Ter</div>
                  <div>Qua</div>
                  <div>Qui</div>
                  <div>Sex</div>
                  <div>Sáb</div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[11px]">
                  {calendarWeeks.map((week, weekIndex) =>
                    week.map((cell, cellIndex) => {
                      if (!cell) {
                        return (
                          <div
                            key={`${weekIndex}-${cellIndex}`}
                            className="h-16 rounded-md border border-dashed border-slate-200 bg-slate-50"
                          />
                        );
                      }
                      const status = faturamentoDailyMap[cell.dateKey];
                      const hasValue = status && status.value;
                      const valueDisplay = hasValue
                        ? formatCurrency(status.value)
                        : "";
                      const isSelected = dailyDate === cell.dateKey;

                      return (
                        <button
                          key={cell.dateKey}
                          type="button"
                          onClick={() => {
                            setDailyDate(cell.dateKey);
                            if (status && status.value) {
                              const formatted =
                                new Intl.NumberFormat("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(
                                  parseFloat(
                                    String(status.value).replace(",", ".") ||
                                      "0"
                                  )
                                );
                              setDailyValue(formatted);
                            } else {
                              setDailyValue("");
                            }
                          }}
                          className={
                            "h-16 rounded-md border px-1 py-1 text-left flex flex-col justify-between " +
                            (hasValue
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-slate-200 bg-white") +
                            (isSelected ? " ring-1 ring-sky-500" : "")
                          }
                        >
                          <span className="text-[10px] font-medium text-slate-600">
                            {cell.day}
                          </span>
                          <span className="text-[10px] text-slate-800 truncate">
                            {valueDisplay}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-end gap-3 text-[11px]">
              <div>
                <label className="block text-slate-600 mb-1">
                  Data da venda
                </label>
                <input
                  type="date"
                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">
                  Valor do dia
                </label>
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="R$ 0,00"
                  value={dailyValue}
                  onChange={(e) => setDailyValue(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
                onClick={async () => {
                  if (!faturamentoKpi) {
                    alert(
                      "Configure primeiro um KPI de faturamento para registrar o dia."
                    );
                    return;
                  }
                  if (!dailyDate) {
                    alert("Selecione uma data.");
                    return;
                  }
                  const normalized = normalizeMoneyInput(dailyValue);
                  if (!normalized) {
                    alert("Informe um valor válido para o dia.");
                    return;
                  }
                  const ok = await updateProgress(
                    faturamentoKpi.id,
                    "diario",
                    true,
                    normalized,
                    "",
                    { periodKey: dailyDate }
                  );
                  if (ok) {
                    setDailyValue("");
                  }
                }}
              >
                Registrar dia
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Data
                    </th>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Valor
                    </th>
                    <th className="px-2 py-1 font-medium text-slate-600">
                      Editar
                    </th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {faturamentoDailyRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-2 text-slate-500 text-center"
                      >
                        Nenhum lançamento diário para este mês.
                      </td>
                    </tr>
                  ) : (
                    faturamentoDailyRows.map((row) => {
                      const currentValue = row.status.value || "";
                      const displayCurrent = currentValue
                        ? formatCurrency(currentValue)
                        : "R$\u00a00,00";
                      const editValue =
                        dailyEditValues[row.dateKey] ?? currentValue ?? "";
                      return (
                        <tr
                          key={row.dateKey}
                          className="border-t border-slate-100"
                        >
                          <td className="px-2 py-1 text-slate-700">
                            {row.dateKey.split("-").reverse().join("/")}
                          </td>
                          <td className="px-2 py-1 text-slate-900">
                            {displayCurrent}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                              placeholder="R$ 0,00"
                              value={editValue}
                              onChange={(e) =>
                                setDailyEditValues((prev) => ({
                                  ...prev,
                                  [row.dateKey]: e.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="px-2 py-1 text-right space-x-1">
                            <button
                              type="button"
                              className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
                              onClick={() => {
                                if (!faturamentoKpi) {
                                  alert(
                                    "Configure primeiro um KPI de faturamento para atualizar valores."
                                  );
                                  return;
                                }
                                const raw =
                                  dailyEditValues[row.dateKey] || editValue;
                                const normalized =
                                  normalizeMoneyInput(raw || currentValue);
                                if (!normalized) {
                                  alert(
                                    "Informe um valor válido para atualizar."
                                  );
                                  return;
                                }
                                updateProgress(
                                  faturamentoKpi.id,
                                  "diario",
                                  true,
                                  normalized,
                                  "",
                                  { periodKey: row.dateKey }
                                );
                              }}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 active:bg-red-800"
                              onClick={() => {
                                const confirmDelete = window.confirm(
                                  `Remover lançamento de ${row.dateKey
                                    .split("-")
                                    .reverse()
                                    .join("/")}?`
                                );
                                if (!confirmDelete) return;
                                updateProgress(
                                  faturamentoKpi.id,
                                  "diario",
                                  false,
                                  "",
                                  "",
                                  { periodKey: row.dateKey }
                                );
                              }}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </section>

      {/* Gestão de usuários */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Responsáveis (usuários)
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Cadastrar novo responsável
            </h3>
            <form className="space-y-3" onSubmit={handleCreateUserSubmit}>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="Ex.: Marcia, Michelle..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="responsavel@clinica.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="Senha inicial"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Unidade / área
                </label>
                <input
                  type="text"
                  value={userUnit}
                  onChange={(e) => setUserUnit(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="Adm Técnica, Recepção..."
                />
              </div>
              <button
                type="submit"
                className="mt-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
              >
                Criar responsável
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Lista de responsáveis
            </h3>
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum responsável cadastrado ainda.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {u.name}{" "}
                        {u.role === "admin" && (
                          <span className="text-[10px] ml-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {u.email} • {u.unit}
                      </div>
                    </div>
                    {u.role !== "admin" && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => onMakeUserAdmin(u.id)}
                          className="text-xs text-sky-600 hover:text-sky-700"
                        >
                          Tornar admin
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
         </div>
       </div>
      </section>

      {/* Criação e lista de KPIs */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Administração – KPIs
        </h2>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 mb-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Criar novo KPI
          </h3>
          <form className="space-y-3" onSubmit={handleCreateKpiSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome do KPI
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="Ex.: Vídeos nas redes sociais"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descrição
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  rows={2}
                  placeholder="Detalhe como a meta deve ser cumprida."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tipo de unidade
                </label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="unidades">Unidades</option>
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor">Valor (R$)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Periodicidade
                </label>
                <select
                  value={periodicity}
                  onChange={(e) => setPeriodicity(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="semanal+mensal">Semanal + Mensal</option>
                </select>
              </div>

              {(periodicity === "semanal" ||
                periodicity === "semanal+mensal") && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Meta semanal
                  </label>
                  <input
                    type="number"
                    value={targetWeekly}
                    onChange={(e) => setTargetWeekly(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Ex.: 2"
                  />
                </div>
              )}

              {(periodicity === "mensal" ||
                periodicity === "semanal+mensal") && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Meta mensal
                  </label>
                  <input
                    type="number"
                    value={targetMonthly}
                    onChange={(e) => setTargetMonthly(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="Ex.: 8"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Responsável
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Selecione</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800"
              >
                Criar KPI
              </button>
            </div>
          </form>
        </div>

        {/* Lista de KPIs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            KPIs cadastrados
          </h3>
          {kpis.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum KPI cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="bg-white rounded-xl shadow-sm p-4 border border-slate-200"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {kpi.name}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        {kpi.description}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Responsável: {getOwnerName(kpi.ownerId)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Unidade: {formatUnit(kpi.unitType)} | Periodicidade:{" "}
                        {kpi.periodicity}
                        {kpi.targetWeekly != null &&
                          ` | Meta semanal: ${
                            kpi.unitType === "valor"
                              ? formatCurrency(kpi.targetWeekly)
                              : `${kpi.targetWeekly} ${formatUnit(
                                  kpi.unitType
                                )}`
                          }`}
                        {kpi.targetMonthly != null &&
                          ` | Meta mensal: ${
                            kpi.unitType === "valor"
                              ? formatCurrency(kpi.targetMonthly)
                              : `${kpi.targetMonthly} ${formatUnit(
                                  kpi.unitType
                                )}`
                          }`}
                      </p>
                      <div className="mt-2">{renderPerfBadge(kpi)}</div>
                    </div>
                    <div className="flex flex-col gap-1 self-start">
                      <button
                        onClick={() => startEditKpi(kpi)}
                        className="text-xs text-sky-600 hover:text-sky-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDeleteKpi(kpi.id)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px] text-slate-600">
                    {(kpi.periodicity === "semanal" ||
                      kpi.periodicity === "semanal+mensal") && (
                      <div>
                        <div className="font-semibold mb-1">
                          Semana atual – status:
                        </div>
                        <div>{getProgressLabel(kpi, "semanal")}</div>
                      </div>
                    )}
                    {(kpi.periodicity === "mensal" ||
                      kpi.periodicity === "semanal+mensal") && (
                      <div>
                        <div className="font-semibold mb-1">
                          Mês atual – status:
                        </div>
                        <div>{getProgressLabel(kpi, "mensal")}</div>
                      </div>
                    )}
                  </div>

                  <HistoryBlock kpi={kpi} progress={progress} />

                  {editingKpiId === kpi.id && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <h4 className="text-xs font-semibold text-slate-800 mb-2">
                        Editar KPI
                      </h4>
                      <form
                        className="space-y-2 text-xs"
                        onSubmit={handleUpdateKpiSubmit}
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Nome
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Descrição
                            </label>
                            <textarea
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              rows={2}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Tipo de unidade
                            </label>
                            <select
                              value={editUnitType}
                              onChange={(e) => setEditUnitType(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="unidades">Unidades</option>
                              <option value="percentual">Percentual (%)</option>
                              <option value="valor">Valor (R$)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Periodicidade
                            </label>
                            <select
                              value={editPeriodicity}
                              onChange={(e) =>
                                setEditPeriodicity(e.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="semanal">Semanal</option>
                              <option value="mensal">Mensal</option>
                              <option value="semanal+mensal">
                                Semanal + Mensal
                              </option>
                            </select>
                          </div>
                          {(editPeriodicity === "semanal" ||
                            editPeriodicity === "semanal+mensal") && (
                            <div>
                              <label className="block text-[11px] text-slate-600 mb-1">
                                Meta semanal
                              </label>
                              <input
                                type="number"
                                value={editTargetWeekly}
                                onChange={(e) =>
                                  setEditTargetWeekly(e.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                              />
                            </div>
                          )}
                          {(editPeriodicity === "mensal" ||
                            editPeriodicity === "semanal+mensal") && (
                            <div>
                              <label className="block text-[11px] text-slate-600 mb-1">
                                Meta mensal
                              </label>
                              <input
                                type="number"
                                value={editTargetMonthly}
                                onChange={(e) =>
                                  setEditTargetMonthly(e.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Responsável
                            </label>
                            <select
                              value={editOwnerId}
                              onChange={(e) => setEditOwnerId(e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="">Selecione</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.unit})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
                          >
                            Salvar alterações
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditKpi}
                            className="rounded-md border border-slate-300 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// Histórico (admin, por KPI)

function HistoryBlock({ kpi, progress }) {
  const weeklyHistory =
    kpi.periodicity === "semanal" || kpi.periodicity === "semanal+mensal"
      ? getKpiHistory(kpi, "semanal", progress, 4)
      : [];
  const monthlyHistory =
    kpi.periodicity === "mensal" || kpi.periodicity === "semanal+mensal"
      ? getKpiHistory(kpi, "mensal", progress, 6)
      : [];

  if (weeklyHistory.length === 0 && monthlyHistory.length === 0) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-2">
        <p className="text-[11px] text-slate-500">
          Sem histórico ainda para este KPI.
        </p>
      </div>
    );
  }

  const renderItem = (item) => {
    const colorClass =
      item.level === "verde"
        ? "text-emerald-700"
        : item.level === "amarelo"
        ? "text-amber-700"
        : "text-red-700";

    let statusText;
    if (item.status.delivered) {
      let valueText = "";
      if (item.status.value) {
        if (kpi.unitType === "valor") {
          valueText = formatCurrency(item.status.value);
        } else {
          valueText = item.status.value;
        }
      }
      statusText = valueText ? `Entregue (${valueText})` : "Entregue";
      if (item.status.comment) {
        statusText += ` – ${item.status.comment}`;
      }
    } else {
      statusText = item.status.comment
        ? `Não entregue (${item.status.comment})`
        : "Não entregue";
    }

    return (
      <li key={item.periodKey} className="flex justify-between gap-2">
        <span className="text-slate-500">{item.label}</span>
        <span className={colorClass}>
          {item.percent}% · {statusText}
        </span>
      </li>
    );
  };

  return (
    <div className="mt-3 border-t border-slate-100 pt-2 text-[11px]">
      {weeklyHistory.length > 0 && (
        <div className="mb-2">
          <div className="font-semibold text-slate-700 mb-1">
            Histórico semanal (últimas {weeklyHistory.length} semanas)
          </div>
          <ul className="space-y-0.5">{weeklyHistory.map(renderItem)}</ul>
        </div>
      )}
      {monthlyHistory.length > 0 && (
        <div>
          <div className="font-semibold text-slate-700 mb-1">
            Histórico mensal (últimos {monthlyHistory.length} meses)
          </div>
          <ul className="space-y-0.5">{monthlyHistory.map(renderItem)}</ul>
        </div>
      )}
    </div>
  );
}

// ================== USER ==================

function UserDashboard({
  currentUser,
  kpis,
  progress,
  periodStatus,
  historyEntries,
  updateProgress,
}) {
  const myKpis = kpis.filter((k) => k.ownerId === currentUser.id);

  const [selectedKpiId, setSelectedKpiId] = useState(
    myKpis[0]?.id || null
  );
  const [monthlySeries, setMonthlySeries] = useState([]);
  const [monthlySeriesError, setMonthlySeriesError] = useState("");
  const [monthlySeriesLoading, setMonthlySeriesLoading] = useState(false);

  useEffect(() => {
    if (!selectedKpiId) {
      setMonthlySeries([]);
      setMonthlySeriesError("");
      return;
    }

    let cancelled = false;

    async function loadSeries() {
      try {
        setMonthlySeriesLoading(true);
        setMonthlySeriesError("");
        const res = await fetch(
          `${API_BASE_URL}/api/kpis/${selectedKpiId}/series/monthly`,
          { credentials: "include" }
        );

        if (res.status === 401) {
          window.alert("Sessão expirada. Faça login novamente.");
          window.location.reload();
          return;
        }

        if (!res.ok) {
          setMonthlySeriesError("Erro ao carregar série mensal.");
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setMonthlySeries(Array.isArray(data.series) ? data.series : []);
        }
      } catch (err) {
        console.error("Erro ao carregar série mensal:", err);
        if (!cancelled) {
          setMonthlySeriesError("Erro ao carregar série mensal.");
        }
      } finally {
        if (!cancelled) {
          setMonthlySeriesLoading(false);
        }
      }
    }

    loadSeries();

    return () => {
      cancelled = true;
    };
  }, [selectedKpiId]);

  const chartData = myKpis.map((kpi) => {
    const weeklyStatus = getCurrentProgress(progress, kpi.id, "semanal");
    const monthlyStatus = getCurrentProgress(progress, kpi.id, "mensal");

    let semanal = 0;
    let mensal = 0;

    if (
      (kpi.periodicity === "semanal" ||
        kpi.periodicity === "semanal+mensal") &&
      weeklyStatus &&
      weeklyStatus.delivered
    ) {
      const delivered = parseFloat(weeklyStatus.value || "0");
      if (kpi.targetWeekly && kpi.targetWeekly > 0 && !isNaN(delivered)) {
        semanal = Math.round((delivered / kpi.targetWeekly) * 100);
      } else {
        semanal = 100;
      }
    }

    if (
      (kpi.periodicity === "mensal" ||
        kpi.periodicity === "semanal+mensal") &&
      monthlyStatus &&
      monthlyStatus.delivered
    ) {
      const delivered = parseFloat(monthlyStatus.value || "0");
      if (kpi.targetMonthly && kpi.targetMonthly > 0 && !isNaN(delivered)) {
        mensal = Math.round((delivered / kpi.targetMonthly) * 100);
      } else {
        mensal = 100;
      }
    }

    return {
      name: kpi.name.split("–")[0].trim(),
      Semanal: semanal,
      Mensal: mensal,
    };
  });

  const myHistory = historyEntries.filter(
    (entry) => entry.userId === currentUser.id
  );

  return (
    <div className="space-y-6">
      {myKpis.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Dashboard das minhas metas
          </h2>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs text-slate-600 mb-2">
              Cada barra mostra o % da meta semanal / mensal atingida no período
              atual. Se passar de 100%, significa que você superou a meta.
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis
                    domain={[0, "dataMax + 20"]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="Semanal" />
                  <Bar dataKey="Mensal" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {myKpis.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Evolução mensal por KPI
          </h2>
          <p className="text-xs text-slate-600 mb-2">
            Selecione um KPI para ver a evolução mensal consolidada. Para KPIs
            semanais, os valores são somados por mês.
          </p>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                KPI
              </label>
              <select
                value={selectedKpiId || ""}
                onChange={(e) =>
                  setSelectedKpiId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Selecione um KPI</option>
                {myKpis.map((kpi) => (
                  <option key={kpi.id} value={kpi.id}>
                    {kpi.name}
                  </option>
                ))}
              </select>
            </div>

            {monthlySeriesLoading && (
              <p className="text-xs text-slate-500">Carregando gráfico...</p>
            )}
            {monthlySeriesError && (
              <p className="text-xs text-red-600">{monthlySeriesError}</p>
            )}
            {!monthlySeriesLoading &&
              !monthlySeriesError &&
              selectedKpiId &&
              monthlySeries.length === 0 && (
                <p className="text-xs text-slate-500">
                  Ainda não há registros mensais para este KPI.
                </p>
              )}
            {!monthlySeriesLoading && monthlySeries.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlySeries.map((m) => ({
                      mes: m.label,
                      Valor: m.value,
                      Meta: m.target || 0,
                    }))}
                  >
                    <XAxis dataKey="mes" fontSize={10} />
                    <YAxis
                      tickFormatter={(v) => v.toLocaleString("pt-BR")}
                      fontSize={10}
                    />
                    <Tooltip
                      formatter={(v, name) =>
                        name === "Valor"
                          ? formatCurrency(v)
                          : name === "Meta"
                          ? formatCurrency(v)
                          : v
                      }
                    />
                    <Legend />
                    <Bar dataKey="Valor" name="Valor realizado" fill="#0ea5e9" />
                    <Line
                      type="monotone"
                      dataKey="Meta"
                      name="Meta mensal"
                      stroke="#f97316"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Minhas metas
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Registre se você está cumprindo as metas semanais e mensais da
          clínica.
        </p>

        {myKpis.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum KPI atribuído a você ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {myKpis.map((kpi) => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                progress={progress}
                periodStatus={periodStatus}
                isAdminUser={isAdminUserClient(currentUser)}
                updateProgress={updateProgress}
              />
            ))}
          </div>
        )}
      </section>

      {myHistory.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Histórico dos meus registros
          </h2>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <p className="text-xs text-slate-600 mb-2">
              Últimos registros enviados por você (semana e mês), com período e
              prazo calculados pelo sistema.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-1 pr-2 font-medium text-slate-600">
                      KPI
                    </th>
                    <th className="py-1 px-2 font-medium text-slate-600">
                      Período
                    </th>
                    <th className="py-1 px-2 font-medium text-slate-600">
                      Valor
                    </th>
                    <th className="py-1 px-2 font-medium text-slate-600">
                      Prazo
                    </th>
                    <th className="py-1 px-2 font-medium text-slate-600">
                      Enviado em
                    </th>
                    <th className="py-1 pl-2 font-medium text-slate-600">
                      Comentário
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myHistory.slice(0, 100).map((entry) => {
                    const kpi = kpis.find((k) => k.id === entry.kpiId);
                    const start =
                      entry.startDate && new Date(entry.startDate);
                    const end = entry.endDate && new Date(entry.endDate);
                    const due = entry.dueDate && new Date(entry.dueDate);
                    const submitted =
                      entry.submittedAt && new Date(entry.submittedAt);
                    const periodLabel =
                      start && end
                        ? `${start.toLocaleDateString(
                            "pt-BR"
                          )} → ${end.toLocaleDateString("pt-BR")}`
                        : entry.periodKey;
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="py-1 pr-2 text-slate-900">
                          {kpi ? kpi.name : `KPI #${entry.kpiId}`}
                        </td>
                        <td className="py-1 px-2 text-slate-700">
                          {periodLabel}
                        </td>
                        <td className="py-1 px-2 text-slate-700">
                          {entry.delivered && entry.value
                            ? kpi && kpi.unitType === "valor"
                              ? formatCurrency(entry.value)
                              : entry.value
                            : "-"}
                        </td>
                        <td className="py-1 px-2 text-slate-700">
                          {due
                            ? due.toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td className="py-1 px-2 text-slate-700">
                          {submitted
                            ? submitted.toLocaleString("pt-BR")
                            : "-"}
                        </td>
                        <td className="py-1 pl-2 text-slate-600">
                          {entry.comment || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({ kpi, progress, periodStatus, isAdminUser, updateProgress }) {
  const [weeklyValue, setWeeklyValue] = useState("");
  const [weeklyComment, setWeeklyComment] = useState("");

  const [monthlyValue, setMonthlyValue] = useState("");
  const [monthlyComment, setMonthlyComment] = useState("");

  const weeklyStatus = getCurrentProgress(progress, kpi.id, "semanal");
  const monthlyStatus = getCurrentProgress(progress, kpi.id, "mensal");

  const perf = getKpiPerformance(kpi, progress);

  const weeklyInfo = periodStatus?.weekly || null;
  const monthlyInfo = periodStatus?.monthly || null;

  const weeklyClosed =
    !isAdminUser && weeklyInfo && weeklyInfo.entryOpen === false;
  const monthlyClosed =
    !isAdminUser && monthlyInfo && monthlyInfo.entryOpen === false;

  function formatDueDateLabel(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    try {
      return d.toLocaleDateString("pt-BR");
    } catch (e) {
      return null;
    }
  }

  function formatUnit(unitType) {
    if (unitType === "unidades") return "unid.";
    if (unitType === "percentual") return "%";
    if (unitType === "valor") return "R$";
    return "";
  }

  function submitWeekly(e) {
    e.preventDefault();
    const raw = weeklyValue.trim();
    const hasValue = raw !== "";
    const hasComment = weeklyComment.trim() !== "";

    if (!hasValue && !hasComment) {
      alert("Informe um valor ou comentário para registrar a semana.");
      return;
    }

    let valueToSave = raw;
    if (kpi.unitType === "valor" && hasValue) {
      const normalized = normalizeMoneyInput(raw);
      if (!normalized) {
        alert("Informe um valor semanal válido (ex.: 8.000,00).");
        return;
      }
      valueToSave = normalized;
    }

    const delivered = hasValue;

    if (delivered) {
      const target = kpi.targetWeekly;
      const deliveredNum = parseFloat(valueToSave);

      if (
        target &&
        target > 0 &&
        !Number.isNaN(deliveredNum) &&
        deliveredNum < target &&
        !weeklyComment.trim()
      ) {
        alert(
          "Justificativa obrigatória quando o valor entregue é menor que a meta semanal."
        );
        return;
      }
    }

    updateProgress(
      kpi.id,
      "semanal",
      delivered,
      delivered ? valueToSave : "",
      weeklyComment
    );

    setWeeklyValue("");
    setWeeklyComment("");
  }

  function submitMonthly(e) {
    e.preventDefault();
    const raw = monthlyValue.trim();
    const hasValue = raw !== "";
    const hasComment = monthlyComment.trim() !== "";

    if (!hasValue && !hasComment) {
      alert("Informe um valor ou comentário para registrar o mês.");
      return;
    }

    let valueToSave = raw;
    if (kpi.unitType === "valor" && hasValue) {
      const normalized = normalizeMoneyInput(raw);
      if (!normalized) {
        alert("Informe um valor mensal válido (ex.: 80.000,00).");
        return;
      }
      valueToSave = normalized;
    }

    const delivered = hasValue;

    if (delivered) {
      const target = kpi.targetMonthly;
      const deliveredNum = parseFloat(valueToSave);

      if (
        target &&
        target > 0 &&
        !Number.isNaN(deliveredNum) &&
        deliveredNum < target &&
        !monthlyComment.trim()
      ) {
        alert(
          "Justificativa obrigatória quando o valor entregue é menor que a meta mensal."
        );
        return;
      }
    }

    updateProgress(
      kpi.id,
      "mensal",
      delivered,
      delivered ? valueToSave : "",
      monthlyComment
    );

    setMonthlyValue("");
    setMonthlyComment("");
  }

  function renderPerfBadge() {
    if (perf.level === "neutro") {
      return (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          Status: sem registro no período
        </span>
      );
    }

    const classes =
      perf.level === "verde"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : perf.level === "amarelo"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

    const label =
      perf.level === "verde"
        ? "Verde"
        : perf.level === "amarelo"
        ? "Amarelo"
        : "Vermelho";

    const baseText =
      perf.base === "mensal"
        ? "mês atual"
        : perf.base === "semanal"
        ? "semana atual"
        : "período atual";

    return (
      <span
        className={
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
          classes
        }
      >
        {label} · {perf.percent}% ({baseText})
      </span>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{kpi.name}</h3>
          <p className="text-xs text-slate-600 mt-1">{kpi.description}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Unidade: {formatUnit(kpi.unitType)}
            {kpi.targetWeekly != null &&
              ` | Meta semanal: ${
                kpi.unitType === "valor"
                  ? formatCurrency(kpi.targetWeekly)
                  : `${kpi.targetWeekly} ${formatUnit(kpi.unitType)}`
              }`}
            {kpi.targetMonthly != null &&
              ` | Meta mensal: ${
                kpi.unitType === "valor"
                  ? formatCurrency(kpi.targetMonthly)
                  : `${kpi.targetMonthly} ${formatUnit(kpi.unitType)}`
              }`}
          </p>
        </div>
        <div className="ml-2">{renderPerfBadge()}</div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(kpi.periodicity === "semanal" ||
          kpi.periodicity === "semanal+mensal") && (
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-800 mb-1">
              Semana atual
            </div>
            {weeklyInfo && (
              <p className="text-[11px] text-slate-500 mb-1">
                {weeklyClosed
                  ? `Prazo encerrado em ${formatDueDateLabel(
                      weeklyInfo.dueDate
                    )}. Fale com o admin para ajustes.`
                  : `Prazo para registro até ${formatDueDateLabel(
                      weeklyInfo.dueDate
                    )}.`}
              </p>
            )}
            {weeklyStatus && (
              <p className="text-[11px] text-slate-500 mb-2">
                Último registro:{" "}
                {(() => {
                  if (weeklyStatus.delivered) {
                    let valueText = "";
                    if (weeklyStatus.value) {
                      if (kpi.unitType === "valor") {
                        valueText = formatCurrency(weeklyStatus.value);
                      } else {
                        valueText = weeklyStatus.value;
                      }
                    }
                    let text = valueText
                      ? `Meta entregue (${valueText})`
                      : "Meta entregue";
                    if (weeklyStatus.comment) {
                      text += ` – ${weeklyStatus.comment}`;
                    }
                    return text;
                  }
                  return weeklyStatus.comment
                    ? `Meta não entregue (${weeklyStatus.comment})`
                    : "Meta não entregue";
                })()}
              </p>
            )}
            <form className="space-y-2" onSubmit={submitWeekly}>
              <input
                type="text"
                value={weeklyValue}
                onChange={(e) => setWeeklyValue(e.target.value)}
                placeholder={
                  kpi.unitType === "valor"
                    ? "Valor entregue na semana (ex.: 8.000,00)"
                    : `Valor entregue (ex.: 8 ${formatUnit(kpi.unitType)})`
                }
                disabled={weeklyClosed}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <textarea
                value={weeklyComment}
                onChange={(e) => setWeeklyComment(e.target.value)}
                placeholder="Comentário (use se entregou abaixo da meta, teve atraso, etc. ou para justificar não entrega)"
                rows={2}
                disabled={weeklyClosed}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />

              <button
                type="submit"
                disabled={weeklyClosed}
                className="mt-1 w-full rounded-md bg-emerald-600 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Registrar semana
              </button>
            </form>
          </div>
        )}

        {(kpi.periodicity === "mensal" ||
          kpi.periodicity === "semanal+mensal") && (
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-800 mb-1">
              Mês atual
            </div>
            {monthlyInfo && (
              <p className="text-[11px] text-slate-500 mb-1">
                {monthlyClosed
                  ? `Prazo encerrado em ${formatDueDateLabel(
                      monthlyInfo.dueDate
                    )}. Fale com o admin para ajustes.`
                  : `Prazo para registro até ${formatDueDateLabel(
                      monthlyInfo.dueDate
                    )}.`}
              </p>
            )}
            {monthlyStatus && (
              <p className="text-[11px] text-slate-500 mb-2">
                Último registro:{" "}
                {(() => {
                  if (monthlyStatus.delivered) {
                    let valueText = "";
                    if (monthlyStatus.value) {
                      if (kpi.unitType === "valor") {
                        valueText = formatCurrency(monthlyStatus.value);
                      } else {
                        valueText = monthlyStatus.value;
                      }
                    }
                    let text = valueText
                      ? `Meta entregue (${valueText})`
                      : "Meta entregue";
                    if (monthlyStatus.comment) {
                      text += ` – ${monthlyStatus.comment}`;
                    }
                    return text;
                  }
                  return monthlyStatus.comment
                    ? `Meta não entregue (${monthlyStatus.comment})`
                    : "Meta não entregue";
                })()}
              </p>
            )}
            <form className="space-y-2" onSubmit={submitMonthly}>
              <input
                type="text"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                placeholder={
                  kpi.unitType === "valor"
                    ? "Valor entregue no mês (ex.: 80.000,00)"
                    : `Valor entregue (ex.: 30 ${formatUnit(kpi.unitType)})`
                }
                disabled={monthlyClosed}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <textarea
                value={monthlyComment}
                onChange={(e) => setMonthlyComment(e.target.value)}
                placeholder="Comentário (use se entregou abaixo da meta, teve atraso, etc. ou para justificar não entrega)"
                rows={2}
                disabled={monthlyClosed}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />

              <button
                type="submit"
                disabled={monthlyClosed}
                className="mt-1 w-full rounded-md bg-emerald-600 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Registrar mês
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
