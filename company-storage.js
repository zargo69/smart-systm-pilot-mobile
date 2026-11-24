/* Isolation du stockage local par entreprise.
   Le stockage historique global est attribué une seule fois au premier compte qui l'ouvre.
   Les comptes suivants démarrent dans un espace distinct et ne voient pas ces données.
*/
(() => {
  'use strict';
  const legacyKey = 'ssp-data';
  const claimedKey = 'ssp-data-legacy-claimed-v1';
  let activeKey = null;
  function keyFor(companyId) { return 'ssp-data-company-' + String(companyId); }
  function activate(companyId) {
    if (!companyId) throw new Error('Identifiant entreprise absent : stockage local non activé.');
    const targetKey = keyFor(companyId);
    let raw = localStorage.getItem(targetKey);
    if (raw === null) {
      const legacy = localStorage.getItem(legacyKey);
      const alreadyClaimed = localStorage.getItem(claimedKey) === '1';
      if (legacy !== null && !alreadyClaimed) {
        // Migration locale à sens unique : aucune donnée historique n'est supprimée.
        raw = legacy;
        localStorage.setItem(targetKey, legacy);
        localStorage.setItem(claimedKey, '1');
      } else {
        const defaults = typeof localModulesDefault !== 'undefined'
          ? JSON.parse(JSON.stringify(localModulesDefault))
          : { clients: [], sites: [], quotes: [] };
        raw = JSON.stringify(defaults);
        localStorage.setItem(targetKey, raw);
      }
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('Les données locales de cette entreprise sont illisibles. Aucune donnée n’a été remplacée.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Le stockage local de cette entreprise est invalide. Aucune donnée n’a été remplacée.');
    }
    data = parsed;
    if (typeof localModulesDefault !== 'undefined') {
      data = { ...JSON.parse(JSON.stringify(localModulesDefault)), ...data,
        settings: { ...localModulesDefault.settings, ...(data.settings || {}) } };
      for (const name of Object.keys(localModulesDefault)) {
        if (Array.isArray(localModulesDefault[name]) && !Array.isArray(data[name])) data[name] = [];
      }
    }
    activeKey = targetKey;
    if (typeof lastPersistedData !== 'undefined') lastPersistedData = JSON.stringify(data);
    applyBrandSettings?.();
    return { key: targetKey, recordCount: Object.keys(data).filter(k => Array.isArray(data[k])).reduce((n,k) => n + data[k].length, 0) };
  }
  window.SSPCompanyStorage = Object.freeze({
    activate,
    storageKey: () => activeKey || legacyKey,
    isActive: () => Boolean(activeKey)
  });
})();
