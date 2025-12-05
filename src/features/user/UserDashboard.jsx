import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getCurrentProgress, getKpiPerformance } from "../../utils/kpiHelpers";
import { normalizeMoneyInput, formatCurrency } from "../../utils/formatters";

function UserDashboard({ currentUser, kpis, progress, updateProgress }) {
  const myKpis = kpis.filter((k) => k.ownerId === currentUser.id);

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
      if (kpi.targetWeekly && kpi.targetWeekly > 0 && !Number.isNaN(delivered)) {
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
      if (kpi.targetMonthly && kpi.targetMonthly > 0 && !Number.isNaN(delivered)) {
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
                updateProgress={updateProgress}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ kpi, progress, updateProgress }) {
  const [weeklyDelivered, setWeeklyDelivered] = React.useState("sim");
  const [weeklyValue, setWeeklyValue] = React.useState("");
  const [weeklyComment, setWeeklyComment] = React.useState("");

  const [monthlyDelivered, setMonthlyDelivered] = React.useState("sim");
  const [monthlyValue, setMonthlyValue] = React.useState("");
  const [monthlyComment, setMonthlyComment] = React.useState("");

  const weeklyStatus = getCurrentProgress(progress, kpi.id, "semanal");
  const monthlyStatus = getCurrentProgress(progress, kpi.id, "mensal");

  const perf = getKpiPerformance(kpi, progress);

  function formatUnit(unitType) {
    if (unitType === "unidades") return "unid.";
    if (unitType === "percentual") return "%";
    if (unitType === "valor") return "R$";
    return "";
  }

  function submitWeekly(e) {
    e.preventDefault();
    const delivered = weeklyDelivered === "sim";

    if (delivered) {
      const target = kpi.targetWeekly;
      const normal =
        kpi.unitType === "valor" ? normalizeMoneyInput(weeklyValue) : weeklyValue;
      const deliveredNum = parseFloat(normal || "0");

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

    const valueToSave =
      kpi.unitType === "valor"
        ? normalizeMoneyInput(weeklyValue)
        : weeklyValue;

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
    const delivered = monthlyDelivered === "sim";

    if (delivered) {
      const target = kpi.targetMonthly;
      const normal =
        kpi.unitType === "valor"
          ? normalizeMoneyInput(monthlyValue)
          : monthlyValue;
      const deliveredNum = parseFloat(normal || "0");

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

    const valueToSave =
      kpi.unitType === "valor"
        ? normalizeMoneyInput(monthlyValue)
        : monthlyValue;

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
              ` | Meta semanal: ${kpi.targetWeekly} ${formatUnit(
                kpi.unitType
              )}`}
            {kpi.targetMonthly != null &&
              ` | Meta mensal: ${kpi.targetMonthly} ${formatUnit(
                kpi.unitType
              )}`}
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
            {weeklyStatus && (
              <p className="text-[11px] text-slate-500 mb-2">
                Último registro:{" "}
                {(() => {
                  if (weeklyStatus.delivered) {
                    let valueText = weeklyStatus.value;
                    if (kpi.unitType === "valor" && weeklyStatus.value) {
                      valueText = formatCurrency(weeklyStatus.value);
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
              <div className="flex gap-2 text-[11px]">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="sim"
                    checked={weeklyDelivered === "sim"}
                    onChange={(e) => setWeeklyDelivered(e.target.value)}
                  />
                  Entregue
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="nao"
                    checked={weeklyDelivered === "nao"}
                    onChange={(e) => setWeeklyDelivered(e.target.value)}
                  />
                  Não entregue
                </label>
              </div>

              {weeklyDelivered === "sim" && (
                <>
                  <input
                    type="text"
                    value={weeklyValue}
                    onChange={(e) => setWeeklyValue(e.target.value)}
                    placeholder={`Valor entregue (ex.: 2 ${formatUnit(
                      kpi.unitType
                    )})`}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <textarea
                    value={weeklyComment}
                    onChange={(e) => setWeeklyComment(e.target.value)}
                    placeholder="Comentário (use se entregou abaixo da meta, teve atraso, etc.)"
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </>
              )}

              {weeklyDelivered === "nao" && (
                <textarea
                  value={weeklyComment}
                  onChange={(e) => setWeeklyComment(e.target.value)}
                  placeholder="Motivo da não entrega"
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              )}

              <button
                type="submit"
                className="mt-1 w-full rounded-md bg-emerald-600 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
              >
                Registrar semana
              </button>
            </form>
          </div>
        )}

        {kpi.periodicity === "mensal" && (
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-slate-800 mb-1">
              Mês atual
            </div>
            {monthlyStatus && (
              <p className="text-[11px] text-slate-500 mb-2">
                Último registro:{" "}
                {(() => {
                  if (monthlyStatus.delivered) {
                    let valueText = monthlyStatus.value;
                    if (kpi.unitType === "valor" && monthlyStatus.value) {
                      valueText = formatCurrency(monthlyStatus.value);
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
              <div className="flex gap-2 text-[11px]">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="sim"
                    checked={monthlyDelivered === "sim"}
                    onChange={(e) => setMonthlyDelivered(e.target.value)}
                  />
                  Entregue
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="nao"
                    checked={monthlyDelivered === "nao"}
                    onChange={(e) => setMonthlyDelivered(e.target.value)}
                  />
                  Não entregue
                </label>
              </div>

              {monthlyDelivered === "sim" && (
                <>
                  <input
                    type="text"
                    value={monthlyValue}
                    onChange={(e) => setMonthlyValue(e.target.value)}
                    placeholder={`Valor entregue (ex.: 8 ${formatUnit(
                      kpi.unitType
                    )})`}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <textarea
                    value={monthlyComment}
                    onChange={(e) => setMonthlyComment(e.target.value)}
                    placeholder="Comentário (use se entregou abaixo da meta, teve atraso, etc.)"
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </>
              )}

              {monthlyDelivered === "nao" && (
                <textarea
                  value={monthlyComment}
                  onChange={(e) => setMonthlyComment(e.target.value)}
                  placeholder="Motivo da não entrega"
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              )}

              <button
                type="submit"
                className="mt-1 w-full rounded-md bg-emerald-600 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
              >
                Registrar mês
              </button>
            </form>
          </div>
        )}

        {kpi.periodicity === "semanal+mensal" && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-800 mb-1">
              Mês atual (acumulado das semanas)
            </div>
            {monthlyStatus ? (
              <p className="text-[11px] text-slate-500">
                Valor acumulado no mês:{" "}
                <span className="font-semibold text-slate-800">
                  {monthlyStatus.value || "0"} {formatUnit(kpi.unitType)}
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Ainda não há registros semanais suficientes para o mês atual.
              </p>
            )}
            <p className="mt-1 text-[10px] text-slate-500">
              Este valor é calculado automaticamente a partir dos registros
              semanais. Não é necessário preencher a meta mensal manualmente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;

