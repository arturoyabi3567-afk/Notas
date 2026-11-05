const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COL = [{ k: 1, n: 'Promesa' }, { k: 2, n: 'Mandato' }, { k: 3, n: 'Aplicar' }, { k: 4, n: 'Otra' }];
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const fmt = f => new Date(f + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const libro = p => ((p || '').match(/^(?:\d\s*)?[^\d:]+/) || [''])[0].trim();
const semana = f => Math.floor((Date.parse(f) / 864e5 + 3) / 7);
let tab = 'notas', F = { q: '', pred: '', lib: '' }, FC = 0, cur = null, tmr;

function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(e._t); e._t = setTimeout(() => e.hidden = true, 2600); }

function vista() {
  $('#titulo').textContent = { notas: 'Notas', frases: 'Frases', resumen: 'Resumen' }[tab];
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  ({ notas: vNotas, frases: vFrases, resumen: vResumen })[tab]();
}

/* ---------- Notas: lista, búsqueda y filtros ---------- */
function vNotas() {
  const a = Object.values(Store.all());
  const preds = [...new Set(a.map(n => n.predicador).filter(Boolean))].sort();
  const libs = [...new Set(a.map(n => libro(n.pasaje)).filter(Boolean))].sort();
  const op = (l, v) => l.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('#vista').innerHTML = `<input id="q" type="search" placeholder="Buscar en tus notas" value="${esc(F.q)}">
  <div class="filtros"><select id="fp"><option value="">Predicador</option>${op(preds, F.pred)}</select>
  <select id="fl"><option value="">Libro</option>${op(libs, F.lib)}</select></div><div id="lista"></div>`;
  $('#q').oninput = e => { F.q = e.target.value; lista(); };
  $('#fp').onchange = e => { F.pred = e.target.value; lista(); };
  $('#fl').onchange = e => { F.lib = e.target.value; lista(); };
  lista();
}
function lista() {
  const q = F.q.toLowerCase(), todas = Object.values(Store.all());
  const a = todas.filter(n => (!F.pred || n.predicador === F.pred) && (!F.lib || libro(n.pasaje) === F.lib) &&
    (!q || [n.titulo, n.predicador, n.pasaje, n.texto, n.frase, n.resumen, ...(n.frases || []).map(f => f.t)].join(' ').toLowerCase().includes(q)))
    .sort((x, y) => y.fecha.localeCompare(x.fecha));
  $('#lista').innerHTML = a.length ? a.map(n => `<article class="nota" data-id="${n.id}"><h3>${esc(n.titulo || 'Sin título')}</h3>
    <p class="meta">${esc([fmt(n.fecha), n.predicador, n.pasaje].filter(Boolean).join(', '))}</p>${n.frase ? `<p class="fr">${esc(n.frase)}</p>` : ''}</article>`).join('')
    : `<p class="vacio">${todas.length ? 'Nada coincide con tu búsqueda.' : 'Aún no hay notas. Toca + para escribir la primera.'}</p>`;
  document.querySelectorAll('.nota').forEach(e => e.onclick = () => abrir(e.dataset.id));
}

/* ---------- Frases marcadas ---------- */
function vFrases() {
  const items = [];
  Object.values(Store.all()).forEach(n => (n.frases || []).forEach(f => items.push({ ...f, n })));
  const sh = items.filter(i => !FC || i.c === FC).sort((x, y) => y.n.fecha.localeCompare(x.n.fecha));
  $('#vista').innerHTML = `<div class="chips"><button data-c="0" class="${!FC ? 'on' : ''}">Todas</button>${COL.map(c => `<button data-c="${c.k}" class="${FC === c.k ? 'on' : ''}"><i class="dot c${c.k}"></i>${c.n}</button>`).join('')}</div>` +
    (sh.length ? sh.map(i => `<blockquote class="c${i.c}" data-id="${i.n.id}">${esc(i.t)}<cite>${esc(i.n.titulo || 'Sin título')}, ${esc(fmt(i.n.fecha))}</cite></blockquote>`).join('')
      : '<p class="vacio">Aquí aparecerán las frases que marques mientras escribes una nota.</p>');
  document.querySelectorAll('.chips button').forEach(b => b.onclick = () => { FC = +b.dataset.c; vFrases(); });
  document.querySelectorAll('blockquote').forEach(b => b.onclick = () => abrir(b.dataset.id));
}

