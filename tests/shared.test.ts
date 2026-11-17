import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, isDateString, localToIso, periodFromPreset, subscriptionEnd, todayLocal } from "../shared/dates.js";
import { fillTemplate, formatBRL, parseMoneyToCents, planMessage } from "../shared/format.js";
import { formatPhone, normalizeWhatsapp, whatsappUrl } from "../shared/phone.js";

describe("datas (fuso America/Fortaleza)", () => {
  it("usa o dia local de Fortaleza, não o UTC", () => {
    expect(todayLocal(new Date("2026-11-17T01:30:00Z"))).toBe("2026-11-16"); // 22:30 em Fortaleza
    expect(todayLocal(new Date("2026-11-17T03:00:00Z"))).toBe("2026-11-17");
  });
  it("soma meses preservando o fim do mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-16", 3)).toBe("2027-02-16");
  });
  it("calcula o término de planos (início + meses − 1 dia)", () => {
    expect(subscriptionEnd("2026-11-16", 1)).toBe("2026-12-15");
    expect(subscriptionEnd("2026-11-16", 2)).toBe("2027-01-15");
    expect(subscriptionEnd("2026-11-16", 3)).toBe("2027-02-15");
  });
  it("valida e compara datas", () => {
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-02-28")).toBe(true);
    expect(daysBetween("2026-11-16", "2026-11-19")).toBe(3);
  });
  it("converte data+hora locais em instante UTC", () => {
    expect(localToIso("2026-12-31", "23:59")).toBe("2027-01-01T02:59:00.000Z");
  });
  it("presets de período", () => {
    expect(periodFromPreset("month", "2026-11-16")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodFromPreset("prev_month", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodFromPreset("week", "2026-11-16")).toEqual({ from: "2026-11-15", to: "2026-11-21" });
  });
});

describe("telefone e WhatsApp", () => {
  it("normaliza para o formato internacional", () => {
    expect(normalizeWhatsapp("(85) 99999-1234")).toBe("5585999991234");
    expect(normalizeWhatsapp("+55 85 99999-1234")).toBe("5585999991234");
    expect(normalizeWhatsapp("")).toBe("");
  });
  it("monta o link com mensagem codificada", () => {
    expect(whatsappUrl("85999991234", "Olá! Plano trimestral")).toBe("https://wa.me/5585999991234?text=Ol%C3%A1!%20Plano%20trimestral");
  });
  it("formata para exibição", () => {
    expect(formatPhone("5585999991234")).toBe("(85) 99999-1234");
  });
});

describe("formatação", () => {
  it("converte dinheiro digitado em centavos", () => {
    expect(parseMoneyToCents("R$ 1.234,56")).toBe(123456);
    expect(parseMoneyToCents("100")).toBe(10000);
    expect(parseMoneyToCents("12,5")).toBe(1250);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
  it("formata BRL", () => {
    expect(formatBRL(20000).replace(/\s/g, " ")).toBe("R$ 200,00");
  });
  it("preenche a mensagem do plano dinamicamente", () => {
    expect(planMessage("Olá! Tenho interesse no plano {plano} da consultoria online.", "Trimestral")).toBe(
      "Olá! Tenho interesse no plano trimestral da consultoria online.",
    );
    expect(fillTemplate("Oi {nome} {x}", { nome: "Ana" })).toBe("Oi Ana {x}");
  });
});
