export function formatCurrency(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}
