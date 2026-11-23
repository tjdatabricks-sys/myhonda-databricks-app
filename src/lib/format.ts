// Number / currency / percent formatting helpers

export function fmtCurrency(v: number | null | undefined, opts?: { compact?: boolean; decimals?: number }): string {
  if (v == null || Number.isNaN(v)) return "-";
  const decimals = opts?.decimals ?? (Math.abs(v) >= 1000 ? 0 : 2);
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function fmtNumber(v: number | null | undefined, opts?: { compact?: boolean; decimals?: number }): string {
  if (v == null || Number.isNaN(v)) return "-";
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  if (opts?.decimals != null) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals }).format(v);
  }
  // Integer counts render without a trailing ".0"; fractional values keep one decimal below 1k.
  if (Number.isInteger(v)) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
  }
  const decimals = Math.abs(v) >= 1000 ? 0 : 1;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${(v * 100).toFixed(decimals)}%`;
}

export function fmtPctRaw(v: number | null | undefined, decimals = 1): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(decimals)}%`;
}

export function fmtX(v: number | null | undefined, decimals = 2): string {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(decimals)}x`;
}

export function fmtDelta(v: number | null | undefined, decimals = 1): string {
  if (v == null || Number.isNaN(v)) return "-";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(decimals)}%`;
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return "-";
  const dt = new Date(iso);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}
