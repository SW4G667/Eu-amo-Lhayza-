# Atalaia

Console privado para rastrear usernames raros e receber o aviso no Discord no momento em que um nome fica livre.

Não é uma lista estática de nomes: o motor gera candidatos, consulta a plataforma de verdade, registra o resultado, respeita limites de requisição e dispara webhook quando encontra algo dentro do filtro.

---

## O que ele faz

- **Varredura sistemática** de 2 a 8 caracteres (por padrão 3 e 4), sem repetir nenhum nome. Também há modos aleatório, máscara (`??a`, `a##`) e dicionário.
- **Checagem real** em Discord, TikTok, Instagram, GitHub, Telegram, Twitch, Steam, Roblox, YouTube, Reddit e Pinterest.
- **Ritmo configurável**: quantos nomes por rodada, intervalo entre rodadas, concorrência e jitter.
- **Pool de proxies** com rotação, teste de saída e cooldown progressivo em falha.
- **Alertas no Discord** (embed com link de captura, pontuação e latência) e **Telegram** opcional.
- **Histórico** com score de raridade, filtros, exportação CSV e reenvio de alerta.
- **Checagem avulsa** para conferir um nome específico sem criar monitor.
- **Painel privado** com senha, tokens cifrados em repouso e nenhuma rota expondo segredos.

## Como cada plataforma é checada

| Plataforma | Método | Credencial |
| --- | --- | --- |
| Discord | `POST /api/v9/unique-username/username-attempt` (endpoint oficial do cliente) | token de conta |
| TikTok | página pública `tiktok.com/@nome` (404 / marcador de conta inexistente) | — |
| Instagram | `api/v1/users/web_profile_info` com `x-ig-app-id` público | — |
| GitHub | `api.github.com/users/:nome` | opcional (eleva 60/h para 5.000/h) |
| Telegram | página pública `t.me/nome` (`og:title`) | — |
| Twitch | Helix `users?login=` com client credentials | client ID + secret |
| Steam | XML público do perfil de vaidade | — |
| Roblox | `users.roblox.com/v1/usernames/users` | — |
| YouTube | `youtube.com/@nome` (404 quando livre) | — |
| Reddit | `reddit.com/user/:nome/about.json` | — |
| Pinterest | página pública do perfil | — |

Nenhum resultado é inventado: quando a plataforma responde algo fora do padrão, o console mostra `erro` com o motivo em vez de chutar disponibilidade.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Node 22 · zero banco nativo.
Persistência plugável: arquivo local (`.data/state.json`), Redis REST (Vercel KV/Upstash) ou memória (serverless sem Redis).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # edite APP_PASSWORD e APP_SECRET
npm run dev                  # http://localhost:3000
```

Build de produção:

```bash
npm run build && npm start
```

O motor é um processo persistente: com o servidor no ar, os monitores rodam no intervalo configurado mesmo com a aba fechada.

## Variáveis de ambiente

| Variável | Obrigatória | Função |
| --- | --- | --- |
| `APP_PASSWORD` | sim | senha do painel |
| `APP_SECRET` | recomendada | assina a sessão e cifra tokens/proxies |
| `CRON_SECRET` | opcional | libera `/api/cron?key=...` para gatilho externo |
| `UPSTASH_REDIS_REST_URL` / `..._TOKEN` | opcional | persistência em serverless |
| `KV_REST_API_URL` / `..._TOKEN` | opcional | idem (Vercel KV) |

Gere o segredo com:

```bash
openssl rand -hex 32
```

## Modos de execução

**Persistente (local, VPS ou Docker)** — o motor agenda cada monitor com `setTimeout`, aplica jitter, controla cooldown e roda 24/7. É o modo recomendado.

**Serverless (Vercel)** — funções não ficam vivas. O painel dispara um tick a cada ~1,6 s enquanto estiver aberto; o endpoint `/api/cron` permite rajadas via pinger externo. Para operação contínua de verdade, use VPS/Docker ou mantenha o worker abaixo rodando em outra máquina.

### Worker / pinger

O script `npm run worker` chama `/api/cron` no intervalo definido, mantendo o motor ativo mesmo com o painel fechado. Funciona apontando para o servidor local ou para a implantação na Vercel.

```bash
WORKER_URL=https://atalaia-one.vercel.app \
CRON_SECRET=... \
WORKER_INTERVAL_MS=2500 \
npm run worker
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `WORKER_URL` | `http://localhost:3000` | base da aplicação |
| `CRON_SECRET` | — | mesma chave configurada na aplicação (obrigatória) |
| `WORKER_INTERVAL_MS` | `2500` | intervalo entre gatilhos |
| `WORKER_TIMEOUT_MS` | `25000` | timeout de cada requisição |
| `WORKER_ONCE` | — | `1` dispara uma vez e encerra |

### 24/7 com Docker

```bash
docker compose up -d --build
```

O volume `atalaia-data` mantém `.data/state.json` entre reinícios.

## GitHub Actions como VPS (24/7)