/* ---------- Resumen: estadísticas, repaso y preguntas a la IA ---------- */
function vResumen() {
  const a = Object.values(Store.all()), semanas = new Set(a.map(n => semana(n.fecha)));
  let s = semana(hoy()), racha = 0;
  if (!semanas.has(s)) s--;
  while (semanas.has(s)) { racha++; s--; }
  const cuenta = {}; a.forEach(n => { const l = libro(n.pasaje); if (l) cuenta[l] = (cuenta[l] || 0) + 1; });
  const top = Object.entries(cuenta).sort((x, y) => y[1] - x[1])[0];
  const marcadas = a.reduce((t, n) => t + (n.frases || []).length, 0);
  const ult = [...a].sort((x, y) => y.fecha.localeCompare(x.fecha))[0];
  $('#vista').innerHTML = `<div class="stats">
    <div class="stat"><b>${a.length}</b><span>notas</span></div>
    <div class="stat"><b>${racha}</b><span>semanas seguidas</span></div>
    <div class="stat"><b>${marcadas}</b><span>frases marcadas</span></div>
    <div class="stat"><b>${top ? esc(top[0]) : '–'}</b><span>libro más anotado</span></div></div>
  ${ult ? `<h2>Para repasar</h2><div class="nota" id="rep"><h3>${esc(ult.titulo || 'Sin título')}</h3><p class="meta">${esc(fmt(ult.fecha))}</p>
    <p class="fr">${esc(ult.frase || ult.resumen || '')}</p></div>` : ''}
  <h2>Pregunta a tus notas</h2>
  <input id="preg" placeholder="Ej. ¿Qué he anotado sobre la oración?">
  <div class="fila" style="margin-top:10px"><button class="pri" id="pq">Preguntar</button><button class="sec" id="cq">Copiar para IA</button></div>
  <div id="resp"></div>`;
  if (ult) $('#rep').onclick = () => abrir(ult.id);
  const pr = () => IA.promptPregunta($('#preg').value.trim() || 'Resume los temas principales', Object.values(Store.all()));
  $('#cq').onclick = () => IA.copiar(pr()).then(() => toast('Copiado. Pégalo en tu IA'));
  $('#pq').onclick = async () => {
    $('#resp').innerHTML = '<div class="resp">Pensando…</div>';
    try { $('#resp').innerHTML = `<div class="resp">${esc(await IA.procesar(pr()))}</div>`; }
    catch (e) { $('#resp').innerHTML = `<div class="resp">${esc(e.message)}</div>`; }
  };
}

