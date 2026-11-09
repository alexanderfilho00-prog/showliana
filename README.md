# Showliana

A agenda de bolso da Jú: tarefas, compromissos e clientes num só lugar.
Feita pelo Alex para a Juliana Barbosa.

App web instalável no iPhone (PWA), em português (`pt-BR`, fuso `America/Sao_Paulo`).
Os dados ficam guardados no próprio aparelho (IndexedDB), com backup em JSON.

## Telas

- **Hoje**: saudação, data, tarefas do dia, atrasadas e próximos compromissos.
- **Tarefas**: busca, filtro por contexto e abas Abertas, Concluídas e Canceladas.
- **Agenda**: Dia, Semana e Mês, com faixa "Sem horário".
- **Clientes**: marcas e clientes com cor e notas, e contextos editáveis.
- **+**: ficha de nova tarefa ou compromisso, em qualquer aba.
- **Ajustes** (engrenagem na tela Hoje): exportar e importar backup.

## Rodar no computador

Requer Node.js 20.9 ou mais novo.

```bash
npm install
npm run build
npm run start
```

Abra http://localhost:3000. O `npm run dev` também funciona, mas o modo
offline (service worker) só é ativado no build de produção.

## Publicar

1. Suba este projeto num repositório do GitHub.
2. Na Vercel, use **Add New → Project**, importe o repositório e clique em
   **Deploy** (as configurações padrão funcionam).
3. O app fica em `https://<seu-projeto>.vercel.app`. É preciso HTTPS para
   instalar no iPhone e para o modo offline.

## Instalar no iPhone

1. Abra o endereço HTTPS no **Safari**.
2. Toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.
3. Abra o app uma vez com internet para ele ficar disponível offline.

## Testes

Testes de ponta a ponta com Playwright num iPhone emulado. Com o app rodando
na porta 3100 (`npm run build && npm run start -- -p 3100`), em outro terminal:

```bash
npm install --no-save playwright
npx playwright install chromium
BASE=http://localhost:3100 npm run test:e2e
```

## Estrutura

```
src/app/          layout (metadados, fonte, tema) e página
src/app/globals.css  estilos e tokens de cor
src/components/   telas, ficha de atividade, barra inferior, gatinho
src/lib/          banco local (IndexedDB), datas, tipos
public/           manifesto, ícones e service worker (sw.js)
scripts/e2e.cjs   testes de ponta a ponta
```

Próxima etapa (ainda não incluída): sincronização entre aparelhos e
notificações com o app fechado.
