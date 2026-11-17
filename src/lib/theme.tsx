import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const KEY = "jm-theme";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "light", setTheme: () => undefined, toggle: () => undefined });

function current(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Tema claro/escuro. O estado inicial é definido por /theme-init.js antes da pintura
 * (preferência salva > preferência do aparelho > claro); aqui só sincronizamos e persistimos.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(current);

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    root.classList.toggle("dark", t === "dark");
    root.style.colorScheme = t;
    window.setTimeout(() => root.classList.remove("theme-transition"), 300);
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      apply(t);
      try {
        localStorage.setItem(KEY, t);
      } catch {
        /* armazenamento indisponível: a preferência vale apenas nesta visita */
      }
    },
    [apply],
  );

  useEffect(() => setThemeState(current()), []);

  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }), [theme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
      className={`inline-flex size-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted ${className}`}
    >
      {dark ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
    </button>
  );
}
