export function normalizeMoneyInput(raw) {
  if (raw == null) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return "";
  return String(num);
}

export function formatCurrency(value) {
  if (value == null || value === "") return "R$\u00a00,00";
  const num =
    typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatValueWithUnit(value, unitType) {
  if (unitType === "valor") {
    return formatCurrency(value);
  }
  if (unitType === "percentual") {
    const num = Number(value);
    return Number.isNaN(num) ? `${value}%` : `${num}%`;
  }
  const num = Number(value);
  return Number.isNaN(num) ? `${value} unid.` : `${num} unid.`;
}

