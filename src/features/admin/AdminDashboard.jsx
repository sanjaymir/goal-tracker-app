import React, { useState } from "react";
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
import {
  getCurrentProgress,
  getKpiPerformance,
  getKpiHistory,
} from "../../utils/kpiHelpers";
import { normalizeMoneyInput, formatCurrency } from "../../utils/formatters";

function AdminDashboard({
  users,
  allUsers,
  kpis,
  progress,
  updateProgress,
  onCreateUser,
  onDeleteUser,
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

  const [editingKpiId, setEditingKpiId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUnitType, setEditUnitType] = useState("unidades");
  const [editPeriodicity, setEditPeriodicity] = useState("semanal+mensal");
  const [editTargetWeekly, setEditTargetWeekly] = useState("");
  const [editTargetMonthly, setEditTargetMonthly] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");

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
  const [adminYearFilter, setAdminYearFilter] = useState(
    new Date().getFullYear()
  );
  const [faturamentoYear, setFaturamentoYear] = useState(
    new Date().getFullYear()
  );

  function getKpiYearPerformance(kpi, progressMap, year) {
    const yearStr = String(year);
    const prefixMensal = `${kpi.id}-mensal-`;

    let monthsWithData = 0;
    let completedMonths = 0;
    let sumPercent = 0;

    Object.entries(progressMap).forEach(([key, status]) => {
      if (!key.startsWith(prefixMensal)) return;
      const periodKey = key.slice(prefixMensal.length);
      if (!periodKey.startsWith(yearStr)) return;
      if (!status || !status.delivered) return;

      const monthKey = periodKey;
      const metaKey = `${kpi.id}-meta-mensal-${monthKey}`;
      const metaStatus = progressMap[metaKey];

      let target =
        metaStatus && metaStatus.value
          ? parseFloat(metaStatus.value || "0")
          : kpi.targetMonthly || 0;

      if (!target || Number.isNaN(target) || target <= 0) {
        target = 0;
      }

      const deliveredValue = parseFloat(status.value || "0");
      if (Number.isNaN(deliveredValue)) return;

      let percent = 0;
      if (target > 0) {
        percent = Math.round((deliveredValue / target) * 100);
      } else if (deliveredValue > 0) {
        percent = 100;
      }

      percent = Math.max(0, Math.min(percent, 200));

      monthsWithData += 1;
      sumPercent += percent;
      if (percent >= 100) completedMonths += 1;
    });

    const averagePercent =
      monthsWithData === 0 ? 0 : Math.round(sumPercent / monthsWithData);

    return {
      monthsWithData,
      completedMonths,
      averagePercent,
    };
  }

  function isKpiDelivered(kpi) {
    if (adminYearFilter) {
      const perfYear = getKpiYearPerformance(kpi, progress, adminYearFilter);
      if (perfYear.monthsWithData > 0) {
        return perfYear.completedMonths > 0;
      }
    }

    const weeklyStatus = getCurrentProgress(progress, kpi.id, "semanal");
    const monthlyStatus = getCurrentProgress(progress, kpi.id, "mensal");

    if (kpi.periodicity === "semanal") {
      return weeklyStatus && weeklyStatus.delivered;
    }
    if (kpi.periodicity === "mensal") {
      return monthlyStatus && monthlyStatus.delivered;
    }
    if (monthlyStatus && monthlyStatus.delivered) return true;
    if (weeklyStatus && weeklyStatus.delivered) return true;
    return false;
  }

  const adminUsers = allUsers.filter((u) => u.role === "user");

  const kpiByUserData = adminUsers.map((u) => {
    const userKpis = kpis.filter((k) => k.ownerId === u.id);
    const total = userKpis.length;
    let completed = 0;
    userKpis.forEach((k) => {
      if (isKpiDelivered(k)) completed += 1;
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
    if (isKpiDelivered(k)) totalDelivered += 1;
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
        const perfYear = getKpiYearPerformance(k, progress, adminYearFilter);
        if (perfYear.monthsWithData > 0) {
          sumPercent += perfYear.averagePercent;
          countWithData += 1;
          if (perfYear.averagePercent >= 100) {
            completed += 1;
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
      (k.periodicity === "mensal" || k.periodicity === "semanal+mensal") &&
      k.name.toLowerCase().includes("faturamento")
  );

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
    const firstWeekday = firstDay.getDay();
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

  const faturamentoMonthlyChartData =
    faturamentoKpi && progress
      ? Array.from({ length: 12 }).map((_, idx) => {
          const month = idx + 1;
          const monthKey = `${faturamentoYear}-${String(
            month
          ).padStart(2, "0")}`;
          const mensalKey = `${faturamentoKpi.id}-mensal-${monthKey}`;
          const metaKey = `${faturamentoKpi.id}-meta-mensal-${monthKey}`;

          const mensalStatus = progress[mensalKey];
          const metaStatus = progress[metaKey];

          const mensalRaw = mensalStatus?.value ?? "";
          const metaBaseRaw =
            metaStatus?.value ??
            (faturamentoKpi.targetMonthly != null
              ? faturamentoKpi.targetMonthly
              : 0);

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

  function formatUnit(unitTypeValue) {
    if (unitTypeValue === "unidades") return "unid.";
    if (unitTypeValue === "percentual") return "%";
    if (unitTypeValue === "valor") return "R$";
    return "";
  }

  function getOwnerName(id) {
    const u = allUsers.find((user) => user.id === id);
    return u ? u.name : "Desconhecido";
  }

  function getProgressLabel(kpiId, periodType) {
    const status = getCurrentProgress(progress, kpiId, periodType);
    if (!status) return "Sem registro ainda";

    if (status.delivered) {
      let valueText = status.value;
      const kpi = kpis.find((item) => item.id === kpiId);
      if (kpi && kpi.unitType === "valor" && status.value) {
        valueText = formatCurrency(status.value);
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
      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
        <span className="font-semibold text-slate-600">
          Navegação do admin:
        </span>
        <a
          href="#admin-dashboard"
          className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Dashboard
        </a>
        <a
          href="#admin-cadastros"
          className="px-2 py-1 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Cadastros
        </a>
      </div>

      <section id="admin-dashboard">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Dashboard geral
            </h2>
            <div className="flex items-center gap-1 text-[11px] text-slate-600">
              <span>Ano de análise:</span>
              <input
                type="number"
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={adminYearFilter}
                onChange={(e) => {
                  const val = parseInt(e.target.value || "0", 10);
                  if (!Number.isNaN(val)) {
                    setAdminYearFilter(val);
                  }
                }}
              />
            </div>
          </div>
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

        {faturamentoKpi && (
          <div className="mt-4 bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Faturamento mensal – edição rápida ({faturamentoKpi.name})
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Preencha os valores de faturamento bruto por mês. Você pode usar
              formato brasileiro (ex.: 68.333,79). Esses valores alimentam os
              gráficos e relatórios mensais.
            </p>
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
            <div className="overflow-x-auto">
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
                    const progressKey = `${faturamentoKpi.id}-mensal-${monthKey}`;
                    const status = progress[progressKey];
                    const currentFaturamentoRaw = status?.value || "";

                    const metaKey = `${faturamentoKpi.id}-meta-mensal-${monthKey}`;
                    const metaStatus = progress[metaKey];
                    const metaRaw = metaStatus?.value || "";

                    const baseMetaRaw =
                      metaRaw ||
                      (faturamentoKpi.targetMonthly != null
                        ? String(faturamentoKpi.targetMonthly)
                        : "");

                    const displayMeta =
                      baseMetaRaw && faturamentoKpi.unitType === "valor"
                        ? formatCurrency(baseMetaRaw)
                        : baseMetaRaw || "–";

                    const displayFaturamento =
                      currentFaturamentoRaw &&
                      faturamentoKpi.unitType === "valor"
                        ? formatCurrency(currentFaturamentoRaw)
                        : currentFaturamentoRaw || "–";

                    const metaInput =
                      faturamentoMetaInputs[monthKey] ??
                      (metaRaw
                        ? new Intl.NumberFormat("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(
                            parseFloat(
                              String(metaRaw).replace(",", ".") || "0"
                            )
                          )
                        : "");

                    const faturamentoInput =
                      faturamentoInputs[monthKey] ??
                      (currentFaturamentoRaw
                        ? new Intl.NumberFormat("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(
                            parseFloat(
                              String(currentFaturamentoRaw).replace(
                                ",",
                                "."
                              ) || "0"
                            )
                          )
                        : "");

                    const metaNum = baseMetaRaw
                      ? parseFloat(
                          String(baseMetaRaw).replace(",", ".") || "0"
                        )
                      : 0;
                    const faturamentoNum = currentFaturamentoRaw
                      ? parseFloat(
                          String(currentFaturamentoRaw).replace(",", ".") ||
                            "0"
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
                              const rawMeta = faturamentoMetaInputs[monthKey];
                              const rawFaturamento =
                                faturamentoInputs[monthKey];

                              if (!rawMeta && !rawFaturamento) {
                                alert(
                                  "Informe meta e/ou faturamento para atualizar."
                                );
                                return;
                              }

                              if (rawMeta) {
                                const normalizedMeta =
                                  normalizeMoneyInput(rawMeta);
                                if (!normalizedMeta) {
                                  alert("Meta do mês inválida.");
                                  return;
                                }
                                updateProgress(
                                  faturamentoKpi.id,
                                  "meta-mensal",
                                  true,
                                  normalizedMeta,
                                  "",
                                  { periodKey: monthKey }
                                );
                              }

                              if (rawFaturamento) {
                                const normalizedFat =
                                  normalizeMoneyInput(rawFaturamento);
                                if (!normalizedFat) {
                                  alert("Valor de faturamento inválido.");
                                  return;
                                }
                                updateProgress(
                                  faturamentoKpi.id,
                                  "mensal",
                                  true,
                                  normalizedFat,
                                  "",
                                  { periodKey: monthKey }
                                );
                              }

                              setFaturamentoMetaInputs((prev) => {
                                const next = { ...prev };
                                delete next[monthKey];
                                return next;
                              });
                              setFaturamentoInputs((prev) => {
                                const next = { ...prev };
                                delete next[monthKey];
                                return next;
                              });
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
                Gráfico de faturamento mensal (ano atual)
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
        )}

        {faturamentoKpi && (
          <div className="mt-4 bg-white rounded-xl shadow-sm p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Faturamento diário – calendário simples
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Registre o faturamento bruto do dia. Os valores diários do mês
              são somados automaticamente para compor o faturamento mensal.
            </p>

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
                onClick={() => {
                  if (!dailyDate) {
                    alert("Selecione uma data.");
                    return;
                  }
                  const normalized = normalizeMoneyInput(dailyValue);
                  if (!normalized) {
                    alert("Informe um valor válido para o dia.");
                    return;
                  }
                  updateProgress(
                    faturamentoKpi.id,
                    "diario",
                    true,
                    normalized,
                    "",
                    { periodKey: dailyDate }
                  );
                  setDailyValue("");
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
                        dailyEditValues[row.dateKey] ??
                        (currentValue
                          ? new Intl.NumberFormat("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(
                              parseFloat(
                                String(currentValue).replace(",", ".") || "0"
                              )
                            )
                          : "");
                      return (
                        <tr
                          key={row.dateKey}
                          className="border-top border-slate-100"
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
        )}
      </section>

      <div id="admin-cadastros" className="space-y-8">
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
                          {u.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.email} • {u.unit}
                        </div>
                      </div>
                      {u.role !== "admin" && (
                        <button
                          onClick={() => onDeleteUser(u.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Excluir
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

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
                    Descrição / detalhes da meta
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
                          Unidade: {formatUnit(kpi.unitType)} • Periodicidade:{" "}
                          {kpi.periodicity === "semanal"
                            ? "Semanal"
                            : kpi.periodicity === "mensal"
                            ? "Mensal"
                            : "Semanal + Mensal"}{" "}
                          • Responsável: {getOwnerName(kpi.ownerId)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {kpi.targetWeekly != null &&
                            `Meta semanal: ${kpi.targetWeekly} ${formatUnit(
                              kpi.unitType
                            )} • `}
                          {kpi.targetMonthly != null &&
                            `Meta mensal: ${kpi.targetMonthly} ${formatUnit(
                              kpi.unitType
                            )}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Status semanal: {getProgressLabel(kpi.id, "semanal")}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Status mensal: {getProgressLabel(kpi.id, "mensal")}
                        </p>

                        <HistoryBlock kpi={kpi} progress={progress} />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {renderPerfBadge(kpi)}
                        <button
                          type="button"
                          onClick={() => startEditKpi(kpi)}
                          className="mt-2 text-[11px] text-sky-700 hover:text-sky-900"
                        >
                          Editar KPI
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteKpi(kpi.id)}
                          className="text-[11px] text-red-600 hover:text-red-800"
                        >
                          Excluir KPI
                        </button>
                      </div>
                    </div>

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
                                Unidade
                              </label>
                              <select
                                value={editUnitType}
                                onChange={(e) =>
                                  setEditUnitType(e.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                              >
                                <option value="unidades">Unidades</option>
                                <option value="percentual">
                                  Percentual (%)
                                </option>
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
                                onChange={(e) =>
                                  setEditOwnerId(e.target.value)
                                }
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
    </div>
  );
}

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
      let valueText = item.status.value;
      if (kpi.unitType === "valor" && item.status.value) {
        valueText = formatCurrency(item.status.value);
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

export default AdminDashboard;

