import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const voltar = typeof sp.voltar === "string" ? sp.voltar : "/";
  return (
    <main className="flex-1 grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-lateral text-lateral-texto p-12">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-semibold text-white tracking-tight">Migdolus Monitor</span>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-semibold text-white leading-tight">
            Do caderno de campo ao mapa de calor, no mesmo dia.
          </h1>
          <p className="text-lateral-texto/80 leading-relaxed">
            Armadilhas georreferenciadas no ato da instalação, troca de septo nunca esquecida e o laudo da usina
            sem passar pelo Excel.
          </p>
          <ul className="grid grid-cols-3 gap-4 text-sm">
            <li><strong className="block text-2xl text-white">−94 %</strong> capturas em 3 safras</li>
            <li><strong className="block text-2xl text-white">30 m</strong> malha mais eficiente</li>
            <li><strong className="block text-2xl text-white">+96 %</strong> TCH vs. sem controle</li>
          </ul>
        </div>
        <p className="text-xs text-lateral-texto/60">Avila Ops · migdolus.avilaops.com</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3">
            <Logo />
            <span className="font-semibold tracking-tight">Migdolus Monitor</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Entrar no painel</h2>
            <p className="text-sm text-texto-suave mt-1">Use o mesmo e-mail e senha do aplicativo de campo.</p>
          </div>
          <LoginForm voltar={voltar} />
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-marca text-white">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s7-5.5 7-12a7 7 0 0 0-14 0c0 6.5 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </span>
  );
}
