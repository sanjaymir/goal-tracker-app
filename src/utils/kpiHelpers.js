import { getCurrentWeekKey, getCurrentMonthKey } from "./dateHelpers";

// progress indexado por período:
// { "kpiId-periodType-periodKey": { delivered, value, comment } }

export function getCurrentProgress(progress, kpiId, periodType) {
  const periodKey =
    periodType === "semanal" ? getCurrentWeekKey() : getCurrentMonthKey();
  const key = `${kpiId}-${periodType}-${periodKey}`;
  return progress[key];
}

// Retorna { level: "verde" | "amarelo" | "vermelho" | "neutro", percent, base }
export function getKpiPerformance(kpi, progress) {
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
    const currentMonthKey = getCurrentMonthKey();
    const metaKey = `${kpi.id}-meta-mensal-${currentMonthKey}`;
    const metaStatus = progress[metaKey];
    if (metaStatus && metaStatus.value) {
      const parsedMeta = parseFloat(metaStatus.value || "0");
      if (!Number.isNaN(parsedMeta) && parsedMeta > 0) {
        target = parsedMeta;
      }
    }
    if (monthlyStatus.delivered) {
      const parsed = parseFloat(monthlyStatus.value || "0");
      deliveredValue = Number.isNaN(parsed) ? 0 : parsed;
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
      deliveredValue = Number.isNaN(parsed) ? 0 : parsed;
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

  percent = Math.max(0, Math.min(percent, 200));

  let level;
  if (percent >= 100) level = "verde";
  else if (percent >= 70) level = "amarelo";
  else level = "vermelho";

  return { level, percent, base };
}

export function computeHistoricalPerformance(kpi, periodType, status) {
  if (!status) return { level: "neutro", percent: 0 };

  let target =
    periodType === "mensal" ? kpi.targetMonthly || 0 : kpi.targetWeekly || 0;

  let deliveredValue = 0;
  if (status.delivered) {
    const parsed = parseFloat(status.value || "0");
    deliveredValue = Number.isNaN(parsed) ? 0 : parsed;
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

export function getKpiHistory(kpi, periodType, progress, limit = 6) {
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

