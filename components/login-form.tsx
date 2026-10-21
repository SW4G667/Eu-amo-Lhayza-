"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Informe a senha de acesso.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Não foi possível entrar.");
        setLoading(false);
        return;
      }
      window.location.href = "/painel";
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-white/[0.05] bg-[#080A0A] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 grid-bg opacity-70" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-40 top-1/4 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(184,228,74,0.10) 0%, rgba(184,228,74,0.02) 45%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <Wordmark />
        </div>

        <div className="relative max-w-[440px] animate-fade-up">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-lime-400/80">
            console de captura
          </p>
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-bone-50">
            Nomes raros
            <br />
            não esperam.
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-bone-400">
            O Atalaia varre usernames de 2 a 6 caracteres nas principais redes, respeita o ritmo
            de cada plataforma e avisa no seu Discord no segundo em que um nome fica livre.
          </p>

          <div className="mt-8 space-y-3">
            {[
              ["01", "Varredura sistemática", "Cobertura completa por comprimento, sem repetir nomes."],
              ["02", "Pool de proxies", "Rotação com cooldown automático para não queimar o IP."],
              ["03", "Alerta imediato", "Webhook com link de captura, pontuação e latência."],
            ].map(([step, title, detail]) => (
              <div key={step} className="flex gap-3">
                <span className="mt-[3px] font-mono text-[10px] text-lime-400/70">{step}</span>
                <div>
                  <p className="text-[12.5px] font-medium text-bone-100">{title}</p>
                  <p className="text-[11.5px] leading-relaxed text-bone-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-500">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-lime-400" />
          acesso privado · uso pessoal
        </div>
      </section>

      <section className="relative flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="absolute inset-0 grid-bg opacity-40 lg:hidden" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-ink-800">
              <BrandMark className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-bone-50">atalaia</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone-500">
                username intel
              </p>
            </div>
          </div>

          <div className="mb-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-400">
              <LockKeyhole className="h-3 w-3" strokeWidth={1.8} /> área restrita
            </span>
            <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.025em] text-bone-50">
              Entrar no console
            </h2>
            <p className="mt-1 text-[12.5px] text-bone-500">
              Use a senha definida em <code className="font-mono text-bone-400">APP_PASSWORD</code>.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="senha de acesso" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="••••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVisible((current) => !current)}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-bone-500 transition-colors hover:text-bone-100"
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </Field>

            {error ? (
              <p className="rounded-md border border-ember/25 bg-ember/[0.07] px-3 py-2 text-[12px] text-[#FFA48E]">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Acessar console
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </Button>
          </form>

          <p className="mt-6 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
            <span>sessão de 30 dias</span>
            <span>v1.0</span>
          </p>
        </div>
      </section>
    </div>
  );
}
