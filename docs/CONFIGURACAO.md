# Atalaia v1.1 — guia de configuração

Este guia leva você do zero ao sistema vendendo keys. Tudo em português, na ordem em que
precisa ser feito. O que já está pronto vem marcado com ✅.

---

## 0. Ritmo seguro (importante para a conta durar)

O motor foi travado em um ritmo de gente:

- **no máximo 5 usernames por rodada**;
- **espera mínima de 7 segundos** entre rodadas;
- **~1,4 s (com jitter) entre uma checagem e outra** dentro da rodada;
- concorrência máxima **2** (padrão **1**);
- ao receber `429`, o monitor entra em pausa automática e volta depois do `Retry-After`.

Esses limites são aplicados no servidor (`lib/job-input.ts` e `lib/engine.ts`), não só na tela —
não adianta forçar pelo console. É o que evita banimento em massa.

## 1. Como o sistema funciona

```
cliente abre o site
      │
      ├── entra com Discord  ──► conta criada (cookie assinado, 30 dias)
      │                              │
      └── cola a key  ───────────────┴──► key só ativa se o Discord estiver conectado
                                             │
                                          licença ativa (dias começam a contar AQUI)
                                             │
                                          console: monitores, achados, eventos
                                             │
                                          admin libera plataformas, proxies e alertas
```

Três ideias importantes:

1. **A key nasce pendente.** Enquanto o cliente não ativa, os dias não correm.
2. **Discord é a identidade.** A key é amarrada ao `discordId` — não dá para repassar.
3. **Nada fica visível antes da hora.** Toda plataforma começa bloqueada (“Em breve”) e
   só aparece no console do cliente quando você liga no painel admin.

---

## 2. Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `SUPABASE_URL` | sim | `https://SEU-REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | chave `service_role` (só no servidor) |
| `APP_SECRET` | sim | assina sessões e cifra keys/proxies (`openssl rand -hex 32`) |
| `ADMIN_KEY` | recomendada | troca a key mestra padrão (`access-6xy-67`) |
| `DISCORD_CLIENT_ID` | para login Discord | Client ID do app |
| `DISCORD_CLIENT_SECRET` | para login Discord | Client Secret (nunca vai para o banco) |
| `DISCORD_REDIRECT_URI` | opcional | força a URL de callback |
| `PHANOM_TOKEN` | opcional | token `auto_...` para controlar bots 24/7 |
| `ATALAIA_DB_MODE` | opcional | `local` força o arquivo `.data/cloud.json` (dev) |

> Sem `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` o sistema cai no modo local (arquivo).
> Funciona para testar, mas no Vercel o disco é efêmero — em produção use Supabase.

---

## 3. Supabase ✅ (já configurado)

Projeto: **zx-sparkle-cart** (`nrtsagqxlsmtkijetnya`) — tabelas próprias no schema
`public`, todas com o prefixo **`atl_`** (o PostgREST só expõe `public` por padrão).

✅ Tabelas criadas: `atl_plans`, `atl_licenses`, `atl_users`, `atl_events`,
`atl_attempts`, `atl_settings`, `atl_platforms`, `atl_proxies`.
✅ RLS ligado, `anon`/`authenticated` revogados, `service_role` liberado.
✅ Seed: 4 planos, 11 plataformas (só **Discord** liberado) e as 5 chaves de configuração.

Para conferir depois de qualquer mudança, rode no SQL Editor:

```sql
select count(*) from public.atl_plans;
select id, enabled, note from public.atl_platforms order by id;
select key from public.atl_settings;
```

**Nunca** altere as outras tabelas desse projeto (`xgb_*`, `valtrex_*`, `zenyx_*`):
pertencem a outros apps. Só mexa nas `atl_*`.
E nunca toque no projeto `ZXMAX - OFFPROJECT`.

Onde pegar as chaves: Supabase → Project Settings → API → `service_role` (Reveal).

---

## 4. Login com Discord (15 minutos, feito por você)

1. Abra <https://discord.com/developers/applications> → **New Application** → nome `Atalaia`.
2. Menu **OAuth2 → General**:
   - copie o **Client ID**;
   - **Reset Secret** e copie o **Client Secret** (aparece uma única vez).
3. Ainda em OAuth2, em **Redirects**, adicione as duas linhas exatas:
   ```
   https://atalaia-one.vercel.app/api/auth/discord/callback
   http://localhost:3000/api/auth/discord/callback
   ```
   (troque pelo seu domínio final, se for outro)
4. Vercel → projeto → **Settings → Environment Variables** → adicione:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
5. **Deployments → ⋯ → Redeploy** (variáveis só valem em build novo).
6. Abra o site: o card “Entrar com Discord” deixa de mostrar *Em breve*.

### Servidor obrigatório (opcional)

Se quiser exigir que o cliente esteja no seu servidor:

1. No Discord, ative **Modo de desenvolvedor** (Configurações → Avançado).
2. Clique com o botão direito no servidor → **Copiar ID do servidor**.
3. No painel `/admin → Ajustes → porta de entrada`, cole em **ID do servidor (guild)**,
   ligue **exigir participação no servidor** e salve.
4. O app precisa ter o escopo `guilds` (já incluso) e o usuário precisa autorizar.

---

## 5. Acesso administrativo

- Key padrão: **`access-6xy-67`**
- Entre em `/` → rodapé → **acesso administrativo** → cole a key → cai em `/admin`.
- A sessão de admin dura **12 horas** e é registrada em auditoria.

**Troque a key padrão hoje:**

1. Vercel → Settings → Environment Variables → `ADMIN_KEY=uma-frase-longa-sua`.
2. Redeploy.
3. O aviso amarelo em `/admin` desaparece quando a key deixa de ser a padrão.

