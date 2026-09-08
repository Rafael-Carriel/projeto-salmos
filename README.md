# Projeto Salmos

Um salmo por dia, do 1 ao 150. No dia 1 abre o Salmo 1, no dia 2 o Salmo 2, e assim
por diante. **Se um dia virar sem leitura, a contagem volta ao Salmo 1** — é a regra
que dá peso ao hábito.

PWA em React + Firebase, funciona offline, com três lembretes por dia via push.

---

## Como funciona

| | |
|---|---|
| **Início** | Pessoal. Cada um começa quando clica em "Começar hoje". |
| **Desbloqueio** | O salmo do dia é `dia do ciclo`. Salmos já abertos podem ser relidos sempre. |
| **Reset** | Passou a meia-noite sem marcar como lido → volta ao Salmo 1. O recorde fica guardado. |
| **Offline** | Os 150 textos vêm no aplicativo. Ler e marcar como lido funcionam sem rede; sincroniza quando a conexão volta. |
| **Lembretes** | Três horários escolhidos pela pessoa. Só dispara horários já vencidos e nunca repete no mesmo dia. |

O texto é a Almeida (domínio público), baixada da [bible-api.com](https://bible-api.com)
por `npm run psalms` e gravada em `public/psalms.json`. Nenhuma leitura do
Firestore para mostrar um salmo.

---

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com as chaves do seu projeto Firebase
npm run dev
```

Scripts:

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `tsc -b` + build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` (necessário para testar o service worker) |
| `npm run lint` | oxlint |
| `npm run psalms` | Rebaixa os 150 salmos para `public/psalms.json` |
| `npm run icons` | Regera os ícones PNG e o favicon a partir do SVG |
| `npm run reminders:dry` | Lista quem receberia lembrete agora, sem enviar |
| `npm run deploy` | Build + `firebase deploy --only hosting,firestore` |

> O service worker não roda em `npm run dev`. Para testar push, instalação e
> offline, use `npm run build && npm run preview`.

---

## Configurando o Firebase

### 1. Criar o projeto

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Criar** → ícone **Web** (`</>`) → registre um app. Copie o objeto
   `firebaseConfig` que aparece: os seis valores vão para o `.env`.

### 2. Authentication

**Build → Authentication → Get started**, e habilite:

- **E-mail/senha**
- **Google** (escolha um e-mail de suporte)

Em **Settings → Authorized domains**, confirme que `localhost` está lá e adicione
o domínio do Hosting (`SEU-PROJETO.web.app`) depois de publicar.

### 3. Cloud Firestore

**Build → Firestore Database → Create database** → modo de produção, região
`southamerica-east1` (São Paulo) se seu público é no Brasil.

As regras estão em [`firestore.rules`](firestore.rules) e sobem com o deploy.
Elas não são cosméticas — limitam `lastReadDay` a avançar no máximo 1 por
gravação, então ninguém "pula" para o dia 150 mexendo no cliente.

### 4. Cloud Messaging (push)

**Configurações do projeto → Cloud Messaging → Web Push certificates → Generate
key pair**. A chave pública vai em `VITE_FIREBASE_VAPID_KEY`.

### 5. `.firebaserc` — apontar o CLI para o projeto

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Isso cria o `.firebaserc`. Depois:

```bash
npm run deploy
```

### 6. Virar administrador

O papel de admin **não** fica no documento do próprio usuário — se ficasse, cada
pessoa poderia se promover. Ele vive numa coleção separada que o cliente só lê:

1. Entre no aplicativo uma vez com sua conta.
2. No Console → Firestore, copie seu UID em **Authentication → Users**.
3. Crie a coleção `roles`, documento com o **ID igual ao seu UID**, e um campo
   `admin` (boolean) = `true`.
4. Recarregue o aplicativo: a aba **Painel** aparece.

---

## GitHub Actions

Dois workflows. Em **Settings → Secrets and variables → Actions**:

### Secrets

| Nome | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON inteiro de **Configurações do projeto → Contas de serviço → Gerar nova chave privada** |
| `VITE_FIREBASE_API_KEY` | mesmos valores do `.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_FIREBASE_VAPID_KEY` | |

### Variables

| Nome | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | o ID do projeto |
| `APP_URL` | `https://SEU-PROJETO.web.app` — o link que abre ao tocar na notificação |

### [`deploy.yml`](.github/workflows/deploy.yml)

Publica no Hosting a cada push na `main`.

### [`reminders.yml`](.github/workflows/reminders.yml)

O relógio dos lembretes, rodando em `:07` e `:37` de cada hora.

**Por que aqui e não no Firebase:** agendar tarefas no Firebase exige Cloud
Functions, que exige o plano Blaze (cartão de crédito). *Enviar* pelo FCM é
gratuito no plano Spark. Então o GitHub Actions faz o papel de relógio e o
[`scripts/send-reminders.mjs`](scripts/send-reminders.mjs) chama o FCM.

O script calcula a data e a hora **no fuso de cada pessoa**, dispara só horários
que já passaram, marca o que enviou em `sentToday` e junta horários atrasados
numa notificação só. Rode `workflow_dispatch` com `dry_run` ligado para ver
quem receberia antes de enviar de verdade.

---

## Áudio

O aplicativo guarda apenas a **URL** de cada narração, em
`content/audio → urls: { "1": "https://…" }`. Você cola os links no **Painel →
Áudio dos salmos**, um por salmo. O player aparece desabilitado ("Narração ainda
não disponível") enquanto o campo estiver vazio.

Áudio já ouvido fica no cache do service worker e toca offline.

**Antes de hospedar os MP3 no próprio Hosting:** o plano gratuito dá 10 GB
armazenados mas só **360 MB/dia de transferência**. Com arquivos de ~4 MB, isso
são umas 90 escutas por dia no projeto inteiro. Para mais que isso, use um host
externo (Cloudflare R2, Backblaze B2, YouTube/Archive.org) e cole a URL — foi
exatamente por isso que o campo é uma URL livre.

---

## Estrutura

```
public/
  psalms.json              os 150 salmos (275 KB, fora do pacote JS)
  firebase-messaging-sw.js service worker do push
src/
  lib/cycle.ts             a regra do ciclo — o coração do aplicativo
  lib/firebase.ts          inicialização + cache offline do Firestore
  lib/psalms.ts            acesso ao texto
  lib/push.ts              permissão, token FCM, mensagens em primeiro plano
  hooks/useProfile.ts      documento do usuário, marcar como lido, favoritos
  hooks/useIsAdmin.ts      lê roles/{uid}
  screens/                 Hoje, Saltério, Salmo, Guardados, Ajustes, Painel
  components/              PsalmLeaf, AudioPlayer, ícones
scripts/
  fetch-psalms.mjs         baixa o texto
  send-reminders.mjs       envia os lembretes (roda no CI)
  make-icons.mjs           gera os ícones
firestore.rules            as regras de segurança
```

### Modelo de dados

```
users/{uid}
  name, email, photoURL, timeZone
  cycleStartDate, lastReadDay, lastReadDate
  bestDay, completedCycles, resets
  favorites: [number]
  notificationsEnabled, notificationTimes: ['07:00','12:30','20:00']
  fcmTokens: { [token]: timestamp }
  sentToday: { date, slots: ['07:00'] }
  users/{uid}/readings/{YYYY-MM-DD}   histórico, só criação

roles/{uid}      { admin: true }   escrita só pelo Console
content/audio    { urls: { "1": "https://…" } }
```

---

## Notas

**Push no iOS** exige que a pessoa adicione o aplicativo à Tela de Início
primeiro — limitação do Safari, não do código. O aplicativo detecta e mostra a
instrução em **Ajustes**.

**`npm audit`** aponta vulnerabilidades moderadas transitivas do
`firebase-admin` (`uuid` sem checagem de limites quando recebe um `buffer`). É
uma `devDependency` usada só no CI, o código não passa buffer nenhum, e
`npm audit fix --force` derrubaria o `firebase-admin` para a v10. Fica como está.

**O pacote principal tem ~900 KB** (272 KB comprimido) porque leva o Auth e o
Firestore inteiros. Para um PWA que baixa uma vez e depois roda offline, isso é
melhor do que carregar em pedaços a cada visita.
