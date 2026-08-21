"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ voltar }: { voltar: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), senha: fd.get("senha") }),
    });
    setCarregando(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErro(d.erro || "Não foi possível entrar");
      return;
    }
    router.replace(voltar.startsWith("/") ? voltar : "/");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block space-y-1">
        <span className="rotulo">E-mail</span>
        <input name="email" type="email" required autoComplete="email" className="campo" placeholder="voce@usina.com.br" />
      </label>
      <label className="block space-y-1">
        <span className="rotulo">Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" className="campo" />
      </label>
      {erro && <p className="text-sm text-critico">{erro}</p>}
      <button type="submit" className="botao w-full justify-center" disabled={carregando}>
        {carregando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
