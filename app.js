'use strict';
/* UniAtletas — protótipo acadêmico. Dados em localStorage (simulam o back-end). */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
const fmt = s => new Date(s + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const stamp = t => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const KEY = 'ua_db', PREF = 'ua_prefs', SES = 'ua_session';
const ROLES = { atleta: 'Atleta universitário', aluno: 'Estudante não atleta', rep: 'Representante da universidade' };
const CATS = { 'Acadêmico': 'acad', 'Esportivo': 'esp', 'Pessoal': 'pes' };
const REM = { 15: '15 minutos antes', 30: '30 minutos antes', 60: '1 hora antes', 1440: '1 dia antes' };
/* RN-007 / RN-005 / RN-008: telas permitidas por perfil */
const ROUTES = {
  rotina: { label: 'Minha rotina', roles: ['atleta'] },
  calendario: { label: 'Calendário esportivo', roles: ['atleta'] },
  comunicados: { label: 'Comunicados', roles: ['atleta', 'rep'] },
  discussoes: { label: 'Discussões', roles: ['atleta', 'aluno'] }
};

let db, me = null;
const S = { view: 'rotina', day: iso(new Date()), rid: null, filter: 'Todas', tid: null };

/* ---------- dados ---------- */
function seed() {
  const t = iso(new Date()), now = Date.now();
  return {
    users: [
      { id: 'u1', name: 'Carlos Atleta', email: 'atleta@uni.br', pass: '1234', role: 'atleta' },
      { id: 'u2', name: 'Bia Estudante', email: 'aluno@uni.br', pass: '1234', role: 'aluno' },
      { id: 'u3', name: 'Setor de Esportes', email: 'rep@uni.br', pass: '1234', role: 'rep' }
    ],
    routines: [{ id: 'r1', owner: 'u1', name: 'Semestre 2026/2' }],
    commitments: [
      { id: 'c1', rid: 'r1', owner: 'u1', title: 'Aula de Engenharia de Requisitos', cat: 'Acadêmico', date: t, start: '08:00', end: '10:00', rem: '30' },
      { id: 'c2', rid: 'r1', owner: 'u1', title: 'Treino de futsal', cat: 'Esportivo', date: t, start: '16:00', end: '18:00', rem: '60' },
      { id: 'c3', rid: 'r1', owner: 'u1', title: 'Prova de Banco de Dados', cat: 'Acadêmico', date: addDays(t, 2), start: '19:00', end: '21:00', rem: '1440' }
    ],
    alerts: [],
    events: [
      { id: 'e1', title: 'Treino coletivo de vôlei', date: addDays(t, 1), start: '18:00', end: '20:00', place: 'Ginásio universitário', info: 'Levar uniforme e garrafa de água.' },
      { id: 'e2', title: 'Jogo: futsal masculino', date: addDays(t, 4), start: '20:00', end: '21:30', place: 'Quadra 2', info: 'Chegada recomendada 30 minutos antes.' },
      { id: 'e3', title: 'Competição interuniversitária de atletismo', date: addDays(t, 9), start: '08:00', end: '16:00', place: 'Pista municipal', info: 'Inscrições confirmadas pelo setor de esportes.' }
    ],
    notices: [
      { id: 'n1', title: 'Calendário de competições do semestre', body: 'O setor de esportes divulgou as datas das competições interuniversitárias. Confira o calendário esportivo e organize suas provas com antecedência.', author: 'Setor de Esportes', ts: now - 864e5 }
    ],
    threads: [
      { id: 't1', title: 'Futsal', posts: [{ id: 'p1', uid: 'u2', name: 'Bia Estudante', role: 'aluno', text: 'Quando abrem as inscrições para o campeonato?', ts: now - 36e5 }] },
      { id: 't2', title: 'Vôlei', posts: [] },
      { id: 't3', title: 'Atletismo e corrida', posts: [] }
    ]
  };
}
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
function load() { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; } if (!db) { db = seed(); save(); } }
const mine = () => db.commitments.filter(c => c.owner === me.id);           // RN-004
const myRoutines = () => db.routines.filter(r => r.owner === me.id);        // RN-001

