import { todayLocal } from "../../shared/dates.js";

/** Relógio injetável: permite testar expiração de promoções, vencimentos etc. */
let fixed: Date | null = null;

export const now = (): Date => fixed ?? new Date();
export const today = (): string => todayLocal(now());

export function setClockForTests(d: Date | string | null) {
  fixed = d === null ? null : new Date(d);
}
