/**
 * Utilitários de data centralizados para o fuso horário America/Sao_Paulo.
 * Substitui usos de toISOString para "hoje" e formatDateForDB por data local.
 */

const TIMEZONE = "America/Sao_Paulo";

/** Retorna a data de hoje no fuso America/Sao_Paulo no formato yyyy-mm-dd. */
export function todayLocal(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

/** Retorna a data/hora atual no fuso America/Sao_Paulo como string ISO local (sem Z). */
export function nowLocalISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value || "";
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  const hour = parts.find(p => p.type === "hour")?.value || "";
  const minute = parts.find(p => p.type === "minute")?.value || "";
  const second = parts.find(p => p.type === "second")?.value || "";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/** Converte uma string de data (yyyy-mm-dd) para Date no fuso local. */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Formata uma data para exibição no padrão brasileiro (dd/mm/yyyy). */
export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return "-";
  if (typeof date === "string" && date.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("pt-BR", { timeZone: TIMEZONE });
}

/** Formata uma data/hora para exibição no padrão brasileiro. */
export function formatDateTimeBR(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString("pt-BR", { timeZone: TIMEZONE });
}

/** Converte data local (yyyy-mm-dd) para timestamp ISO no fuso America/Sao_Paulo (meio-dia). */
export function dateOnlyToIsoLocal(value: string): string {
  const d = parseDateLocal(value);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Arredonda valor monetário para 2 casas decimais (meio para cima). */
export function round2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Soma valores monetários com arredondamento a 2 casas. */
export function sumMoney(...valores: (number | null | undefined)[]): number {
  return round2(valores.reduce((s, v) => s + (Number(v) || 0), 0));
}

/** Subtrai valores monetários com arredondamento a 2 casas. */
export function subMoney(a: number, b: number): number {
  return round2(a - b);
}

/** Multiplica valores monetários com arredondamento a 2 casas. */
export function mulMoney(a: number, b: number): number {
  return round2(a * b);
}

/** Divide valores monetários com arredondamento a 2 casas. */
export function divMoney(a: number, b: number): number {
  if (b === 0) return 0;
  return round2(a / b);
}

/** Calcula porcentagem com arredondamento a 2 casas. */
export function pctMoney(valor: number, percentual: number): number {
  return round2((valor * percentual) / 100);
}