/* ---------- preferências (RNF-007) ---------- */
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } })();
function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.style.setProperty('--fs', (prefs.fs || 100) + '%');
  localStorage.setItem(PREF, JSON.stringify(prefs));
}

/* ---------- feedback ---------- */
function toast(msg, ok) {
  const el = document.createElement('div');
  el.className = 'toast' + (ok ? ' ok' : ''); el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), 5000);
}
const dlg = $('#dlg');
const openD = html => { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); };
const closeD = () => dlg.open && dlg.close();
const err = (f, k, m) => { const e = f.querySelector('[data-e=' + k + ']'); if (e) e.textContent = m || ''; return !!m; };
const tag = c => `<span class="tag ${CATS[c] || 'pes'}">${esc(c)}</span>`;

/* ---------- autenticação (RNF-003) ---------- */
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
  $('#loginForm').hidden = b.dataset.tab !== 'login'; $('#regForm').hidden = b.dataset.tab !== 'register';
});
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = db.users.find(x => x.email === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) { $('#lErr').textContent = 'E-mail ou senha incorretos.'; return; }
  $('#lErr').textContent = ''; login(u);
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const name = $('#rName').value.trim(), email = $('#rEmail').value.trim().toLowerCase(), pass = $('#rPass').value;
  const msg = !name ? 'Informe o nome.' : !/^\S+@\S+\.\S+$/.test(email) ? 'Informe um e-mail válido.' : pass.length < 4 ? 'A senha precisa de ao menos 4 caracteres.' : db.users.some(x => x.email === email) ? 'Este e-mail já está cadastrado.' : '';
  $('#rErr').textContent = msg; if (msg) return;
  const u = { id: uid(), name, email, pass, role: $('#rRole').value };
  db.users.push(u); save(); login(u);
};
function login(u) { sessionStorage.setItem(SES, u.id); me = u; boot(); }
$('#logout').onclick = () => { sessionStorage.removeItem(SES); me = null; closeD(); $('#app').hidden = true; $('#auth').hidden = false; };

