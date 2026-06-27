# loterias-sim-web

Frontend (Next.js) do **Loterias Sim** — plataforma que sugere e simula jogos das
loterias brasileiras (Mega-Sena, Lotofácil e Lotomania) usando análise estatística
do histórico de sorteios. É a camada de apresentação publicada em
**https://loteriassim.com.br**.

> Parte do ecossistema **Loterias Sim**. Veja o panorama completo em
> [Arquitetura do ecossistema](#arquitetura-do-ecossistema).

---

## Visão geral

Aplicação **Next.js com export estático** (`output: 'export'`) hospedada em
**S3 + CloudFront**. Hoje é uma SPA de página única: o usuário escolhe a loteria,
informa a quantidade de jogos e dispara uma simulação que é enviada ao backend
(`loterias-sim-api`), que por sua vez enfileira o processamento na AWS (SQS →
validator → Step Functions → core).

| Item | Valor |
|------|-------|
| Framework | Next.js **16.2.9** (App Router, export estático) |
| UI | React **19.2.4** / React DOM 19.2.4 |
| Estilo | CSS puro (CSS Modules + variáveis globais, tema dark "glassmorphism") |
| Lint | ESLint 9 + `eslint-config-next` |
| Hospedagem | S3 (`loteriassim.com.br`) + CloudFront (`d3s3aeemvru9q3.cloudfront.net`) |
| Região | `sa-east-1` (origem/API) · `us-east-1` (certificado ACM do CloudFront) |

---

## Estrutura do projeto

```
loterias-sim-web/
├── src/app/
│   ├── layout.js          # Layout raiz: <html>/<body>, metadata, importa globals.css
│   ├── page.js            # Página única ('use client'): seletor de loteria + simulação
│   ├── globals.css        # Design system: variáveis CSS, fonte Outfit, utilitários glass
│   ├── page.module.css    # Estilos com escopo do componente Home
│   └── favicon.ico
├── public/                # Assets estáticos (svgs)
├── out/                   # Saída do build estático (sincronizada para o S3) — gerada
├── next.config.mjs        # output: 'export' + images.unoptimized: true
├── jsconfig.json          # Alias de import "@/*" -> "./src/*"
├── eslint.config.mjs
├── .env.local             # NEXT_PUBLIC_API_URL (não versionado)
└── package.json
```

---

## Como rodar localmente

```bash
npm install
echo "NEXT_PUBLIC_API_URL=https://p49mq9wj2d.execute-api.sa-east-1.amazonaws.com" > .env.local
npm run dev                         # http://localhost:3000
```

Scripts (`package.json`):

| Script | Ação |
|--------|------|
| `npm run dev`   | Servidor de desenvolvimento (hot reload) |
| `npm run build` | Build estático → diretório `out/` |
| `npm run start` | Serve o build de produção |
| `npm run lint`  | ESLint |

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `NEXT_PUBLIC_API_URL` | sim | URL base do API Gateway (`loterias-sim-api`). Em produção: `https://p49mq9wj2d.execute-api.sa-east-1.amazonaws.com`. O prefixo `NEXT_PUBLIC_` expõe o valor ao navegador. |

> Se a variável não for definida, o código usa o placeholder
> `COLOQUE_Sua_URL_Do_API_GATEWAY_AQUI` (`src/app/page.js`), o que faz as chamadas
> falharem — defina sempre o `.env.local` antes do build.

---

## Integração com o backend

A página (`src/app/page.js`) conversa com o `loterias-sim-api`:

- **POST `/jogos`** — usado no clique de "Gerar Jogo Inteligente". Envia
  `{ lottery, gamesToGenerate, timestamp }` em JSON. Em caso de `200`, mostra a
  notificação de sucesso; senão, mensagem de erro.
- **GET `/sugestoes`** — leitura das sugestões do `loterias-ml-engine` (números
  "quentes/frios"). **Está implementado mas comentado** (`page.js`, linhas 24-29) —
  é o principal gancho de evolução para exibir as previsões na tela.

> ⚠️ A estrutura do payload de `POST /jogos` enviada hoje pela web
> (`{ lottery, gamesToGenerate, timestamp }`) **não corresponde** ao que o
> `loterias-app-validator` espera consumir do SQS
> (`{ email, gameType, voucher, lotteryNumber, games }`). Veja
> [Pontos de atenção](#pontos-de-atenção).

---

## Build e deploy (produção)

O deploy é estático: build → sync para o S3 → invalidação do CloudFront.

```bash
# 1) Garanta o .env.local com a NEXT_PUBLIC_API_URL de produção
npm run build

# 2) Suba o build para o bucket
aws s3 sync out/ s3://loteriassim.com.br/ --delete

# 3) Invalide o cache do CloudFront para publicar imediatamente
aws cloudfront create-invalidation --distribution-id E3PSG08SY8CQCP --paths "/*"
```

Infra de hospedagem (conta `585482653811`):

| Recurso | Identificador |
|---------|---------------|
| Bucket S3 | `loteriassim.com.br` (região `sa-east-1`) |
| CloudFront | `E3PSG08SY8CQCP` → `d3s3aeemvru9q3.cloudfront.net` |
| Certificado ACM | `arn:aws:acm:us-east-1:585482653811:certificate/84215859-95aa-4259-bb3b-5d4d78990296` (cobre `loteriassim.com.br` e `*.loteriassim.com.br`) |
| DNS | Route 53, zona `Z09809361Q9EZQQ6EL9YN`, registro A (alias) → CloudFront |

> ℹ️ A origem do CloudFront aponta para o **endpoint de website** do S3. Para isso
> funcionar é preciso ter o *Static website hosting* habilitado no bucket e a política
> de acesso correta — veja [Pontos de atenção](#pontos-de-atenção). Os scripts
> originais de provisionamento (`cloudfront_setup.sh`, `final_deploy.sh`) estão na raiz
> do diretório de repositórios.

---

## Arquitetura do ecossistema

```
                         loteriassim.com.br
                                 │
                    Route53 ──► CloudFront ──► S3 (loteriassim.com.br)
                                 │                  ▲
                          (este repo: web)          │ deploy estático (out/)
                                 │
          POST /jogos ──► API Gateway (HTTP) ──► loterias-sim-api (Lambda)
                                 │                       │
                                 │             ┌─────────┴──────────┐
                                 │             ▼                    ▼
                                 │        SQS (loterias-app-queue)  DynamoDB
                                 │             │              (LoteriasPredictiveData)
                                 │             ▼                    ▲ GET /sugestoes
                                 │     loterias-app-validator       │
                                 │             │                    │
                                 │   EventBridge Scheduler          │
                                 │             ▼                    │
                                 │     Step Functions ─► loterias-app-core ─► SNS (e-mail)
                                 │
   loterias-capture-results (cron) ─► S3 (loterias-resultados) ─► loterias-ml-engine ─┘
```

| Repositório | Papel |
|-------------|-------|
| **loterias-sim-web** | Frontend (este repo) |
| **loterias-sim-api** | API HTTP (Lambda Node.js): `GET /sugestoes`, `POST /jogos` |
| **loterias-ml-engine** | Análise de frequência (quentes/frios) → DynamoDB |
| **loterias-capture-results** | Captura resultados oficiais (API Caixa) → S3 |
| **loterias-app-validator** | Consome SQS, persiste apostas, agenda Step Functions |
| **loterias-app-core** | Confere apostas x resultado e notifica via SNS |

---

## Pontos de atenção

- **Contrato de payload divergente:** a web envia `{ lottery, gamesToGenerate, timestamp }`,
  mas o pipeline downstream (`validator`/`core`) espera
  `{ email, gameType, voucher, lotteryNumber, games }`. Hoje o jogo enviado **não é
  processável** pelo backend. É preciso alinhar o contrato (formulário de aposta real
  com e-mail, números escolhidos, etc.) ou um adaptador na API.
- **Feature de sugestões desativada:** `GET /sugestoes` está comentado; habilitar
  exibe as previsões do `ml-engine` ao usuário.
- **Tratamento de erros raso:** sem timeout/retry no `fetch`; mensagens de erro
  genéricas. Considerar `AbortController` e feedback mais específico.
- **`AGENTS.md`** alerta que esta versão do Next.js tem breaking changes — consulte
  `node_modules/next/dist/docs/` antes de alterar APIs do framework.

## Melhorias sugeridas

1. Implementar o fluxo real de aposta (escolha de números, e-mail, validação) e
   alinhar o payload com o backend.
2. Habilitar e renderizar `GET /sugestoes` (números quentes/frios + jogos sugeridos).
3. Adicionar timeout/retry e estados de loading mais ricos.
4. CI/CD (GitHub Actions): build + `s3 sync` + invalidação do CloudFront a cada push.
5. Disclaimer de jogo responsável e aviso de que sugestões estatísticas **não
   aumentam** a probabilidade de ganho (sorteios são eventos independentes).
6. Adicionar `www.loteriassim.com.br` como alias/redirect (o certificado já cobre).