O workflow `.github/workflows/runner.yml` mantém o motor de varredura rodando de graça nos runners do GitHub, mesmo com a Vercel hibernando as funções.

**Como funciona**

1. O workflow roda por até 5h30 e um cron a cada 30 min enfileira a próxima execução — quando a atual termina, a próxima assume. Sem intervalo morto.
2. O estado completo (monitores, proxies, achados, estatísticas, credenciais cifradas) é gravado no branch `atalaia-state`, em `.atalaia/state.enc`, cifrado em AES-256-GCM com `APP_SECRET`.
3. O painel na Vercel lê esse mesmo estado. Para editar pelo painel, cole um token do GitHub em **Ajustes → Conexão GitHub**; ele fica apenas no seu navegador e viaja por header em cada requisição.

**Configuração**

| Onde | O que | Para quê |
| --- | --- | --- |
| GitHub → Settings → Secrets → Actions | `APP_SECRET` | decifrar/gravar o estado no runner |
| Painel → Ajustes → Conexão GitHub | token fine-grained com `Contents: Read and write` | permitir edições pelo painel |
| Vercel (opcional) | `ATALAIA_STATE_TOKEN` | conecta sem depender do navegador |

**Variáveis aceitas**

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `ATALAIA_STATE_MODE` | automático | `github`, `redis`, `file` ou `memory` |
| `ATALAIA_STATE_REPO` | `SW4G667/Eu-amo-Lhayza-` | repositório do estado |
| `ATALAIA_STATE_BRANCH` | `atalaia-state` | branch do estado |
| `ATALAIA_STATE_PATH` | `.atalaia/state.enc` | arquivo do estado |
| `ATALAIA_STATE_TOKEN` | — | token de escrita (opcional) |
| `ATALAIA_ENGINE_MODE` | automático | força `serverless` (runner) ou `persistent` |

**Rodar o runner na sua máquina**

```bash
APP_SECRET=... ATALAIA_STATE_MODE=github ATALAIA_STATE_TOKEN=... \
ATALAIA_ENGINE_MODE=serverless npm run runner
```

## Deploy na Vercel

Implantação atual: <https://atalaia-one.vercel.app>

1. Importe o repositório e defina `APP_PASSWORD`, `APP_SECRET` e, se quiser, `CRON_SECRET`.
2. Para persistência entre instâncias, conecte um Redis REST (Vercel KV ou Upstash) e preencha as variáveis.
3. Sem Redis, o estado vive em memória por instância — suficiente para testar, não para operar.
4. Cron da Vercel no plano Hobby roda apenas 1×/dia. Use o worker (`npm run worker`) em `/api/cron?key=...` ou o modo persistente.

## Estrutura

```
app/                 páginas e rotas de API
components/          UI (shell, modais, gráficos, tabelas)
lib/
  adapters.ts        checagem de cada plataforma
  engine.ts          agendador, lotes, estatísticas, alertas
  generator.ts       geração sequencial/aleatória/máscara/dicionário
  score.ts           heurística de raridade (sem LLM)
  http.ts            fetch com proxy HTTP/SOCKS5, timeout e redirects
  proxy-pool.ts      rotação e saúde das proxies
  store.ts           drivers de persistência
  auth.ts            sessão assinada + rate limit de login
```

## Segurança

- Sessão em cookie `httpOnly`, `SameSite=Lax`, assinada com HMAC-SHA256.
- Tokens e senhas de proxy cifrados com AES-256-GCM usando `APP_SECRET`; o cliente recebe apenas indicadores (`configurado`, `verificado`).
- Todas as rotas de API exigem sessão; escrita valida mesma origem.
- Login limitado a 10 tentativas por IP a cada 10 minutos.
- `robots.txt` via metadata `noindex`; painel não é indexado.

## Limites e uso responsável

- Automação de conta de usuário não é autorizada pelos termos do Discord. Use intervalos altos, apenas na sua conta, e assuma o risco.
- Instagram, TikTok e Reddit bloqueiam IPs de datacenter com frequência. Proxies residenciais resolvem boa parte; sem elas, espere erros/limites.
- O score de raridade é heurístico (comprimento, sonoridade, dicionário, separadores). Não há chamada a LLM.
- Nomes muito disputados podem ser capturados por outra pessoa entre a checagem e a ação — o alerta reduz a janela, não a elimina.

## Problemas comuns

**"Token do Discord inválido"** — o token expirou ou foi trocado. Gere outro e salve em Ajustes.

**"Limite de requisições"** — a plataforma devolveu 429. O motor pausa o monitor automaticamente e retoma depois do `retry_after`. Reduza o lote ou adicione proxies.

**Checagens paradas** — confirme se o motor está ativo no topo do painel e se o monitor está ligado. Na Vercel, mantenha a aba aberta ou use `/api/cron`.

**Nome aparece livre mas não consigo pegar** — a plataforma pode reservar o nome por alguns minutos após a exclusão, ou o nome exige outro formato (ex.: Telegram começa em 5 caracteres).
