/* SMART SYST'M PILOT — persistance distante versionnée.
   L'activation est volontairement explicite après migration SQL et validation des données.
   Les conflits ne sont jamais résolus par écrasement automatique.
*/
(() => {
  'use strict';
  const client = () => window.SSPSupabase?.client;
  const stateKey = 'ssp-sync-state-v1';
  const collections = [
    'clients','sites','quotes','appointments','suppliers','purchases','invoices',
    'payments','expenses','documents','reports','auditLogs','prospects','followups',
    'pricebook','tasks','timeEntries','stockItems','stockMovements'
  ];
  let companyId = null;
  let ready = false;
  let syncing = false;
  let timer = null;
  let versions = {};
  let lastSnapshot = null;

  function readState() {
    try { const s = JSON.parse(localStorage.getItem(stateKey) || '{}'); versions = s.versions || {}; }
    catch { versions = {}; }
  }
  function writeState() {
    try { localStorage.setItem(stateKey, JSON.stringify({ versions, updatedAt: new Date().toISOString() })); }
    catch (error) { console.error('[SSPSync] État de synchronisation non sauvegardé', error); }
  }
  function rowsFromData(source) {
    const rows = [];
    for (const collection of collections) {
      const value = source?.[collection];
      if (!Array.isArray(value)) continue;
      for (const record of value) {
        if (!record || record.id == null) continue;
        rows.push({ collection, record_id: String(record.id), payload: record });
      }
    }
    return rows;
  }
  function stateKeyFor(collection, id) { return collection + ':' + id; }
  async function listRemote() {
    const { data, error } = await client().from('ssp_app_records')
      .select('collection,record_id,payload,version,deleted_at')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  function mergeRemote(remote) {
    const localRows = rowsFromData(data);
    const localByKey = new Map(localRows.map(row => [stateKeyFor(row.collection,row.record_id), row]));
    const remoteByKey = new Map(remote.map(row => [stateKeyFor(row.collection,row.record_id), row]));
    const conflicts = [];
    for (const row of remote) {
      const key = stateKeyFor(row.collection,row.record_id);
      const local = localByKey.get(key);
      if (row.deleted_at) {
        if (local) conflicts.push(key + ' (supprimé à distance)');
        continue;
      }
      if (local && JSON.stringify(local.payload) !== JSON.stringify(row.payload)) conflicts.push(key);
    }
    if (conflicts.length) {
      throw new Error('SSP_MIGRATION_CONFLICT: identifiants présents localement et à distance avec des contenus différents : ' + conflicts.slice(0,8).join(', '));
    }
    for (const row of remote) {
      const key = stateKeyFor(row.collection,row.record_id);
      versions[key] = Number(row.version);
      if (row.deleted_at) continue;
      if (!localByKey.has(key)) {
        if (!Array.isArray(data[row.collection])) data[row.collection] = [];
        data[row.collection].push(row.payload);
      }
    }
    writeState();
  }
  async function uploadLocalRows(remote) {
    const remoteByKey = new Map(remote.map(row => [stateKeyFor(row.collection,row.record_id), row]));
    for (const row of rowsFromData(data)) {
      const key = stateKeyFor(row.collection,row.record_id);
      const existing = remoteByKey.get(key);
      if (existing) {
        if (existing.deleted_at || JSON.stringify(existing.payload) !== JSON.stringify(row.payload)) {
          throw new Error('SSP_MIGRATION_CONFLICT: la fiche ' + key + ' existe déjà à distance avec un autre contenu. Aucun écrasement effectué.');
        }
        versions[key] = Number(existing.version);
        continue;
      }
      const { data: version, error } = await client().rpc('ssp_save_record', {
        p_company_id: companyId, p_collection: row.collection, p_record_id: row.record_id,
        p_payload: row.payload, p_expected_version: 0
      });
      if (error) throw error;
      versions[key] = Number(version);
    }
    writeState();
  }
  async function initialize(id) {
    if (!client() || !id) throw new Error('Client Supabase ou entreprise manquant.');
    companyId = id;
    readState();
    const remote = await listRemote();
    const local = rowsFromData(data);
    if (remote.length && local.length) mergeRemote(remote);
    else if (remote.length) mergeRemote(remote);
    else if (local.length) await uploadLocalRows(remote);
    lastSnapshot = JSON.stringify(rowsFromData(data));
    ready = true;
    schedule();
    console.info('[SSPSync] Initialisation terminée', { distant: remote.length, local: local.length });
    return { remoteCount: remote.length, localCount: local.length };
  }
  async function flush() {
    if (!ready || syncing || !navigator.onLine) return;
    syncing = true;
    try {
      const current = rowsFromData(data);
      const currentByKey = new Map(current.map(row => [stateKeyFor(row.collection,row.record_id), row]));
      const previous = new Map((JSON.parse(lastSnapshot || '[]')).map(row => [stateKeyFor(row.collection,row.record_id), row]));
      for (const [key,row] of currentByKey) {
        const before = previous.get(key);
        if (before && JSON.stringify(before.payload) === JSON.stringify(row.payload)) continue;
        const expected = Number(versions[key] || 0);
        const { data: version, error } = await client().rpc('ssp_save_record', {
          p_company_id: companyId, p_collection: row.collection, p_record_id: row.record_id,
          p_payload: row.payload, p_expected_version: expected
        });
        if (error) throw error;
        versions[key] = Number(version);
      }
      // Les suppressions sont envoyées en soft-delete avec contrôle de version.
      for (const [key,row] of previous) {
        if (currentByKey.has(key)) continue;
        const expected = Number(versions[key] || 0);
        if (!expected) throw new Error('Suppression locale non synchronisée : version distante inconnue pour ' + key);
        const { data: version, error } = await client().rpc('ssp_soft_delete_record', {
          p_company_id: companyId, p_collection: row.collection,
          p_record_id: row.record_id, p_expected_version: expected
        });
        if (error) throw error;
        versions[key] = Number(version);
      }
      lastSnapshot = JSON.stringify(current);
      writeState();
      window.dispatchEvent(new CustomEvent('ssp-sync-status', { detail: { status: 'synced' } }));
    } catch (error) {
      console.error('[SSPSync] Synchronisation suspendue sans écrasement automatique :', error);
      window.dispatchEvent(new CustomEvent('ssp-sync-status', { detail: { status: 'error', message: error.message } }));
      throw error;
    } finally { syncing = false; }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 1200);
  }
  window.addEventListener('online', () => flush().catch(() => {}));
  window.SSPSync = Object.freeze({
    initialize,
    schedule,
    flush,
    isReady: () => ready,
    status: () => ({ ready, syncing, companyId })
  });
})();
