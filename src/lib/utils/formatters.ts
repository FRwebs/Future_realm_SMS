import { formatDay } from "@/lib/date-format";
export function formatCurrency(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatCompactCurrency(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDate(value: string | Date) {
  return formatDay(typeof value === "string" ? new Date(value) : value, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }, "en-NG");
}

export function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}
