// IA: arma el texto para pedir un resumen, lo copia o lo manda a Gemini (vía Apps Script).
const IA = {
  promptNota(n) {
    const fr = (n.frases || []).map(f => '- ' + f.t).join('\n');
    return `Estas son mis notas de una predicación. Hazme: 1) un resumen breve, 2) los puntos principales en lista, 3) una frase corta para llevarme en la semana, 4) una aplicación práctica para esta semana. Responde en español, con tono sencillo.\n\nTítulo: ${n.titulo}\nPredicador: ${n.predicador}\nPasaje: ${n.pasaje}\n\nNotas:\n${n.texto}\n\nFrases que marqué:\n${fr || '(ninguna)'}`;
  },
  promptPregunta(q, notas) {
    const t = notas.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(n => `[${n.fecha}] ${n.titulo} (${n.pasaje})\n${n.texto}\n${(n.frases || []).map(f => '* ' + f.t).join('\n')}`).join('\n\n---\n\n').slice(0, 30000);
    return `Responde en español usando solo mis notas de predicaciones. Si no hay información, dilo.\n\nPregunta: ${q}\n\nMis notas:\n${t}`;
  },
  async procesar(prompt) { return (await Sync.api({ accion: 'ia', prompt })).texto; },
  async copiar(texto) { await navigator.clipboard.writeText(texto); }
};
