// Pega este código en tu Google Sheet: Extensiones > Apps Script.
// Luego: Implementar > Nueva implementación > Aplicación web > Acceso: "Cualquier usuario".
// Para la IA: Configuración del proyecto > Propiedades del script > GEMINI_KEY = tu clave de AI Studio.
const HOJA = 'Notas', CARPETA = 'Fotos predicaciones';
const COLS = ['id','fecha','titulo','predicador','pasaje','versiculo','texto','frase','frases','fotos','resumen','actualizado'];

function hoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(HOJA);
  if (!s) {
    s = ss.insertSheet(HOJA);
    s.appendRow(COLS);
    s.setFrozenRows(1);
    s.getRange('A:B').setNumberFormat('@');
  }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.accion === 'listar') return out_({ notas: listar_() });
    if (d.accion === 'guardar') { guardar_(d.nota); return out_({ ok: true }); }
    if (d.accion === 'borrar') { borrar_(d.id); return out_({ ok: true }); }
    if (d.accion === 'foto') return out_({ url: foto_(d) });
    if (d.accion === 'ia') return out_({ texto: ia_(d.prompt) });
    return out_({ error: 'Acción desconocida' });
  } catch (err) { return out_({ error: String(err) }); }
}

function listar_() {
  const v = hoja_().getDataRange().getValues();
  v.shift();
  return v.filter(r => r[0]).map(r => {
    const n = {};
    COLS.forEach((c, i) => {
      let x = r[i];
      if (x instanceof Date) x = Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (c === 'frases' || c === 'fotos') { try { x = JSON.parse(x || '[]'); } catch (e) { x = []; } }
      if (c === 'actualizado') x = Number(x) || 0;
      n[c] = x;
    });
    return n;
  });
}
function fila_(id) {
  const ids = hoja_().getRange('A:A').getValues().flat();
  const i = ids.indexOf(id);
  return i < 0 ? 0 : i + 1;
}
function guardar_(n) {
  const s = hoja_();
  const fila = COLS.map(c => (c === 'frases' || c === 'fotos') ? JSON.stringify(n[c] || []) : (n[c] ?? ''));
  const r = fila_(n.id);
  if (r) s.getRange(r, 1, 1, COLS.length).setValues([fila]); else s.appendRow(fila);
}
function borrar_(id) { const r = fila_(id); if (r > 1) hoja_().deleteRow(r); }

function foto_(d) {
  const it = DriveApp.getFoldersByName(CARPETA);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
  const f = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(d.data), 'image/jpeg', d.nombre || 'foto.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1000';
}

function ia_(prompt) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!key) throw new Error('Falta GEMINI_KEY en las propiedades del script');
  const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const j = JSON.parse(r.getContentText());
  if (j.error) throw new Error(j.error.message);
  return j.candidates[0].content.parts.map(p => p.text).join('');
}