function boot() {
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#who').textContent = me.name + ' · ' + ROLES[me.role];
  const allowed = Object.keys(ROUTES).filter(k => ROUTES[k].roles.includes(me.role));
  $('#nav').innerHTML = allowed.map(k => `<button type="button" data-act="go" data-id="${k}">${ROUTES[k].label}</button>`).join('');
  S.rid = null; go(allowed[0]); tick();
}
function go(v) {
  if (!ROUTES[v] || !ROUTES[v].roles.includes(me.role)) return;
  S.view = v;
  document.querySelectorAll('#nav button').forEach(b => b.dataset.id === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  render();
}
function render() { $('#view').innerHTML = VIEWS[S.view](); }

/* ---------- telas ---------- */
const VIEWS = {
  rotina() {
    const rs = myRoutines();
    if (!rs.length) return `<div class="head"><div><h1>Minha rotina</h1><p class="muted">Crie uma rotina para começar a cadastrar compromissos.</p></div></div>
      <div class="empty">Você ainda não tem rotina.<br><br><button class="btn primary" data-act="newR">Criar rotina</button></div>`;
    if (!rs.some(r => r.id === S.rid)) S.rid = rs[0].id;
    const all = mine(), inR = all.filter(c => c.rid === S.rid);
    const d = new Date(S.day + 'T12:00'), mon = addDays(S.day, -((d.getDay() + 6) % 7));
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const s = addDays(mon, i), n = inR.filter(c => c.date === s).length;
      return `<button class="day" data-act="day" data-id="${s}" aria-pressed="${s === S.day}">${new Date(s + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' })}<strong>${s.slice(8)}</strong><span class="dot">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
    }).join('');
    const list = inR.filter(c => c.date === S.day && (S.filter === 'Todas' || c.cat === S.filter)).sort((a, b) => a.start.localeCompare(b.start));
    const items = list.map(c => {
      const clash = all.some(o => o.id !== c.id && o.date === c.date && c.start < o.end && o.start < c.end);
      return `<button class="item" data-act="detail" data-id="${c.id}"><span class="time">${c.start} – ${c.end}</span><span class="grow"><span class="title">${esc(c.title)}</span><br>${tag(c.cat)}${c.rem ? `<span class="muted small">Lembrete: ${REM[c.rem]}</span>` : ''}${clash ? ' <span class="tag warn">Conflito de horário</span>' : ''}</span></button>`;
    }).join('');
    return `<div class="head"><div><h1>Minha rotina</h1><p class="muted">${esc(fmt(S.day))} · ${list.length} compromisso${list.length === 1 ? '' : 's'}</p></div>
      <button class="btn primary" data-act="newC">Novo compromisso</button></div>
      <div class="bar"><select id="selR" aria-label="Rotina">${rs.map(r => `<option value="${r.id}" ${r.id === S.rid ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
      <button class="btn ghost" data-act="newR">Nova rotina</button><span class="grow"></span>
      <button class="btn ghost" data-act="prev" aria-label="Semana anterior">‹</button><button class="btn ghost" data-act="today">Hoje</button><button class="btn ghost" data-act="next" aria-label="Próxima semana">›</button>
      <input type="date" id="pick" value="${S.day}" aria-label="Consultar outro período" style="width:auto"></div>
      <div class="days">${days}</div>
      <div class="chips">${['Todas', ...Object.keys(CATS)].map(c => `<button class="chip" data-act="filter" data-id="${c}" aria-pressed="${S.filter === c}">${c}</button>`).join('')}</div>
      <div class="list">${items || '<div class="empty">Nenhum compromisso neste período.</div>'}</div>`;
  },
  calendario() {
    const ev = [...db.events].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return `<div class="head"><div><h1>Calendário esportivo</h1><p class="muted">Treinos, jogos e competições registrados.</p></div></div>
      <div class="list">${ev.map(e => `<button class="item" data-act="ev" data-id="${e.id}"><span class="time">${new Date(e.date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}<br>${e.start} – ${e.end}</span><span class="grow"><span class="title">${esc(e.title)}</span><br><span class="muted small">${esc(e.place)}</span></span></button>`).join('') || '<div class="empty">Não há eventos previstos.</div>'}</div>`;
  },
  comunicados() {
    const n = [...db.notices].sort((a, b) => b.ts - a.ts);
    const form = me.role === 'rep' ? `<form class="panel" id="nForm" novalidate><h2>Publicar comunicado</h2><br>
      <div class="field"><label for="nt">Título <span class="req">*</span></label><input id="nt" name="title"><span class="error" data-e="title"></span></div>
      <div class="field"><label for="nb">Conteúdo <span class="req">*</span></label><textarea id="nb" name="body"></textarea><span class="error" data-e="body"></span></div>
      <button class="btn primary" type="submit">Publicar comunicado</button></form>` : '';
    return `<div class="head"><div><h1>Comunicados</h1><p class="muted">Avisos publicados pela universidade.</p></div></div>${form}
      <div class="list">${n.map(x => `<button class="item" data-act="notice" data-id="${x.id}"><span class="time">${stamp(x.ts)}</span><span class="grow"><span class="title">${esc(x.title)}</span><br><span class="muted small">${esc(x.author)}</span></span></button>`).join('') || '<div class="empty">Não existem comunicados disponíveis.</div>'}</div>`;
  },
  discussoes() {
    if (!db.threads.length) return '<div class="head"><h1>Discussões</h1></div><div class="empty">Não há discussões disponíveis.</div>';
    const t = db.threads.find(x => x.id === S.tid) || db.threads[0]; S.tid = t.id;
    return `<div class="head"><div><h1>Discussões</h1><p class="muted">Converse com outros estudantes sobre esportes.</p></div></div>
      <div class="split"><div class="list">${db.threads.map(x => `<button class="item" data-act="thread" data-id="${x.id}" ${x.id === t.id ? 'aria-current="true" style="border-color:var(--blue)"' : ''}><span class="grow"><span class="title">${esc(x.title)}</span><br><span class="muted small">${x.posts.length} mensagem(ns)</span></span></button>`).join('')}</div>
      <div class="panel"><h2>${esc(t.title)}</h2>
      ${t.posts.map(p => `<div class="post"><strong>${esc(p.name)}</strong> <span class="muted small">${ROLES[p.role]} · ${stamp(p.ts)}</span><p>${esc(p.text)}</p></div>`).join('') || '<p class="muted">Seja o primeiro a escrever nesta discussão.</p>'}
      <form id="pForm" novalidate style="margin-top:1rem"><div class="field"><label for="pm">Sua mensagem</label><textarea id="pm" name="text"></textarea><span class="error" data-e="text"></span></div>
      <button class="btn primary" type="submit">Publicar mensagem</button></form></div></div>`;
  }
};

/* ---------- diálogos ---------- */
function cDialog(id) {
  const c = id ? mine().find(x => x.id === id) : null;                     // RN-004
  if (id && !c) return;
  openD(`<h2>${c ? 'Editar compromisso' : 'Novo compromisso'}</h2>
  <form id="cForm" data-id="${c ? c.id : ''}" novalidate>
    <div class="field"><label for="ct">Título <span class="req">*</span></label><input id="ct" name="title" value="${c ? esc(c.title) : ''}" placeholder="Ex.: Revisão de Banco de Dados"><span class="error" data-e="title"></span></div>
    <div class="row"><div class="field"><label for="cc">Categoria <span class="req">*</span></label><select id="cc" name="cat"><option value="">Selecione</option>${Object.keys(CATS).map(k => `<option ${c && c.cat === k ? 'selected' : ''}>${k}</option>`).join('')}</select><span class="error" data-e="cat"></span></div>
    <div class="field"><label for="cd">Data <span class="req">*</span></label><input id="cd" type="date" name="date" value="${c ? c.date : S.day}"><span class="error" data-e="date"></span></div></div>
    <div class="row"><div class="field"><label for="cs">Horário inicial <span class="req">*</span></label><input id="cs" type="time" name="start" value="${c ? c.start : ''}"><span class="error" data-e="start"></span></div>
    <div class="field"><label for="ce">Horário final <span class="req">*</span></label><input id="ce" type="time" name="end" value="${c ? c.end : ''}"><span class="error" data-e="end"></span></div></div>
    <div class="field"><label for="cr">Antecedência do lembrete (opcional)</label><select id="cr" name="rem"><option value="">Sem lembrete</option>${Object.entries(REM).map(([k, v]) => `<option value="${k}" ${c && c.rem === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="actions"><button type="button" class="btn ghost" data-act="closeD">${c ? 'Cancelar' : 'Voltar'}</button><button class="btn primary" type="submit">Salvar compromisso</button></div>
  </form>`);
}
function saveC(f) {
  const g = n => f.elements[n].value.trim(), v = { title: g('title'), cat: g('cat'), date: g('date'), start: g('start'), end: g('end'), rem: g('rem') };
  const m = { title: 'Informe o título.', cat: 'Selecione a categoria.', date: 'Informe a data.', start: 'Informe o horário inicial.', end: 'Informe o horário final.' };
  let bad = false; for (const k in m) bad = err(f, k, v[k] ? '' : m[k]) || bad;       // RN-002
  if (bad) return;
  if (v.end <= v.start) return void err(f, 'end', 'O horário final deve ser posterior ao inicial.'); // RN-003
  const id = f.dataset.id;
  if (id) { const c = mine().find(x => x.id === id); if (!c) return; Object.assign(c, v, { fired: false }); }
  else db.commitments.push({ id: uid(), rid: S.rid, owner: me.id, ...v });
  S.day = v.date; save(); closeD(); render(); tick();
  toast(id ? 'Compromisso atualizado.' : 'Compromisso cadastrado com sucesso.', true);
}
function detail(id) {
  const c = mine().find(x => x.id === id); if (!c) return toast('Você não tem acesso a este compromisso.');
  openD(`<h2>${esc(c.title)}</h2><dl><dt>Categoria</dt><dd>${tag(c.cat)}</dd><dt>Data</dt><dd>${esc(fmt(c.date))}</dd><dt>Horário</dt><dd>${c.start} – ${c.end}</dd><dt>Lembrete</dt><dd>${c.rem ? REM[c.rem] : 'Sem lembrete'}</dd></dl>
  <div class="actions"><button class="btn danger" data-act="delC" data-id="${c.id}">Excluir</button><button class="btn" data-act="editC" data-id="${c.id}">Editar</button><button class="btn ghost" data-act="closeD">Fechar</button></div>`);
}
function rDialog() {
  openD(`<h2>Nova rotina</h2><form id="rForm" novalidate><div class="field"><label for="rn">Nome da rotina <span class="req">*</span></label><input id="rn" name="name" placeholder="Ex.: Semestre 2026/2"><span class="error" data-e="name"></span></div>
  <div class="actions"><button type="button" class="btn ghost" data-act="closeD">Cancelar</button><button class="btn primary" type="submit">Criar rotina</button></div></form>`);
}
function evDialog(id) {
  const e = db.events.find(x => x.id === id); if (!e) return;
  openD(`<h2>${esc(e.title)}</h2><dl><dt>Data</dt><dd>${esc(fmt(e.date))}</dd><dt>Horário</dt><dd>${e.start} – ${e.end}</dd><dt>Local</dt><dd>${esc(e.place)}</dd><dt>Detalhes</dt><dd>${esc(e.info)}</dd></dl>
  <div class="actions"><button class="btn" data-act="addEv" data-id="${e.id}">Adicionar à minha rotina</button><button class="btn ghost" data-act="closeD">Fechar</button></div>`);
}
function bellDialog() {
  const a = db.alerts.filter(x => x.owner === me.id).sort((x, y) => y.ts - x.ts);
  openD(`<h2>Lembretes</h2><div class="list">${a.map(x => `<div class="item"><span class="grow">${esc(x.text)}<br><span class="muted small">${stamp(x.ts)}</span></span></div>`).join('') || '<div class="empty">Nenhum lembrete disponível.</div>'}</div><div class="actions"><button class="btn ghost" data-act="closeD">Fechar</button></div>`);
  a.forEach(x => x.read = true); save(); bellUpdate();
}

/* ---------- lembretes (UC-009 / RN-009) ---------- */
function bellUpdate() {
  const n = me ? db.alerts.filter(x => x.owner === me.id && !x.read).length : 0;
  $('#bellN').hidden = !n; $('#bellN').textContent = n;
}
function tick() {
  if (!me) return;
  const now = Date.now(); let changed = false;
  mine().forEach(c => {
    if (!c.rem || c.fired) return;
    const st = new Date(c.date + 'T' + c.start).getTime(), en = new Date(c.date + 'T' + c.end).getTime();
    if (now >= st - c.rem * 6e4 && now < en) {
      c.fired = changed = true;
      const text = `${c.title} começa às ${c.start} (${REM[c.rem]}).`;
      db.alerts.push({ id: uid(), owner: me.id, text, ts: now, read: false }); toast('Lembrete: ' + text);
    }
  });
  if (changed) save(); bellUpdate();
}
setInterval(tick, 20000);

/* ---------- eventos ---------- */
const ACT = {
  go: id => go(id),
  day: id => { S.day = id; render(); },
  prev: () => { S.day = addDays(S.day, -7); render(); },
  next: () => { S.day = addDays(S.day, 7); render(); },
  today: () => { S.day = iso(new Date()); render(); },
  filter: id => { S.filter = id; render(); },
  newC: () => cDialog(), editC: id => cDialog(id), detail,
  delC: id => { if (!mine().some(c => c.id === id) || !confirm('Excluir este compromisso?')) return; db.commitments = db.commitments.filter(c => c.id !== id); save(); closeD(); render(); toast('Compromisso excluído.', true); },
  newR: rDialog, ev: evDialog, closeD,
  addEv: id => {
    const e = db.events.find(x => x.id === id), rs = myRoutines();
    if (!rs.length) { closeD(); return toast('Crie uma rotina antes de adicionar eventos.'); }
    db.commitments.push({ id: uid(), rid: rs.some(r => r.id === S.rid) ? S.rid : rs[0].id, owner: me.id, title: e.title, cat: 'Esportivo', date: e.date, start: e.start, end: e.end, rem: '' });
    save(); closeD(); toast('Evento adicionado à sua rotina.', true);
  },
  notice: id => { const n = db.notices.find(x => x.id === id); if (n) openD(`<h2>${esc(n.title)}</h2><p class="muted small">${esc(n.author)} · ${stamp(n.ts)}</p><p style="white-space:pre-wrap">${esc(n.body)}</p><div class="actions"><button class="btn ghost" data-act="closeD">Fechar</button></div>`); },
  thread: id => { S.tid = id; render(); }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b.dataset.id); });
document.addEventListener('change', e => {
  if (e.target.id === 'selR') { S.rid = e.target.value; render(); }
  if (e.target.id === 'pick' && e.target.value) { S.day = e.target.value; render(); }
});
document.addEventListener('submit', e => {
  const f = e.target; if (!['cForm', 'rForm', 'nForm', 'pForm'].includes(f.id)) return;
  e.preventDefault();
  if (f.id === 'cForm') return saveC(f);
  if (f.id === 'rForm') {                                                      // UC-001
    const name = f.elements.name.value.trim();
    if (err(f, 'name', name ? '' : 'Informe o nome da rotina.')) return;
    const r = { id: uid(), owner: me.id, name }; db.routines.push(r); S.rid = r.id; save(); closeD(); render(); toast('Rotina criada com sucesso.', true);
  }
  if (f.id === 'nForm') {                                                      // UC-007 / RN-005 / RN-006
    if (me.role !== 'rep') return toast('Você não tem permissão para publicar comunicados.');
    const t = f.elements.title.value.trim(), b = f.elements.body.value.trim();
    const bad = err(f, 'title', t ? '' : 'Informe o título.') | err(f, 'body', b ? '' : 'Informe o conteúdo.');
    if (bad) return;
    db.notices.push({ id: uid(), title: t, body: b, author: me.name, ts: Date.now() }); save(); render(); toast('Comunicado publicado.', true);
  }
  if (f.id === 'pForm') {                                                      // UC-006 / RN-007 / RN-010
    if (!['atleta', 'aluno'].includes(me.role)) return;
    const text = f.elements.text.value.trim();
    if (err(f, 'text', text ? '' : 'Escreva uma mensagem antes de publicar.')) return;
    db.threads.find(t => t.id === S.tid).posts.push({ id: uid(), uid: me.id, name: me.name, role: me.role, text, ts: Date.now() }); save(); render(); toast('Mensagem publicada.', true);
  }
});
dlg.addEventListener('click', e => { if (e.target === dlg) closeD(); });
$('#bell').onclick = bellDialog;
$('#theme').onclick = () => { prefs.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyPrefs(); };
$('#fontUp').onclick = () => { prefs.fs = Math.min(200, (prefs.fs || 100) + 25); applyPrefs(); };
$('#fontDown').onclick = () => { prefs.fs = Math.max(100, (prefs.fs || 100) - 25); applyPrefs(); };
document.querySelector('[data-home]').onclick = e => { e.preventDefault(); if (me) go(Object.keys(ROUTES).find(k => ROUTES[k].roles.includes(me.role))); };

/* ---------- início ---------- */
applyPrefs(); load();
const sid = sessionStorage.getItem(SES), u0 = db.users.find(u => u.id === sid);
if (u0) { me = u0; boot(); } else $('#auth').hidden = false;