> `APP_SECRET` novo invalida **todas** as sessões (clientes precisam entrar de novo).
> Troque só se desconfiar de vazamento.

---

## 6. Gerar e vender keys (o dia a dia)

**/admin → Licenças**

1. Escolha o **plano** (dias, monitores e preço vêm dele).
2. **quantidade**: 1 a 50 de uma vez.
3. **dias**: deixe vazio para usar o plano, ou force outro prazo (ex.: 15).
4. **anotação**: nome do cliente, lote, “campanha de outubro”.
5. **gerar** → aparece a faixa verde com os códigos `ATL-XXXXX-XXXXX-XXXXX`.

⚠️ O código só é mostrado **uma vez**. Use **copiar todas** ou **.txt** antes de fechar.

O que o cliente recebe:

> “Entre em https://atalaia-one.vercel.app, conecte seu Discord e cole a key `ATL-...`.
> A contagem começa quando você ativar.”

Ações por licença:

| Ação | Quando usar |
| --- | --- |
| 👁 revelar | recuperar o código de uma key já entregue |
| +30d | cliente renovou |
| suspender / reativar | cliente atrasou o pagamento (mantém o histórico) |
| revogar | golpe, reembolso, compartilhamento de key |
| excluir | apagar de vez (não pode ser desfeito) |

Status possíveis: **pendente** (nunca ativada) → **ativa** → **expirada**; mais
**suspensa** e **revogada**.

---

## 7. Liberar plataformas (“Em breve”)

**/admin → Plataformas**

Cada linha tem o interruptor e um campo de observação.

- **Discord** já vem liberado — é o único que o motor checa com credencial de conta.
- TikTok, Instagram, GitHub, Telegram, Twitch, Steam, Roblox, YouTube, Reddit e Pinterest
  estão prontos no código, mas **bloqueados**. Ligue quando quiser que os clientes vejam.
- Cliente sem permissão não consegue nem criar monitor: a API responde
  `423 — a plataforma ainda não está liberada`.

Credenciais por plataforma (quando for ligar): `/admin → Ajustes → integrações` mostra o
estado; os tokens de conta ficam em `/ajustes` do console (cifrados no banco).

---

## 8. Proxies (ProxyScrape, com IPv6)

**/admin → Proxies**

1. protocolo `http`, **família `IPv6`** (recomendado), país opcional (`BR`), quantidade;
2. **importar** → puxa o feed IPv6 do ProxyScrape;
3. **testar 12** → abre conexão TCP real e mede latência;
4. **limpar mortas** → tira do pool o que não responde.

IPv6 tem muito mais endereços e sofre menos bloqueio por IP — por isso já vem selecionado.
Se o pool IPv6 secar, troque para `qualquer` e importe de novo; o motor continua funcionando
com o que estiver no pool.

Proxies gratuitos costumam exigir autenticação ou morrer rápido — o teste é honesto e vai
marcar boa parte como morta. O motor usa rotação e cooldown automático.

---

## 9. PhanomCloud (motor 24/7)

O PhanomCloud **hospeda processos**, não “liga conta”. Para deixar o motor rodando sem
depender do navegador aberto:

1. Entre em <https://phanomcloud.online> → **Settings → Automation Token** → copie o
   token `auto_...` (o token `pc_...` que você tinha **não é aceito** pela API — o padrão
   documentado é `auto_` ou `sess_`).
2. Cole na Vercel em `PHANOM_TOKEN` e faça redeploy.
3. No painel do Phanom, crie um bot **Node.js**, plano 512 MB, com o start:
   ```
   npx tsx scripts/runner.ts
   ```
4. `GET /api/admin/phanom` (logado como admin) mostra se o token responde.
   `/admin → Visão geral → serviços` também exibe o status.

Alternativa sem custo: **GitHub Actions** com o workflow `docs/atalaia-runner.yml`
(agendado a cada 5 minutos) — já incluído no repositório.

---

## 10. Deploy

```bash
git push origin main          # a Vercel builda sozinha
```

Ou no painel: **Deployments → Redeploy**. Checklist pós-deploy:

- [ ] `/` abre só com Discord + key (fundo transparente)
- [ ] `access-6xy-67` entra em `/admin`
- [ ] `DISCORD_CLIENT_ID` + `SECRET` aparecem como *configurado* em Ajustes
- [ ] gerar 1 key de teste, ativar com uma conta Discord e ver `/painel`
- [ ] liberar/desligar uma plataforma e recarregar o console do cliente
- [ ] importar proxies e rodar o teste

---

## 11. Problemas comuns

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| “Entrar com Discord” em *Em breve* | falta `DISCORD_CLIENT_ID/SECRET` | configure e faça redeploy |
| `428 discord_required` ao colar a key | falta conectar o Discord | conecte primeiro, depois cole a key |
| `401 Sessão expirada` em tudo | `APP_SECRET` mudou | entre novamente |
| Erro `Supabase 404` | tabelas `atl_*` ausentes | rode o SQL da seção 3 |
| Phanom “token ausente” / “sem resposta” | token `pc_` ou não definido | gere `auto_...` e redeploy |
| Cliente vê tudo bloqueado | nenhuma plataforma liberada | `/admin → Plataformas` |
| ProxyScrape devolve vazio | API pública instável | tente de novo em 1 minuto |

---

## 12. Limites e responsabilidade

Name-checkers consultam endpoints públicos; algumas plataformas têm termos de uso que
proíbem varredura automatizada. O sistema respeita intervalo entre checagens e pausa em
`rate limit`, mas a decisão de ligar cada plataforma é sua — libere apenas as que você
tem direito de consultar.

A venda de keys é sua operação: cobre pelo prazo que configurar e use o botão **revogar**
em caso de compartilhamento.
