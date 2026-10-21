export const RUNNER_WORKFLOW_PATH = ".github/workflows/runner.yml";

export const RUNNER_WORKFLOW = String.raw`name: Atalaia Runner

# Mantém o motor de varredura rodando 24/7 nos runners do GitHub.
# Cada execução fica no ar por ~5h30 e grava o estado cifrado no branch
# \`atalaia-state\`. O agendamento enfileira a próxima execução, que assume
# assim que a anterior termina (concurrency garante um runner por vez).

on:
  workflow_dispatch:
  schedule:
    - cron: "*/30 * * * *"

permissions:
  contents: write

concurrency:
  group: atalaia-runner
  cancel-in-progress: false

jobs:
  runner:
    name: varredura contínua
    runs-on: ubuntu-latest
    timeout-minutes: 355
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Dependências
        run: npm ci --no-audit --no-fund

      - name: Motor
        env:
          APP_SECRET: \${{ secrets.APP_SECRET }}
          ATALAIA_ENGINE_MODE: serverless
          ATALAIA_STATE_MODE: github
          ATALAIA_STATE_REPO: \${{ github.repository }}
          ATALAIA_STATE_BRANCH: atalaia-state
          ATALAIA_STATE_PATH: .atalaia/state.enc
          ATALAIA_STATE_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          ATALAIA_STATE_DEFER: "1"
          ATALAIA_STATE_FLUSH_MS: "30000"
          ATALAIA_STATE_TTL_MS: "60000"
          ATALAIA_TICK_MS: "2000"
          ATALAIA_RUN_MINUTES: "330"
        run: npx tsx scripts/runner.ts
`;
