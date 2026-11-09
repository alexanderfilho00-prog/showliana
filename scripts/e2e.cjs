// End-to-end flows for Showliana on an emulated iPhone 13 (Chromium).
// Usage: npm run build && npm run start -- -p 3100, then: BASE=http://localhost:3100 node scripts/e2e.cjs .e2e
// Needs Playwright with Chromium available (npx playwright install chromium).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = process.argv[2] || __dirname;
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const sp = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
const TODAY = sp();
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TOMORROW = plus(TODAY, 1);

const results = [];
let step = '';
const ok = (name) => { results.push(['PASS', name]); console.log('PASS', name); };
function expect(cond, msg) { if (!cond) throw new Error(`${step}: ${msg}`); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    acceptDownloads: true,
    serviceWorkers: 'allow',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png') });
  const sheet = () => page.locator('.sl-sheet[role=dialog]');
  const toast = async (re) => {
    const t = page.locator('.sl-toast', { hasText: re });
    try { await t.waitFor({ timeout: 4000 }); } catch { throw new Error(`${step}: toast ${re} não apareceu (atual: "${await page.locator('.sl-toast').innerText().catch(() => '')}")`); }
    return t.innerText();
  };
  const tab = (name) => page.locator('.sl-tabbar').getByRole('button', { name, exact: true }).click();
  const fab = () => page.getByRole('button', { name: 'Nova atividade', exact: true }).last().click();
  const save = async () => { await sheet().getByRole('button', { name: 'Salvar' }).click(); };
  const waitSheetClosed = () => page.locator('.sl-sheet-layer').waitFor({ state: 'detached', timeout: 3000 });

  try {
    step = 'dedicatória';
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.getByText('Pra Jú, com carinho.').waitFor();
    expect(await page.getByText('— Alex').isVisible(), 'assinatura');
    await page.getByRole('button', { name: 'Abrir minha agenda' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(!(await page.getByText('Pra Jú, com carinho.').isVisible()), 'dedicatória voltou após recarregar');
    ok('Dedicatória aparece na primeira abertura e não volta depois de dispensada');

    step = 'hoje vazio';
    const g = await page.locator('.sl-greeting').innerText();
    expect(/^(Bom dia|Boa tarde|Boa noite), Jú$/.test(g), 'saudação ' + g);
    await page.getByText('Seu dia começa aqui').waitFor();
    await shot('10-hoje-vazio');
    ok(`Hoje vazio: "${g}", data "${await page.locator('.sl-date').innerText()}", estado vazio com Nova atividade`);

    step = 'clientes vazio + contextos';
    await tab('Clientes');
    await page.getByText('Nenhum cliente ainda').waitFor();
    for (const c of ['Bardam', 'Projetos de marca', 'Portfólio', 'Pessoal'])
      expect(await page.locator('.sl-contexts').getByText(c, { exact: true }).isVisible(), 'contexto ' + c);
    ok('Clientes começa vazio e mostra os 4 contextos padrão');

    step = 'cadastrar cliente';
    await page.getByRole('button', { name: 'Novo cliente' }).first().click();
    await sheet().getByRole('button', { name: 'Salvar' }).click();
    await sheet().getByText('Dê um nome ao cliente.').waitFor();
    await sheet().getByLabel('Nome').fill('Estúdio Arara');
    await sheet().getByRole('radio', { name: 'Sálvia' }).click();
    await sheet().getByLabel('Notas').fill('Contato: Bia. Entrega mensal.');
    await save();
    await toast(/Cliente salvo/);
    await waitSheetClosed();
    await page.getByRole('button', { name: /Estúdio Arara/ }).waitFor();
    ok('Cadastro de cliente com validação de nome, cor e notas');

    step = 'editar contexto';
    await page.locator('.sl-contexts').getByRole('button', { name: /Pessoal/ }).click();
    await sheet().getByLabel('Nome').fill('Pessoal e casa');
    await save();
    await toast(/Contexto atualizado/);
    await waitSheetClosed();
    await page.locator('.sl-contexts').getByText('Pessoal e casa').waitFor();
    ok('Contexto editável (Pessoal renomeado para "Pessoal e casa")');

    step = 'tarefa com prazo (FAB na aba Clientes)';
    await fab();
    await sheet().waitFor();
    expect(await sheet().getByRole('radio', { name: 'Tarefa' }).getAttribute('aria-checked') === 'true', 'Tarefa padrão');
    await save();
    await sheet().getByText('Dê um título para a atividade.').waitFor();
    await sheet().getByLabel('Título').fill('Enviar proposta Arara');
    await sheet().getByRole('button', { name: 'Hoje', exact: true }).click();
    expect((await sheet().getByLabel('Prazo (opcional)').inputValue()) === TODAY, 'atalho Hoje preencheu o prazo');
    await sheet().getByRole('radio', { name: 'Projetos de marca' }).click();
    await sheet().getByLabel('Cliente (opcional)').selectOption({ label: 'Estúdio Arara' });
    await save();
    await toast(/Tarefa salva/);
    await waitSheetClosed();
    ok('Tarefa com prazo criada pelo + (título obrigatório validado)');

    step = 'segunda tarefa com prazo e horário (FAB na aba Tarefas)';
    await tab('Tarefas');
    await fab();
    await sheet().getByLabel('Título').fill('Revisar portfólio');
    await sheet().getByLabel('Prazo (opcional)').fill(TOMORROW);
    await sheet().getByLabel('Horário (opcional)').fill('10:00');
    await sheet().getByRole('radio', { name: 'Portfólio' }).click();
    await save();
    await toast(/Tarefa salva/);
    await waitSheetClosed();
    await page.getByText('Revisar portfólio').waitFor();
    ok('Tarefa com prazo e horário criada pelo + na aba Tarefas e lista atualizada na hora');

    step = 'compromisso com validação (FAB na Agenda)';
    await tab('Agenda');
    await page.locator('.sl-seg').getByRole('tab', { name: 'Dia' }).click();
    await fab();
    await sheet().getByRole('radio', { name: 'Compromisso' }).click();
    await sheet().getByLabel('Título').fill('Reunião Bardam');
    await sheet().getByLabel('Data').fill(TOMORROW);
    await sheet().getByLabel('Início').fill('15:00');
    expect((await sheet().getByLabel('Fim').inputValue()) === '16:00', 'fim acompanha início');
    await sheet().getByLabel('Fim').fill('14:00');
    await save();
    await sheet().getByText('O fim precisa ser depois do início.').waitFor();
    await sheet().getByLabel('Data').fill('');
    await save();
    await sheet().getByText('Escolha a data do compromisso.').waitFor();
    await sheet().getByLabel('Data').fill(TOMORROW);
    await sheet().getByLabel('Fim').fill('16:30');
    await sheet().getByRole('radio', { name: 'Bardam' }).click();
    await save();
    await toast(/Compromisso salvo/);
    await waitSheetClosed();
    ok('Compromisso: valida data e fim depois do início, salva 15h às 16h30');

    step = 'hoje preenchido';
    await tab('Hoje');
    const todaySec = page.locator('section[aria-labelledby=h-today]');
    await todaySec.getByText('Enviar proposta Arara').waitFor();
    const next = page.locator('section[aria-labelledby=h-next]');
    await next.getByText('Reunião Bardam').waitFor();
    expect(await next.getByText('Amanhã').isVisible(), 'grupo Amanhã');
    await shot('11-hoje-preenchido');
    ok('Hoje mostra a tarefa do dia e o compromisso de amanhã em Próximos compromissos');

    step = 'agenda dia';
    await tab('Agenda');
    await page.getByRole('button', { name: 'Próximo' }).click();
    await page.locator('.sl-block', { hasText: 'Reunião Bardam' }).waitFor();
    await page.locator('.sl-block', { hasText: 'Revisar portfólio' }).waitFor();
    await shot('12-agenda-dia');
    // tap a time slot -> event prefilled
    await page.getByRole('button', { name: 'Novo compromisso às 9h' }).click();
    await sheet().waitFor();
    expect((await sheet().getByRole('radio', { name: 'Compromisso' }).getAttribute('aria-checked')) === 'true', 'tipo compromisso');
    expect((await sheet().getByLabel('Data').inputValue()) === TOMORROW, 'data do slot');
    const st = await sheet().getByLabel('Início').inputValue();
    expect(st === '09:00' || st === '09:30', 'início do slot ' + st);
    await sheet().getByRole('button', { name: 'Cancelar' }).click();
    await waitSheetClosed();
    ok(`Agenda Dia: compromisso e tarefa com horário no dia seguinte; tocar 9h abre a ficha com data e início ${st}`);

    step = 'sem horário no dia';
    await page.getByRole('button', { name: 'Hoje', exact: true }).first().click();
    await page.locator('.sl-allday').getByText('Enviar proposta Arara').waitFor();
    ok('Agenda Dia separa "Sem horário" (tarefa de hoje sem horário)');

    step = 'agenda semana';
    await page.locator('.sl-seg').getByRole('tab', { name: 'Semana' }).click();
    // the week containing tomorrow
    if (!(await page.locator('.sl-week').getByText('Reunião Bardam').isVisible())) await page.getByRole('button', { name: 'Próximo' }).click();
    await page.locator('.sl-week').getByText('Reunião Bardam').waitFor();
    await shot('13-agenda-semana');
    ok('Agenda Semana mostra tarefas e compromissos juntos');

    step = 'agenda mês';
    await page.locator('.sl-seg').getByRole('tab', { name: 'Mês' }).click();
    await page.getByRole('button', { name: 'Hoje', exact: true }).first().click();
    if (TOMORROW.slice(0, 7) !== TODAY.slice(0, 7)) await page.getByRole('button', { name: 'Próximo' }).click();
    const cell = page.locator('.sl-month-cell').filter({ has: page.locator('.sl-month-n', { hasText: new RegExp(`^${Number(TOMORROW.slice(8))}$`) }) }).filter({ hasNot: page.locator('[data-outside]') });
    const target = page.locator(`.sl-month-cell:not([data-outside])`).nth(Number(TOMORROW.slice(8)) - 1);
    await target.click();
    await page.locator('.sl-month-day').getByText('Reunião Bardam').waitFor();
    await shot('14-agenda-mes');
    await target.click();
    await sheet().waitFor();
    const pre = await sheet().getByLabel('Prazo (opcional)').inputValue();
    expect(pre === TOMORROW, 'data preenchida ' + pre);
    await sheet().getByRole('button', { name: 'Fechar' }).click();
    await waitSheetClosed();
    ok('Agenda Mês: tocar seleciona o dia; tocar de novo abre a ficha com a data preenchida');
    void cell;

    step = 'busca e filtro';
    await tab('Tarefas');
    await page.getByPlaceholder('Buscar por título').fill('proposta');
    expect((await page.locator('.sl-row').count()) === 1, 'busca filtra');
    await page.getByPlaceholder('Buscar por título').fill('');
    await page.locator('.sl-chips-scroll').getByRole('radio', { name: 'Portfólio' }).click();
    expect((await page.locator('.sl-row').count()) === 1 && (await page.getByText('Revisar portfólio').isVisible()), 'filtro contexto');
    await page.locator('.sl-chips-scroll').getByRole('radio', { name: 'Todos' }).click();
    ok('Tarefas: busca por título e filtro por contexto');

    step = 'editar';
    await page.getByRole('button', { name: /^Enviar proposta Arara/ }).click();
    await sheet().getByLabel('Título').fill('Enviar proposta revisada');
    await save();
    await toast(/Tarefa atualizada/);
    await waitSheetClosed();
    await page.getByText('Enviar proposta revisada').waitFor();
    ok('Editar tarefa atualiza a lista na hora');

    step = 'concluir e reabrir';
    await page.getByRole('button', { name: 'Concluir: Enviar proposta revisada' }).click();
    await toast(/Tarefa concluída/);
    await page.getByRole('tab', { name: /Concluídas/ }).click();
    await page.getByText('Enviar proposta revisada').waitFor();
    await page.getByRole('button', { name: 'Reabrir: Enviar proposta revisada' }).click();
    await toast(/Tarefa reaberta/);
    await page.getByRole('tab', { name: /Abertas/ }).click();
    await page.getByText('Enviar proposta revisada').waitFor();
    ok('Concluir pelo círculo (com animação), aparece em Concluídas; Reabrir volta para Abertas');

    step = 'cancelar e excluir';
    await page.getByRole('button', { name: /^Revisar portfólio/ }).click();
    await sheet().getByRole('button', { name: 'Cancelar tarefa' }).click();
    await toast(/Tarefa cancelada/);
    await waitSheetClosed();
    await page.getByRole('tab', { name: /Canceladas/ }).click();
    await page.getByRole('button', { name: /^Revisar portfólio/ }).click();
    await sheet().getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByText('Excluir esta tarefa?').waitFor();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Manter' }).click();
    expect(await sheet().isVisible(), 'Manter preserva');
    await sheet().getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
    await toast(/Tarefa excluída/);
    await waitSheetClosed();
    expect(!(await page.getByText('Revisar portfólio').isVisible()), 'excluída');
    await page.getByRole('tab', { name: /Abertas/ }).click();
    ok('Cancelar tarefa e excluir com confirmação (Manter não exclui)');

    step = 'recorrência';
    await fab();
    await sheet().getByLabel('Título').fill('Planejar semana');
    await sheet().getByRole('button', { name: 'Hoje', exact: true }).click();
    await sheet().getByRole('button', { name: 'Mais opções' }).click();
    await sheet().getByRole('radio', { name: 'Alta' }).click();
    await sheet().getByLabel('Descrição').fill('Olhar agenda e prioridades');
    await sheet().getByRole('switch').check();
    await save();
    await toast(/Tarefa salva/);
    await waitSheetClosed();
    await page.locator('section', { hasText: 'Hoje' }).getByRole('button', { name: 'Concluir: Planejar semana' }).click();
    const t = await toast(/próxima fica para/);
    await page.waitForTimeout(300);
    const countPlanejar = () => page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('showliana');
      r.onsuccess = () => { const q = r.result.transaction('activities').objectStore('activities').getAll(); q.onsuccess = () => res(q.result.filter((a) => a.title === 'Planejar semana').map((a) => a.date + ':' + a.status)); };
    }));
    let inst = await countPlanejar();
    expect(inst.length === 2 && inst.includes(plus(TODAY, 7) + ':open'), 'próxima criada ' + inst);
    await page.getByRole('tab', { name: /Concluídas/ }).click();
    await page.getByRole('button', { name: 'Reabrir: Planejar semana' }).click();
    await page.getByRole('tab', { name: /Abertas/ }).click();
    await page.locator('section', { hasText: 'Hoje' }).getByRole('button', { name: 'Concluir: Planejar semana' }).click();
    await page.waitForTimeout(900);
    inst = await countPlanejar();
    expect(inst.length === 2, 'não duplicou ' + inst);
    ok(`Recorrência semanal: "${t}"; reabrir e concluir de novo não cria duplicata (${inst.join(', ')})`);

    step = 'cliente mostra atividades';
    await tab('Clientes');
    await page.getByRole('button', { name: /Estúdio Arara/ }).click();
    await page.getByText('Enviar proposta revisada').waitFor();
    expect(await page.getByText('Contato: Bia. Entrega mensal.').isVisible(), 'notas');
    await shot('15-cliente');
    ok('Ficha do cliente mostra notas e as próprias atividades');

    step = 'persistência';
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('section[aria-labelledby=h-next]').getByText('Reunião Bardam').waitFor();
    await tab('Tarefas');
    await page.getByText('Enviar proposta revisada').waitFor();
    await tab('Clientes');
    await page.getByRole('button', { name: /Estúdio Arara/ }).waitFor();
    ok('Recarregar a página mantém tarefas, compromissos e clientes (IndexedDB)');

    step = 'backup exportar';
    await tab('Hoje');
    await page.getByRole('button', { name: 'Ajustes e backup' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: 'Exportar backup' }).click()]);
    const file = path.join(OUT, 'backup-test.json');
    await dl.saveAs(file);
    const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(backup.app === 'showliana' && backup.clients.length === 1 && backup.activities.length === 4, `backup ${backup.activities.length} atividades`);
    ok(`Exportar backup gera ${dl.suggestedFilename()} com ${backup.activities.length} atividades, ${backup.clients.length} cliente e ${backup.contexts.length} contextos`);

    step = 'backup importar';
    await page.locator('[data-testid=import-input]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"oi":1}') });
    await sheet().getByText('Este arquivo não é um backup do Showliana.').waitFor();
    // change data, then restore the backup
    const mod = { ...backup, activities: backup.activities.filter((a) => a.title !== 'Reunião Bardam') };
    await page.locator('[data-testid=import-input]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mod)) });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Substituir' }).click();
    await toast(/Backup importado: 3/);
    await waitSheetClosed();
    expect(!(await page.getByText('Reunião Bardam').isVisible()), 'import substituiu');
    await page.getByRole('button', { name: 'Ajustes e backup' }).click();
    await page.locator('[data-testid=import-input]').setInputFiles(file);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Substituir' }).click();
    await toast(/Backup importado: 4/);
    await waitSheetClosed();
    await page.locator('section[aria-labelledby=h-next]').getByText('Reunião Bardam').waitFor();
    ok('Importar backup: rejeita arquivo inválido, pede confirmação e substitui os dados');

    step = 'offline';
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    });
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.sl-greeting').waitFor({ timeout: 8000 });
    await page.locator('section[aria-labelledby=h-next]').getByText('Reunião Bardam').waitFor();
    await tab('Agenda');
    await page.locator('.sl-agenda').waitFor();
    await shot('16-offline');
    await ctx.setOffline(false);
    ok('Offline: com a rede desligada, recarregar abre o app com os dados (service worker)');

    step = 'manifesto';
    const man = await (await page.request.get(BASE + '/manifest.webmanifest')).json();
    expect(man.display === 'standalone' && man.icons.length >= 3, 'manifest');
    for (const i of man.icons) expect((await page.request.get(BASE + i.src)).ok(), 'ícone ' + i.src);
    expect((await page.request.get(BASE + '/apple-touch-icon.png')).ok(), 'apple-touch-icon');
    ok('Manifesto standalone, ícones e apple-touch-icon respondem 200');

    expect(errors.length === 0, 'erros no console: ' + errors.join(' | '));
    ok('Sem erros de JavaScript no console durante os fluxos');
  } catch (e) {
    results.push(['FAIL', e.message]);
    console.log('FAIL', e.message);
    await shot('99-fail');
    process.exitCode = 1;
  }

  // ---- reduced motion + small screen + touch targets ----
  try {
    step = 'movimento reduzido';
    const rm = await browser.newContext({ ...devices['iPhone SE'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });
    const p2 = await rm.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const ded = p2.getByRole('button', { name: 'Abrir minha agenda' });
    if (await ded.isVisible().catch(() => false)) await ded.click();
    await p2.getByRole('button', { name: 'Nova atividade', exact: true }).last().click();
    const dur = await p2.locator('.sl-sheet').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(dur.split(',').every((d) => parseFloat(d) < 0.01), 'transição ' + dur);
    ok(`prefers-reduced-motion: transição da ficha cai para ${dur}`);

    step = 'iPhone SE: ficha cabe';
    await p2.getByRole('button', { name: 'Mais opções' }).click();
    await p2.getByRole('radio', { name: 'Compromisso' }).click();
    await p2.screenshot({ path: path.join(SHOTS, '20-se-ficha.png') });
    const vp = p2.viewportSize();
    const saveBox = await p2.locator('.sl-sheet').getByRole('button', { name: 'Salvar' }).boundingBox();
    expect(saveBox && saveBox.y + saveBox.height <= vp.height && saveBox.y > 0, 'Salvar fora da tela');
    const head = await p2.locator('.sl-sheet-head').boundingBox();
    expect(head.y >= 0, 'topo da ficha cortado');
    const overflowX = await p2.locator('.sl-sheet-body').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(!overflowX, 'rolagem horizontal na ficha');
    ok(`iPhone SE (${vp.width}x${vp.height}): ficha completa visível, Salvar fixo no rodapé, sem rolagem lateral`);

    step = 'áreas de toque';
    const small = await p2.evaluate(() => {
      const els = [...document.querySelectorAll('.sl-sheet button, .sl-sheet input, .sl-sheet select, .sl-tabbar button')];
      // a switch inside a full-row <label> is tapped through the row
      return els.filter((e) => e.offsetParent !== null && !e.hidden && !(e.closest('label') && e.closest('label').getBoundingClientRect().height >= 44)).map((e) => {
        const r = e.getBoundingClientRect();
        return { t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
      }).filter((x) => x.w < 40 || x.h < 40);
    });
    expect(small.length === 0, 'alvos pequenos: ' + JSON.stringify(small));
    ok('Áreas de toque da ficha e da barra inferior têm pelo menos 40px (a maioria 44px ou mais)');
    await rm.close();
  } catch (e) {
    results.push(['FAIL', e.message]);
    console.log('FAIL', e.message);
    process.exitCode = 1;
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'e2e-results.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length} passed, ${results.filter((r) => r[0] === 'FAIL').length} failed`);
})();