/* ---------- Editor de nota ---------- */
function estado() { const e = $('#estado'); if (e) e.textContent = !Sync.activo() ? 'Guardado en este teléfono' : Store.cola().length ? 'Pendiente de sincronizar' : 'Guardado'; }
function guardar() {
  cur.actualizado = Date.now(); Store.put(cur); estado();
  clearTimeout(tmr); tmr = setTimeout(() => Sync.flush().then(estado), 900);
}
function abrir(id) {
  cur = id ? structuredClone(Store.all()[id]) : { id: 'n' + Date.now().toString(36), fecha: hoy(), titulo: '', predicador: '', pasaje: '', versiculo: '', texto: '', frase: '', frases: [], fotos: [], resumen: '', actualizado: 0 };
  const ed = $('#editor');
  ed.innerHTML = `<div class="eh"><button id="cerrar">Listo</button><span id="estado"></span><button class="del" id="borrar">Eliminar</button></div>
  <div class="ec">
    <input class="tit" data-f="titulo" placeholder="Título del mensaje">
    <div class="fila"><input data-f="predicador" placeholder="Predicador"><input data-f="fecha" type="date"></div>
    <div class="fila"><input data-f="pasaje" placeholder="Pasaje, ej. Juan 3:16-18"><button class="sec" id="verso">Traer texto</button></div>
    <p class="vers" id="vers"></p>
    <textarea id="texto" data-f="texto" placeholder="Escribe tus notas…"></textarea>
    <div class="marca"><span>Marcar frase</span>${COL.map(c => `<button class="mk c${c.k}" data-k="${c.k}">${c.n}</button>`).join('')}</div>
    <div class="fch" id="fch"></div>
    <label class="l">Frase para la semana</label><input data-f="frase">
    <label class="l">Fotos</label><div id="fotos"></div>
    <label class="sec" style="display:inline-block">Agregar foto<input id="foto" type="file" accept="image/*" hidden></label>
    <label class="l">Resumen con IA</label><textarea data-f="resumen" id="resumen" rows="5"></textarea>
    <div class="fila" style="margin-top:10px"><button class="pri" id="ia">Resumir con IA</button><button class="sec" id="cp">Copiar para IA</button></div>
  </div>`;
  ed.hidden = false; document.body.style.overflow = 'hidden';
  ed.querySelectorAll('[data-f]').forEach(i => i.value = cur[i.dataset.f] || '');
  $('#vers').textContent = cur.versiculo || '';
  pintaFrases(); pintaFotos(); estado();
  ed.oninput = e => { const f = e.target.dataset.f; if (f) { cur[f] = e.target.value; guardar(); } };
  $('#cerrar').onclick = cerrar;
  $('#borrar').onclick = () => { if (confirm('¿Eliminar esta nota?')) { Store.del(cur.id); Sync.flush(); cerrar(); } };
  $('#verso').onclick = async () => {
    if (!cur.pasaje.trim()) return toast('Escribe primero el pasaje');
    try { cur.versiculo = await traerVersiculo(cur.pasaje.trim()); $('#vers').textContent = cur.versiculo; guardar(); }
    catch (e) { toast(e.message); }
  };
  ed.querySelectorAll('.mk').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => {
    const t = $('#texto'), s = t.selectionStart, f = t.selectionEnd;
    if (f - s < 2) return toast('Selecciona una frase en tus notas');
    cur.frases.push({ t: t.value.slice(s, f).trim(), c: +b.dataset.k }); guardar(); pintaFrases();
  }; });
  $('#foto').onchange = subirFoto;
  $('#cp').onclick = () => IA.copiar(IA.promptNota(cur)).then(() => toast('Copiado. Pégalo en tu IA'));
  $('#ia').onclick = async () => {
    toast('Procesando…');
    try { cur.resumen = await IA.procesar(IA.promptNota(cur)); $('#resumen').value = cur.resumen; guardar(); toast('Resumen guardado'); }
    catch (e) { toast(e.message); }
  };
}
function cerrar() { clearTimeout(tmr); Sync.flush(); $('#editor').hidden = true; document.body.style.overflow = ''; cur = null; vista(); }
function pintaFrases() {
  $('#fch').innerHTML = cur.frases.map((f, i) => `<div class="c${f.c}"><span>${esc(f.t)}</span><button data-i="${i}" aria-label="Quitar">×</button></div>`).join('');
  $('#fch').querySelectorAll('button').forEach(b => b.onclick = () => { cur.frases.splice(+b.dataset.i, 1); guardar(); pintaFrases(); });
}
function pintaFotos() {
  $('#fotos').innerHTML = cur.fotos.map((u, i) => `<div><a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" loading="lazy" alt="Foto"></a><button data-i="${i}" aria-label="Quitar">×</button></div>`).join('');
  $('#fotos').querySelectorAll('button').forEach(b => b.onclick = () => { cur.fotos.splice(+b.dataset.i, 1); guardar(); pintaFotos(); });
}
async function comprimir(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .72).split(',')[1];
}
async function subirFoto(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!Sync.activo()) return toast('Para guardar fotos conecta el Apps Script');
  if (!navigator.onLine) return toast('Necesitas internet para subir la foto');
  toast('Subiendo foto…');
  try {
    const { url } = await Sync.api({ accion: 'foto', nombre: `${cur.fecha}-${Date.now()}.jpg`, data: await comprimir(file) });
    cur.fotos.push(url); guardar(); pintaFotos(); toast('Foto guardada');
  } catch (err) { toast(err.message); }
  e.target.value = '';
}

/* ---------- Inicio ---------- */
document.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; vista(); });
$('#nuevo').onclick = () => abrir();
addEventListener('online', () => Sync.flush());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
vista();
Sync.pull().then(ok => { if (ok && !cur) vista(); }).catch(() => {});
