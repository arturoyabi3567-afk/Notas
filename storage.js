// Guardado local + cola de sincronización con Google Sheets (vía Apps Script)
const Store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  all() { return this.get('np_notas', {}); },
  put(n) { const a = this.all(); a[n.id] = n; localStorage.setItem('np_notas', JSON.stringify(a)); this.enqueue(n.id); },
  del(id) { const a = this.all(); delete a[id]; localStorage.setItem('np_notas', JSON.stringify(a)); this.enqueue(id); },
  cola() { return this.get('np_cola', []); },
  enqueue(id) { const c = this.cola(); if (!c.includes(id)) c.push(id); localStorage.setItem('np_cola', JSON.stringify(c)); },
  dequeue(id) { localStorage.setItem('np_cola', JSON.stringify(this.cola().filter(x => x !== id))); }
};

const Sync = {
  activo: () => !!CONFIG.URL_SCRIPT,
  async api(body) {
    if (!CONFIG.URL_SCRIPT) throw new Error('Falta la URL del Apps Script en js/config.js');
    const r = await fetch(CONFIG.URL_SCRIPT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  },
  async flush() {
    if (!this.activo() || !navigator.onLine) return;
    for (const id of Store.cola()) {
      const n = Store.all()[id];
      try {
        await this.api(n ? { accion: 'guardar', nota: n } : { accion: 'borrar', id });
        Store.dequeue(id);
      } catch (e) { return; }
    }
  },
  async pull() {
    if (!this.activo() || !navigator.onLine) return false;
    await this.flush();
    const { notas } = await this.api({ accion: 'listar' });
    const local = Store.all(), pend = Store.cola(), remoto = {};
    notas.forEach(n => { remoto[n.id] = n; });
    Object.keys(local).forEach(id => { if (!pend.includes(id) && !remoto[id]) delete local[id]; });
    notas.forEach(n => { if (!pend.includes(n.id) && (!local[n.id] || (n.actualizado || 0) >= (local[n.id].actualizado || 0))) local[n.id] = n; });
    localStorage.setItem('np_notas', JSON.stringify(local));
    return true;
  }
};
