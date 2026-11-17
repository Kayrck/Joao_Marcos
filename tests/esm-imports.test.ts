import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A função da Vercel roda em Node ESM puro (package.json "type": "module"): imports relativos SEM extensão
 * (`from "./constants"`) funcionam no Vite/tsx/Vitest, mas derrubam a função em produção
 * (ERR_MODULE_NOT_FOUND → FUNCTION_INVOCATION_FAILED). Este teste impede a regressão.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

describe("imports do backend (Node ESM)", () => {
  it("todo import relativo em api/, server/ e shared/ tem extensão .js ou .json", () => {
    const bad: string[] = [];
    const re = /(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
    for (const file of ["api", "server", "shared"].flatMap(files)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(re)) {
        if (!/\.(js|json)$/.test(m[1])) bad.push(`${file}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
