import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid-bg relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(190,242,100,0.05),transparent_60%)]" />
      <div className="relative flex flex-col items-center gap-4">
        <span className="label-mono text-bone-500">erro 404</span>
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] text-bone-50 sm:text-[34px]">
          Essa rota não existe.
        </h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-bone-400">
          O endereço foi digitado errado ou saiu de linha. O console continua no mesmo lugar.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href="/painel"
            className="inline-flex h-9 items-center rounded-lg bg-lime-400 px-4 text-[13px] font-medium text-[#0B0D08] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.4)] transition-colors hover:bg-lime-300"
          >
            Ir para o painel
          </Link>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg border border-white/[0.09] bg-ink-800 px-4 text-[13px] text-bone-100 transition-colors hover:border-white/[0.16] hover:bg-ink-750"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
