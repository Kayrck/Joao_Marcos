import { useState, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Dumbbell, Lock } from "lucide-react";
import { Button } from "../components/Button";

export function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Senha simples para demonstração - em produção usar autenticação real
    if (password === "joaomarcos2026") {
      localStorage.setItem("admin_authenticated", "true");
      navigate("/admin");
    } else {
      setError("Senha incorreta");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Dumbbell className="text-lime-400" size={32} />
            <span className="font-black text-2xl tracking-tighter uppercase italic">João Marcos</span>
          </div>
          <h1 className="text-3xl font-black mb-2">Painel Administrativo</h1>
          <p className="text-zinc-400">Acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-bold mb-2 text-zinc-400">
              Senha de acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-12 py-3 focus:outline-none focus:border-lime-400 transition-colors"
                placeholder="Digite sua senha"
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Entrar
          </Button>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm text-zinc-500 hover:text-lime-400 transition-colors">
              ← Voltar para o site
            </a>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-600">
          <p>Senha padrão: joaomarcos2026</p>
        </div>
      </div>
    </div>
  );
}
