// Trae el texto de un pasaje (Reina-Valera 1909) para no escribirlo a mano.
async function traerVersiculo(ref) {
  const u = 'https://bss-api.thechurchofgod.info/api?bible=rv_1909&reference=' + encodeURIComponent(ref);
  const j = await (await fetch(u)).json();
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.text === 'string' && o.verse !== undefined) out.push(o.verse + ' ' + o.text.replace(/<[^>]+>/g, '').trim());
    else Object.values(o).forEach(walk);
  })(j);
  if (!out.length) throw new Error('No encontré ese pasaje. Prueba otro formato, por ejemplo "Jn 3:16".');
  return out.join(' ');
}
