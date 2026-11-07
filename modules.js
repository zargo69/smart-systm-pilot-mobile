/* Modules locaux de Smart syst'm Pilot.
   Ils ne remplacent pas un serveur, une authentification ou une sauvegarde distante. */
const starterPricebook = [
  { id: 'presta-diagnostic', name: 'Diagnostic de panne électrique', category: 'Dépannage', unit: 'heure', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: 1, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-panel', name: 'Remplacement de tableau électrique', category: 'Installation', unit: 'forfait', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: null, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-renovation', name: 'Rénovation électrique', category: 'Installation', unit: 'forfait', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: null, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-socket', name: 'Installation de prise ou point lumineux', category: 'Installation', unit: 'unité', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: null, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-fault', name: 'Recherche de panne', category: 'Dépannage', unit: 'heure', unitPriceHT: null, materialUnitCostHT: 0, hoursPerUnit: 1, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-maintenance', name: 'Maintenance électrique de commerce', category: 'Maintenance', unit: 'forfait', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: null, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-gtb', name: 'Diagnostic GTB / GTC', category: 'GTB / GTC', unit: 'heure', unitPriceHT: null, materialUnitCostHT: 0, hoursPerUnit: 1, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 },
  { id: 'presta-controller', name: 'Remplacement d’automate ou de module', category: 'GTB / GTC', unit: 'unité', unitPriceHT: null, materialUnitCostHT: null, hoursPerUnit: null, hourlyCostHT: null, otherUnitCostHT: 0, vatRate: 20 }
];
const localModulesDefault = {
  appointments: [], suppliers: [], purchases: [], invoices: [], payments: [],
  expenses: [], documents: [], reports: [], auditLogs: [], prospects: [], followups: [], pricebook: starterPricebook,
  settings: { appName: 'Smart syst’m Pilot', companyName: 'Mon entreprise', country: 'FR', currency: 'EUR', googleMapsApiKey: '' }
};
data = { ...localModulesDefault, ...data, settings: { ...localModulesDefault.settings, ...(data.settings || {}) } };
let planningView = 'week';
let planningAnchor = SSPDomain.localDateISO();
let planningSiteFilter = '';
let planningAssigneeFilter = '';
let documentsView = 'active';
for (const key of Object.keys(localModulesDefault)) {
  if (Array.isArray(localModulesDefault[key]) && !Array.isArray(data[key])) data[key] = [];
}
data.auditLogs = data.auditLogs.filter(entry => entry && typeof entry === 'object' && typeof entry.recordId === 'string' && typeof entry.action === 'string').slice(0, 2000);
function applyBrandSettings() {
  if ($('#company-name')) $('#company-name').textContent = data.settings.companyName;
  if ($('#company-name-breadcrumb')) $('#company-name-breadcrumb').textContent = data.settings.companyName;
  if ($('#app-title')) document.title = data.settings.appName;
  if ($('#app-name-short')) $('#app-name-short').textContent = data.settings.appName.split(' ').slice(0, 2).join(' ').toLocaleLowerCase('fr');
  if ($('#app-name-product')) $('#app-name-product').textContent = data.settings.appName.split(' ').slice(2).join(' ').toLocaleUpperCase('fr');
}
applyBrandSettings();

let lastPersistedData = JSON.stringify(data);
function rollbackToLastSavedData() {
  if (!lastPersistedData) return;
  try {
    const restored = JSON.parse(lastPersistedData);
    data = { ...localModulesDefault, ...restored, settings: { ...localModulesDefault.settings, ...(restored.settings || {}) } };
    for (const key of Object.keys(localModulesDefault)) if (Array.isArray(localModulesDefault[key]) && !Array.isArray(data[key])) data[key] = [];
    applyBrandSettings();
  } catch { /* Le dernier instantané mémoire reste prioritaire si sa lecture échoue. */ }
}
function save({ restoring = false } = {}) {
  if (window.SSPStorageRecovery?.notice && !restoring) {
    rollbackToLastSavedData();
    notify('Enregistrement bloqué : restaurez une copie de données valide dans les paramètres avant de modifier l’application.');
    return false;
  }
  let serialized;
  if (!restoring) captureActivityChanges();
  try { serialized = JSON.stringify(data); }
  catch { rollbackToLastSavedData(); notify('Les données ne peuvent pas être préparées pour l’enregistrement. Aucune modification n’a été gardée.'); return false; }
  try {
    localStorage.setItem('ssp-data', serialized);
    lastPersistedData = serialized;
    if (restoring && window.SSPStorageRecovery) window.SSPStorageRecovery = { notice: '', backupAvailable: false };
    $('.status-dot')?.classList.add('saved');
    setTimeout(() => $('.status-dot')?.classList.remove('saved'), 500);
    return true;
  } catch {
    rollbackToLastSavedData();
    notify('Enregistrement impossible : espace local plein ou indisponible. La dernière version enregistrée a été rétablie ; exportez vos données avant de continuer.');
    return false;
  }
}

const ACTIVITY_LABELS = { clients: 'Client', sites: 'Chantier', quotes: 'Devis', invoices: 'Facture', appointments: 'Intervention', suppliers: 'Fournisseur', purchases: 'Commande', payments: 'Règlement', expenses: 'Dépense', prospects: 'Prospect', followups: 'Relance', tasks: 'Tâche', timeEntries: 'Temps passé', stockItems: 'Article de stock', stockMovements: 'Mouvement de stock', pricebook: 'Prestation', settings: 'Paramètres', accounts: 'Compte local', documents: 'Document', reports: 'Rapport' };
function activityRecordName(record) { return String(record?.name || record?.reference || record?.title || record?.label || record?.supplier || record?.client || 'Élément').slice(0, 180); }
function captureActivityChanges() {
  let before;
  try { before = JSON.parse(lastPersistedData || '{}'); } catch { return; }
  data.auditLogs ||= [];
  const actor = currentLocalActor();
  const add = (collection, record, action) => data.auditLogs.unshift({ id: newId(), collection, recordId: String(record?.id || `${collection}-${Date.now()}`), recordName: activityRecordName(record), action, ...actor, occurredAt: new Date().toISOString() });
  for (const collection of Object.keys(data)) {
    if (collection === 'auditLogs' || ['documents', 'reports'].includes(collection) || !Array.isArray(data[collection])) continue;
    const oldRows = Array.isArray(before[collection]) ? before[collection] : [];
    const oldById = new Map(oldRows.filter(row => row && row.id).map(row => [String(row.id), row]));
    const newRows = data[collection] || [];
    const newById = new Map(newRows.filter(row => row && row.id).map(row => [String(row.id), row]));
    for (const [id, record] of newById) {
      const old = oldById.get(id);
      if (!old) add(collection, record, 'Ajouté');
      else if (JSON.stringify(old) !== JSON.stringify(record)) add(collection, record, 'Modifié');
    }
    for (const [id, record] of oldById) if (!newById.has(id)) add(collection, record, 'Supprimé définitivement');
  }
  if (JSON.stringify(before.settings || {}) !== JSON.stringify(data.settings || {})) add('settings', { id: 'company-settings', name: 'Paramètres de l’entreprise' }, 'Modifié');
  data.auditLogs = data.auditLogs.slice(0, 2000);
}

const eurosToCents = value => Math.round((Number(value) || 0) * 100);
const centsToEuros = value => (Number(value) || 0) / 100;
const todayISO = () => SSPDomain.localDateISO();
const localNotice = `<div class="notice"><span class="notice-icon">ⓘ</span><span>Données métier locales de démonstration : elles restent dans ce navigateur, sans synchronisation ni sauvegarde distante. Exception : une adresse recherchée et la zone de carte sont transmises à Google après configuration et autorisation. Les documents produits restent des brouillons sans valeur comptable ou contractuelle.</span></div>`;
const siteFromValue = value => data.sites.find(site => site.id === value || site.name === value);
const siteLabel = record => data.sites.find(site => site.id === record.siteId)?.name || record.site || 'Chantier à rattacher';
const siteOptions = (selected = '') => data.sites.map(s => `<option value="${esc(s.id)}" ${s.id === selected || s.name === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('') || '<option value="">Aucun chantier — créez-en un d’abord</option>';
const clientOptions = (selected = '') => data.clients.map(c => `<option value="${esc(c.name)}" ${c.name === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('') || '<option value="">Aucun client — créez-en un d’abord</option>';
const supplierOptions = () => data.suppliers.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('') || '<option value="">Aucun fournisseur — créez-en un d’abord</option>';
const openEditSiteWithoutCoordinates = openEditSite;
openEditSite = function (id) {
  openEditSiteWithoutCoordinates(id);
  const form = document.querySelector('[data-form="edit-site"]');
  const site = data.sites.find(item => item.id === id);
  const actions = form?.querySelector('.form-actions');
  if (!form || !site || !actions) return;
  const coordinates = document.createElement('div');
  coordinates.className = 'form-row';
  coordinates.innerHTML = `<label>Latitude GPS<input name="latitude" type="number" min="-90" max="90" step="0.000001" value="${esc(site.latitude ?? '')}" placeholder="Choisie depuis l’adresse"></label><label>Longitude GPS<input name="longitude" type="number" min="-180" max="180" step="0.000001" value="${esc(site.longitude ?? '')}" placeholder="Choisie depuis l’adresse"></label>`;
  actions.before(coordinates);
};

async function mountGoogleAddressSearch(input) {
  if (!input || input.dataset.googleAddressReady === 'true') return;
  const key = String(data.settings?.googleMapsApiKey || '').trim();
  if (!key) {
    const note = document.createElement('small'); note.className = 'form-hint'; note.textContent = 'Pour obtenir des suggestions et placer cette adresse sur la carte, ajoutez votre clé Google Maps dans Paramètres.';
    input.after(note); input.dataset.googleAddressReady = 'missing-key'; return;
  }
  input.dataset.googleAddressReady = 'loading';
  try {
    await loadGoogleMaps();
    const places = await google.maps.importLibrary('places');
    const form = input.form; if (!form?.isConnected) return;
    let latitude = form.elements.namedItem('latitude');
    let longitude = form.elements.namedItem('longitude');
    if (!latitude) { latitude = document.createElement('input'); latitude.type = 'hidden'; latitude.name = 'latitude'; form.append(latitude); }
    if (!longitude) { longitude = document.createElement('input'); longitude.type = 'hidden'; longitude.name = 'longitude'; form.append(longitude); }
    const host = document.createElement('div'); host.className = 'google-address-search';
    const searchLabel = document.createElement('label'); searchLabel.className = 'google-address-label'; searchLabel.textContent = 'Rechercher une adresse avec Google';
    const suggestion = new places.PlaceAutocompleteElement();
    suggestion.setAttribute('placeholder', 'Rechercher et choisir une adresse avec Google');
    suggestion.includedRegionCodes = data.settings.country === 'CH' ? ['ch'] : ['fr'];
    host.append(suggestion); searchLabel.append(host);
    const originalLabel = input.closest('label');
    if (originalLabel) { originalLabel.hidden = true; originalLabel.after(searchLabel); } else input.after(searchLabel);
    suggestion.addEventListener('gmp-select', async event => {
      try {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ['formattedAddress', 'location', 'addressComponents'] });
        if (!place.formattedAddress) return notify('Google n’a pas fourni d’adresse complète pour ce résultat.');
        input.value = place.formattedAddress;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (place.location) { latitude.value = String(place.location.lat()); longitude.value = String(place.location.lng()); }
        const components = place.addressComponents || [];
        const city = components.find(component => component.types.includes('locality'))?.longText || components.find(component => component.types.includes('postal_town'))?.longText;
        const postal = components.find(component => component.types.includes('postal_code'))?.longText;
        if (city && form.elements.namedItem('city')) form.elements.namedItem('city').value = city;
        if (postal && form.elements.namedItem('postalCode')) form.elements.namedItem('postalCode').value = postal;
      } catch { notify('Impossible de récupérer les détails de cette adresse Google. Vérifiez la clé et les API activées.'); }
    });
    input.dataset.googleAddressReady = 'true';
  } catch (error) {
    input.dataset.googleAddressReady = 'error';
    const note = document.createElement('small'); note.className = 'form-hint'; note.textContent = error.message;
    input.after(note);
  }
}

const addressFormObserver = new MutationObserver(() => {
  const clientForm = document.querySelector('#modal-content [data-form="client"]');
  if (clientForm && !clientForm.elements.namedItem('address')) {
    const cityLabel = clientForm.querySelector('[name="city"]')?.closest('label');
    if (cityLabel) {
      const label = document.createElement('label'); label.textContent = 'Adresse complète';
      const address = document.createElement('input'); address.name = 'address'; address.type = 'text'; address.maxLength = 240; address.autocomplete = 'street-address'; address.placeholder = 'Commencez à saisir puis choisissez une suggestion';
      label.append(address); cityLabel.after(label);
    }
  }
  document.querySelectorAll('#modal-content form input[name="address"]').forEach(input => { if (!input.dataset.googleAddressReady) mountGoogleAddressSearch(input); });
});
const addressModal = document.getElementById('modal-content');
if (addressModal) addressFormObserver.observe(addressModal, { childList: true, subtree: true });

function migrateLocalSiteLinks() {
  let changed = false;
  for (const collection of ['appointments','purchases','quotes','invoices','expenses','documents','reports','tasks','timeEntries','stockMovements']) {
    for (const record of data[collection] || []) {
      if (SSPDomain.migrateLegacySiteId(record, data.sites)) changed = true;
    }
  }
  if (changed) save();
}
migrateLocalSiteLinks();
function moduleList(rows, message) { return rows.length ? `<div class="quote-preview">${rows.join('')}</div>` : `<div class="empty-state">${esc(message)}</div>`; }
function moduleRow(icon, title, subtitle, trailing = '', id = '') {
  return `<div class="quote-line"><span class="doc-icon">${iconSvg(icon)}</span><span class="quote-name"><b>${esc(title)}</b><small>${esc(subtitle)}</small></span>${trailing}${id ? `<button class="more-button" data-record-menu="${esc(id)}" aria-label="Actions">···</button>` : ''}</div>`;
}
function auditedModuleRow(icon, title, subtitle, id) {
  return `<div class="quote-line audited-document-row"><span class="doc-icon">${iconSvg(icon)}</span><span class="quote-name"><b>${esc(title)}</b><small>${esc(subtitle)}</small></span><button class="btn secondary" data-record-menu="${esc(id)}" aria-label="Ouvrir ${esc(title)}">Ouvrir</button></div>`;
}

function currentLocalActor() {
  const account = window.SSPAuth?.getCurrentAccount?.();
  return { actorId: account?.id || '', actorName: account?.displayName || 'Compte local non identifié', actorUsername: account?.username || '' };
}
function recordActivityAudit(collection, record, action, actor = currentLocalActor()) {
  data.auditLogs ||= [];
  data.auditLogs.unshift({ id: newId(), collection, recordId: String(record.id || ''), recordName: String(record.name || record.title || 'Élément').slice(0, 180), action, ...actor, occurredAt: new Date().toISOString() });
  data.auditLogs = data.auditLogs.slice(0, 2000);
}
function recordDocumentAudit(collection, record, action) { recordActivityAudit(collection, record, action); }
window.recordDocumentAudit = recordDocumentAudit;
window.recordActivityAudit = recordActivityAudit;
function archiveDocumentRecord(collection, targetRecord, { restore = false, permanent = false } = {}) {
  if (!['documents', 'reports'].includes(collection)) return false;
  const records = data[collection] || [];
  const record = records.find(item => item.id === targetRecord?.id);
  if (!record) return false;
  if (permanent) {
    if (!record.archivedAt) return notify('Archivez d’abord ce document.');
    recordDocumentAudit(collection, record, 'Suppression définitive');
    data[collection] = records.filter(item => item.id !== record.id);
  } else if (restore) {
    if (!record.archivedAt) return false;
    delete record.archivedAt; delete record.archivedBy; delete record.archivedById; delete record.archivedByUsername;
    recordDocumentAudit(collection, record, 'Restauré depuis les archives');
  } else {
    if (record.archivedAt) return false;
    const actor = currentLocalActor();
    record.archivedAt = new Date().toISOString();
    record.archivedBy = actor.actorName; record.archivedById = actor.actorId; record.archivedByUsername = actor.actorUsername;
    recordDocumentAudit(collection, record, 'Archivé');
  }
  if (!save()) return false;
  return true;
}
window.archiveDocumentRecord = archiveDocumentRecord;
function recordAuditSummary(collection, record) {
  const created = record.createdBy ? `${esc(record.createdBy)}${record.createdByUsername ? ` (@${esc(record.createdByUsername)})` : ''} · ${esc(record.createdAt || record.date || '')}` : 'Historique antérieur à la traçabilité';
  const updated = record.updatedAt ? ` · Modifié par ${esc(record.updatedBy || 'Compte inconnu')}${record.updatedByUsername ? ` (@${esc(record.updatedByUsername)})` : ''} · ${esc(record.updatedAt)}` : '';
  const archived = record.archivedAt ? `<p class="form-hint">Archivé par ${esc(record.archivedBy || 'Compte inconnu')} · ${esc(record.archivedAt)}</p>` : '';
  const events = (data.auditLogs || []).filter(item => item.collection === collection && item.recordId === record.id).slice(0, 8);
  const history = events.length ? events.map(item => `<li><b>${esc(item.action)}</b><span>${esc(item.actorName || 'Compte inconnu')}${item.actorUsername ? ` (@${esc(item.actorUsername)})` : ''} · ${esc(new Date(item.occurredAt).toLocaleString('fr-FR'))}</span></li>`).join('') : '<li><span>Aucune action enregistrée avant cette ouverture.</span></li>';
  return `<div class="record-audit"><p><b>Ajouté par</b><br>${created}${updated}</p>${archived}<details><summary>Historique des actions (${events.length})</summary><ol>${history}</ol></details></div>`;
}
function openAuditedRecord(collection, record, returnToSiteId = '') {
  if (!record) return;
  const archived = !!record.archivedAt;
  const isPhoto = record.kind === 'photo';
  const title = record.name || record.title || 'Document';
  const fileLine = collection === 'documents' ? `${isPhoto ? `<img class="op-audited-photo" src="${esc(record.dataUrl)}" alt="${esc(title)}">` : ''}<p><b>Fichier</b><br>${esc(record.fileName || 'Photo de chantier')}</p>` : `<p><b>Type</b><br>${esc(record.kind)}</p><p>${esc(record.body)}</p>`;
  const buttons = collection === 'documents' ? `<button class="btn secondary" data-audited-action="download">Télécharger</button>` : '';
  const actions = archived
    ? `<div class="form-actions">${buttons}<button class="btn secondary" data-audited-action="restore">Restaurer</button><button class="btn danger" data-audited-action="purge">Supprimer définitivement</button></div>`
    : `<div class="form-actions">${buttons}<button class="btn secondary" data-audited-action="edit">Modifier</button><button class="btn danger" data-audited-action="archive">Archiver</button></div>`;
  modal(title, `<div class="detail-card"><span class="pill neutral">${archived ? 'Archivé' : collection === 'reports' ? 'Brouillon local' : isPhoto ? 'Photo de chantier' : 'Document local'}</span>${fileLine}<p><b>Chantier</b><br>${esc(siteLabel(record))}</p><p><b>Date</b><br>${esc(record.date || '')}</p>${recordAuditSummary(collection, record)}${actions}${archived ? '<p class="form-hint">La suppression définitive est irréversible. L’entrée d’historique sera conservée, sans le fichier.</p>' : '<p class="form-hint">Archiver masque l’élément des listes actives sans effacer son contenu.</p>'}</div>`);
  const root = $('#modal-content');
  root.querySelector('[data-audited-action="download"]')?.addEventListener('click', () => {
    if (!record.dataUrl) return notify('Le contenu du fichier est indisponible.');
    const link = document.createElement('a'); link.href = record.dataUrl; link.download = record.fileName || 'document'; link.click();
  });
  root.querySelector('[data-audited-action="edit"]')?.addEventListener('click', () => openAuditedEditor(collection, record));
  root.querySelector('[data-audited-action="archive"]')?.addEventListener('click', () => {
    if (!confirm(`Archiver « ${title} » ? Vous pourrez le restaurer depuis les archives.`)) return;
    if (archiveDocumentRecord(collection, record)) { closeModal(); render(); if (returnToSiteId) showSite(returnToSiteId); notify('Document archivé.'); }
  });
  root.querySelector('[data-audited-action="restore"]')?.addEventListener('click', () => {
    if (archiveDocumentRecord(collection, record, { restore: true })) { closeModal(); render(); if (returnToSiteId) showSite(returnToSiteId); notify('Document restauré.'); }
  });
  root.querySelector('[data-audited-action="purge"]')?.addEventListener('click', () => {
    if (!confirm(`Supprimer définitivement « ${title} » ? Le contenu ne pourra pas être récupéré.`)) return;
    if (archiveDocumentRecord(collection, record, { permanent: true })) { closeModal(); render(); if (returnToSiteId) showSite(returnToSiteId); notify('Document supprimé définitivement. L’historique est conservé.'); }
  });
}
window.openAuditedDocumentRecord = openAuditedRecord;
function openAuditedEditor(collection, record) {
  const isReport = collection === 'reports';
  const type = isReport ? 'report-edit' : 'document-edit';
  const fields = `<input type="hidden" name="recordId" value="${esc(record.id)}">` + (isReport
    ? `<label>Type<select name="kind">${['Intervention électrique','Maintenance','Diagnostic GTB/GTC','Visite technique','Réserves'].map(kind => `<option ${record.kind === kind ? 'selected' : ''}>${kind}</option>`).join('')}</select></label><label>Titre<input name="title" required maxlength="160" value="${esc(record.title)}"></label><label>Chantier<select name="site" required>${siteOptions(record.siteId)}</select></label><label>Compte rendu<textarea name="body" required rows="6" maxlength="8000">${esc(record.body || '')}</textarea></label>`
    : `<label>Nom de la pièce<input name="name" required maxlength="160" value="${esc(record.name)}"></label><label>Chantier<select name="site" required>${siteOptions(record.siteId)}</select></label>${record.kind === 'photo' ? '' : '<label>Remplacer le fichier (facultatif, 700 Ko maximum)<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx,.xls,.xlsx"></label>'}`);
  moduleForm(type, isReport ? 'Modifier le compte rendu' : 'Modifier le document', fields);
  const form = document.querySelector(`[data-module-form="${type}"]`);
  if (form) form.dataset.recordId = record.id;
}

function simplePage() {
  if (page === 'carte') return mapPage();
  if (page === 'planning') return planningPage();
  if (page === 'assistant') return assistantPage();
  if (page === 'achats') return purchasesPage();
  if (page === 'finances') return financesPage();
  if (page === 'documents') return documentsPage();
  if (page === 'rapports') return reportsPage();
  if (page === 'parametres') return settingsPage();
  return `<section class="feature-placeholder"><h2>Écran indisponible</h2><p>Cette rubrique n’est pas configurée.</p></section>`;
}

function assistantPage() {
  const today = todayISO();
  const insights = [];
  const quotesToSend = (data.quotes || []).filter(item => item.status === 'À envoyer');
  if (quotesToSend.length) insights.push({ level: 'attention', title: `${quotesToSend.length} devis à relire ou envoyer`, detail: 'Vérifiez les prix, les coordonnées du client, les conditions et la TVA avant toute transmission.', page: 'devis', label: 'Ouvrir les devis' });
  const acceptedWithoutSite = (data.quotes || []).filter(quote => quote.status === 'Accepté' && !(data.sites || []).some(site => site.quoteId === quote.id || site.quoteReference === quote.reference || site.quoteId === quote.reference));
  if (acceptedWithoutSite.length) insights.push({ level: 'attention', title: `${acceptedWithoutSite.length} devis accepté(s) sans chantier lié`, detail: 'Vérifiez si un dossier chantier doit être créé. Les liens ne sont pas déduits des noms seuls.', page: 'devis', label: 'Vérifier les devis' });
  const overdueInvoices = (data.invoices || []).filter(invoice => invoice.dueDate && invoice.dueDate < today && Number(invoice.amountTTC || 0) > (data.payments || []).filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  if (overdueInvoices.length) insights.push({ level: 'urgent', title: `${overdueInvoices.length} échéance(s) de facture dépassée(s)`, detail: 'Contrôlez les règlements réellement reçus et relancez le client si nécessaire.', page: 'finances', label: 'Voir les finances' });
  const upcoming = (data.appointments || []).filter(item => item.date >= today && !['Terminée', 'Annulée'].includes(item.status)).sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)).slice(0, 3);
  if (upcoming.length) insights.push({ level: 'info', title: `${upcoming.length} prochaine(s) intervention(s) à préparer`, detail: upcoming.map(item => `${item.date}${item.time ? ` à ${item.time}` : ''} · ${item.title}`).join(' ; '), page: 'planning', label: 'Ouvrir le planning' });
  const budgetAlerts = (data.sites || []).filter(site => Number(site.budget) > 0 && Number(site.spent) / Number(site.budget) >= 0.85 && !['Terminé', 'Annulé'].includes(site.status));
  if (budgetAlerts.length) insights.push({ level: 'attention', title: `${budgetAlerts.length} chantier(s) proche(s) du budget indiqué`, detail: budgetAlerts.map(site => `${site.name} · ${Math.round(Number(site.spent) / Number(site.budget) * 100)} % consommé`).join(' ; ') + '. Données saisies localement, à rapprocher des coûts réels.', page: 'chantiers', label: 'Examiner les chantiers' });
  const unpriced = (data.pricebook || []).filter(item => item.unitPriceHT === null || item.unitPriceHT === '' || item.unitPriceHT === undefined);
  if (unpriced.length) insights.push({ level: 'info', title: `${unpriced.length} prestation(s) sans prix de vente HT`, detail: 'Complétez et vérifiez votre bibliothèque avant de réutiliser ces lignes dans un devis.', page: 'devis', label: 'Ouvrir la bibliothèque' });
  const noCoordinates = (data.sites || []).filter(site => !Number.isFinite(Number(site.latitude)) || !Number.isFinite(Number(site.longitude)) || site.latitude === '' || site.longitude === '');
  if (noCoordinates.length) insights.push({ level: 'info', title: `${noCoordinates.length} chantier(s) sans position GPS`, detail: 'Ajoutez des coordonnées vérifiées dans la fiche chantier pour les afficher sur la carte.', page: 'carte', label: 'Ouvrir la carte' });
  const rows = insights.length ? insights.map(item => `<article class="pilot-insight ${item.level}"><span class="pilot-insight-mark">${item.level === 'urgent' ? '!' : item.level === 'attention' ? '◇' : '✓'}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><a class="btn secondary" href="#${esc(item.page)}" data-page="${esc(item.page)}">${esc(item.label)} →</a></div></article>`).join('') : '<div class="empty-state">Aucun point à signaler dans les données actuellement disponibles.</div>';
  return `${heading('AIDE AU PILOTAGE', 'Assistant de pilotage', 'Une revue locale des points à vérifier dans vos dossiers.')}${localNotice}<section class="panel"><div class="pilot-ai-disclaimer"><span aria-hidden="true">✦</span><div><b>Analyse locale par règles de gestion</b><p>Cette aide n’utilise pas de modèle d’intelligence artificielle connecté. Les données restent sur cet appareil ; les remarques sont des contrôles indicatifs et doivent être vérifiées par vous.</p></div></div><div class="panel-head"><div><h2>Points à examiner</h2><p>${insights.length} signalement(s) à partir des informations présentes.</p></div><button class="btn secondary" data-module-action="refresh-assistant">Actualiser</button></div><div class="pilot-insight-list">${rows}</div></section><section class="panel pilot-transfer-panel"><div><h2>Continuer sur un autre appareil</h2><p>La synchronisation automatique entre téléphones n’est pas configurée. Exportez une copie dans Paramètres, transférez le fichier par un moyen sûr, puis restaurez-le sur l’autre appareil. Cette copie peut contenir des données personnelles.</p><a class="btn secondary" href="#parametres" data-page="parametres">Ouvrir les sauvegardes →</a></div></section>`;
}

function sitesWithCoordinates() {
  return (data.sites || []).filter(site => Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)) && site.latitude !== '' && site.longitude !== '' && Math.abs(Number(site.latitude)) <= 90 && Math.abs(Number(site.longitude)) <= 180);
}

function mapPage() {
  const located = sitesWithCoordinates();
  const missing = (data.sites || []).filter(site => !located.includes(site));
  const statuses = [...new Set(located.map(site => site.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const clients = [...new Set(located.map(site => site.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  return `${heading('SUIVI OPÉRATIONNEL', 'Carte des chantiers', 'Visualisez les chantiers géolocalisés et retrouvez les adresses avec Google Maps.')}${localNotice}<section class="panel map-panel"><div class="panel-head"><div><h2>${located.length} chantier(s) localisé(s)</h2><p>${data.sites.length - located.length} adresse(s) à localiser</p></div><button class="btn primary" data-map-action="load">Afficher la carte</button></div><p class="form-hint">Google Maps charge le fond de carte après votre autorisation. Les adresses saisies dans les formulaires sont envoyées à Google pour proposer des suggestions. La clé API doit être configurée et restreinte dans Paramètres.</p>${data.sites.length ? `<div class="map-filters"><label>Rechercher un chantier<input id="map-search" type="search" placeholder="Chantier, adresse ou client"></label><label>Statut<select id="map-filter-status"><option value="Tous">Tous les statuts</option>${statuses.map(status => `<option>${esc(status)}</option>`).join('')}</select></label><label>Client<select id="map-filter-client"><option value="Tous">Tous les clients</option>${clients.map(client => `<option>${esc(client)}</option>`).join('')}</select></label><span id="map-results-count" class="map-results-count">${located.length} chantier(s) localisé(s)</span></div>` : `<p class="empty-state">Ajoutez un chantier puis choisissez son adresse dans les suggestions Google pour le placer sur la carte.</p>`}<div id="site-map" class="site-map" aria-label="Carte Google Maps des chantiers" hidden></div>${missing.length ? `<section class="map-unlocated"><h3>Adresses à compléter</h3><p>Ouvrez un chantier et choisissez une suggestion Google pour enregistrer sa position exacte.</p>${missing.map(site => `<button class="btn secondary" data-site="${esc(site.id)}">${esc(site.name)} · ${esc(site.address || 'adresse à compléter')}</button>`).join('')}</section>` : ''}<small class="map-attribution">Google Maps · Conditions et confidentialité Google</small></section>`;
}

function filteredMapSites() {
  const status = $('#map-filter-status')?.value || 'Tous';
  const client = $('#map-filter-client')?.value || 'Tous';
  const query = ($('#map-search')?.value || '').trim().toLocaleLowerCase('fr');
  return sitesWithCoordinates().filter(site => (status === 'Tous' || site.status === status) && (client === 'Tous' || site.client === client) && (!query || `${site.name} ${site.client} ${site.address || ''} ${site.status || ''}`.toLocaleLowerCase('fr').includes(query)));
}

function loadGoogleMaps() {
  const key = String(data.settings?.googleMapsApiKey || '').trim();
  if (!key) return Promise.reject(new Error('Ajoutez d’abord votre clé Google Maps dans Paramètres.'));
  if (window.google?.maps?.importLibrary) return window.google.maps.importLibrary('maps');
  if (window.__sspGoogleMapsLoad) return window.__sspGoogleMapsLoad;
  window.__sspGoogleMapsLoad = new Promise((resolve, reject) => {
    window.gm_authFailure = () => reject(new Error('Google Maps a refusé la clé. Vérifiez la facturation, les API activées et les restrictions du site.'));
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps ne peut pas être chargé. Vérifiez la connexion et la clé API.'));
    script.onload = () => { if (window.google?.maps?.importLibrary) window.google.maps.importLibrary('maps').then(resolve).catch(reject); else reject(new Error('La bibliothèque Google Maps est indisponible.')); };
    document.head.append(script);
  });
  return window.__sspGoogleMapsLoad;
}

function showMapConsent() {
  modal('Charger Google Maps', `<div class="detail-card"><p>Google recevra la zone affichée sur la carte. Les adresses saisies dans le champ de recherche Google sont transmises à Google pour fournir les suggestions.</p><p class="form-hint">La carte nécessite une clé API Google Maps avec facturation et restrictions configurées dans Paramètres.</p><button class="btn primary full-btn" data-map-action="confirm-load">Autoriser et afficher</button><button class="btn secondary full-btn" data-map-action="cancel-load">Annuler</button></div>`);
}

async function initializeSiteMap() {
  const container = $('#site-map'); if (!container) return;
  let maps;
  try { maps = await loadGoogleMaps(); } catch (error) { return notify(error.message); }
  container.hidden = false;
  const sites = sitesWithCoordinates();
  const first = sites[0];
  const map = new maps.Map(container, { center: first ? { lat: Number(first.latitude), lng: Number(first.longitude) } : { lat: 46.6, lng: 2.4 }, zoom: first ? 9 : 6, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: 'cooperative' });
  window.__sspMap = map; window.__sspGoogleMarkers = [];
  refreshSiteMapMarkers();
  setTimeout(() => window.google?.maps?.event?.trigger(map, 'resize'), 150);
}

function refreshSiteMapMarkers({ fitView = false } = {}) {
  const map = window.__sspMap;
  const sites = filteredMapSites();
  const count = $('#map-results-count');
  if (count) count.textContent = `${sites.length} chantier(s) localisé(s)`;
  if (!map || !$('#site-map')) return;
  for (const marker of window.__sspGoogleMarkers || []) marker.setMap(null);
  window.__sspGoogleMarkers = [];
  if (!sites.length) return;
  if (fitView) {
    if (sites.length === 1) { map.setCenter({ lat: Number(sites[0].latitude), lng: Number(sites[0].longitude) }); map.setZoom(14); }
    else { const bounds = new google.maps.LatLngBounds(); sites.forEach(site => bounds.extend({ lat: Number(site.latitude), lng: Number(site.longitude) })); map.fitBounds(bounds, 48); }
  }
  const info = new google.maps.InfoWindow();
  for (const site of sites) {
    const pinColor = site.status === 'En cours' ? '#078b70' : site.status === 'Bloqué' ? '#dc6256' : site.status === 'Terminé' ? '#7b8990' : '#3867d6';
    const marker = new google.maps.Marker({ map, position: { lat: Number(site.latitude), lng: Number(site.longitude) }, title: `${site.name} · ${site.status || 'Chantier'}`, icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: pinColor, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 8 } });
    marker.addListener('click', () => {
      const upcoming = (data.appointments || []).filter(item => (item.siteId === site.id || item.site === site.name) && item.date >= todayISO() && !['Terminée','Annulée'].includes(item.status)).sort((a,b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`)).slice(0, 2);
      const next = upcoming.length ? `<br>Prochaine intervention : ${upcoming.map(item => `${esc(item.date)} · ${esc(item.title)}`).join('<br>')}` : '';
      info.setContent(`<b>${esc(site.name)}</b><br>${esc(site.status || 'Statut non renseigné')}<br>${esc(site.address || 'Adresse non renseignée')}${next}<br><a href="#chantiers" data-open-site="${esc(site.id)}">Ouvrir le dossier</a>`);
      info.open({ map, anchor: marker });
    });
    window.__sspGoogleMarkers.push(marker);
  }
}

function invoiceListRow(invoice) {
  const title = `${invoice.reference || 'Facture brouillon'} · ${invoice.client || 'Client à préciser'}`;
  return `<div class="quote-line invoice-list-row"><span class="doc-icon">${iconSvg('▤')}</span><span class="quote-name"><b>${esc(title)}</b><small>${esc(siteLabel(invoice))} · ${esc(invoice.invoiceDate || 'Date à préciser')} · ${money(invoice.amountHT)} HT</small></span><strong>${money(invoice.amountTTC)}</strong><div class="invoice-row-actions"><button class="btn secondary" data-invoice-action="open" data-id="${esc(invoice.id)}">Voir</button><button class="btn secondary" data-invoice-action="print" data-id="${esc(invoice.id)}">PDF</button></div></div>`;
}

function invoiceSource(invoice) {
  return invoice.quoteSnapshot || data.quotes.find(quote => quote.id === invoice.quoteId) || null;
}

function openInvoiceDetails(id) {
  const invoice = data.invoices.find(item => item.id === id); if (!invoice) return;
  const payments = (data.payments || []).filter(item => item.invoiceId === id);
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remaining = Math.max(0, Number(invoice.amountTTC || 0) - paid);
  const client = data.clients.find(item => item.name === invoice.client);
  modal(invoice.reference || 'Facture brouillon', `<div class="detail-card"><span class="pill neutral">${esc(invoice.status || 'Brouillon local')}</span><p><b>Client</b><br>${esc(invoice.client || 'À préciser')}${client?.email ? `<br>${esc(client.email)}` : ''}</p><p><b>Chantier</b><br>${esc(siteLabel(invoice))}</p><p><b>Date de facture</b><br>${esc(invoice.invoiceDate || 'Non précisée')}</p><p><b>Échéance</b><br>${esc(invoice.dueDate || 'Non précisée')}</p><p><b>Total HT / TTC indicatif</b><br>${money(invoice.amountHT)} HT · ${money(invoice.amountTTC)} TTC</p><p><b>Règlements saisis</b><br>${money(paid)} · reste indicatif ${money(remaining)}</p><p class="form-hint">Cette facture reste un brouillon local : l’application n’attribue pas de numéro comptable et ne vérifie pas les mentions légales. L’aperçu PDF porte clairement la mention brouillon.</p><button class="btn primary full-btn" data-invoice-action="print" data-id="${esc(id)}">Voir l’aperçu et enregistrer en PDF</button><button class="btn secondary full-btn" data-invoice-action="email" data-id="${esc(id)}">Préparer un e-mail au client</button>${remaining > 0 ? `<button class="btn secondary full-btn" data-invoice-action="payment" data-id="${esc(id)}">Saisir un règlement reçu</button>` : ''}${payments.length === 0 ? `<button class="btn danger full-btn" data-invoice-action="delete" data-id="${esc(id)}">Supprimer cette facture brouillon</button>` : '<p class="form-hint">Cette facture ne peut plus être supprimée car un règlement y est rattaché.</p>'}</div>`);
}

function openInvoicePrint(id) {
  const invoice = data.invoices.find(item => item.id === id); if (!invoice) return;
  const source = invoiceSource(invoice);
  const lines = source?.lines || [];
  const rows = lines.map(line => `<tr><td>${esc(line.description || '')}</td><td class="number">${Number(line.quantity || 0).toLocaleString('fr-FR')}</td><td>${esc(line.unit || 'unité')}</td><td class="number">${money((line.unitPriceHTCents ?? Math.round(Number(line.unitPriceHT || 0) * 100)) / 100)}</td><td class="number">${Number(line.vatRate ?? 0).toLocaleString('fr-FR')} %</td><td class="number">${money((line.totalHTCents ?? 0) / 100)}</td></tr>`).join('');
  const vatByRate = invoice.vatRates || source?.totals?.vatByRateCents || {};
  const vatRows = Object.entries(vatByRate).map(([rate, cents]) => `<div><span>TVA ${esc(String(rate).replace('.', ','))} %</span><b>${money(Number(cents) / 100)}</b></div>`).join('');
  const company = esc(data.settings?.companyName || 'Mon entreprise');
  const client = data.clients.find(item => item.name === invoice.client);
  const clientAddress = [client?.address, client?.postalCode, client?.city].filter(Boolean).map(esc).join(' · ');
  modal(`Aperçu de facture · ${invoice.reference || 'Brouillon'}`, `<div id="invoice-print-document" class="quote-print-document">
    <header><div><div class="brand">${company}</div><h1>Facture brouillon</h1><div class="muted">${esc(source?.title || invoice.site || 'Prestation liée au devis accepté')}</div></div><div class="muted"><b>Référence locale</b><br>${esc(invoice.reference || 'Non attribuée')}<br><b>Date</b> · ${esc(invoice.invoiceDate || 'non précisée')}<br><b>Échéance</b> · ${esc(invoice.dueDate || 'non précisée')}</div></header>
    <div class="draft">BROUILLON — NUMÉRO ET MENTIONS LÉGALES À VÉRIFIER AVANT TOUT ENVOI</div>
    <h2>Destinataire et chantier</h2><div class="muted"><b>Client :</b> ${esc(invoice.client || 'À préciser')}${clientAddress ? `<br>${clientAddress}` : ''}${client?.email ? `<br>${esc(client.email)}` : ''}<br><b>Chantier :</b> ${esc(siteLabel(invoice))}<br><b>Devis d’origine :</b> ${esc(source?.reference || invoice.quoteId || 'Non renseigné')}</div>
    ${rows ? `<table><thead><tr><th>Désignation</th><th class="number">Qté</th><th>Unité</th><th class="number">PU HT</th><th class="number">TVA</th><th class="number">Total HT</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="form-hint">Les lignes du devis d’origine sont introuvables. Vérifiez cette facture avant de l’utiliser.</p>'}
    <div class="totals"><div><span>Total HT</span><b>${money(invoice.amountHT)}</b></div>${vatRows}<div class="grand"><span>Total TTC indicatif</span><b>${money(invoice.amountTTC)}</b></div></div>
    <footer>Document préparé localement pour prévisualisation. Cette application ne vérifie pas les mentions légales, la numérotation comptable, la TVA applicable ni la conformité de la facture. Aucun envoi n’est effectué.</footer>
  </div><p class="form-hint print-help">Sur iPhone, utilisez Imprimer puis ouvrez le partage de l’aperçu pour enregistrer dans Fichiers ou l’envoyer. Pour un envoi par e-mail, joignez le PDF enregistré.</p><div class="form-actions print-controls"><button class="btn secondary" data-invoice-action="back" data-id="${esc(id)}">Retour</button><button class="btn primary" data-invoice-action="print-now">Imprimer / enregistrer en PDF</button></div>`);
}


function financesPage() {
  const paidFor = id => data.payments.filter(p => p.invoiceId === id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const receivable = data.invoices.reduce((sum, x) => sum + Math.max(0, Number(x.amountTTC || 0) - paidFor(x.id)), 0);
  const expenses = data.expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return `${heading('PILOTAGE FINANCIER', 'Finances', 'Consultez vos factures, exportez-les en PDF et suivez les règlements saisis.', `<button class="btn secondary" data-module-action="expense">＋ Dépense</button> <button class="btn primary" data-module-action="invoice">＋ Nouvelle facture</button>`)}${localNotice}<div class="metric-grid compact-metrics"><article class="metric-card"><div class="metric-label">Factures brouillon · TTC indicatif</div><strong>${money(data.invoices.reduce((s, x) => s + Number(x.amountTTC || 0), 0))}</strong><div class="metric-note">À vérifier avant toute utilisation</div></article><article class="metric-card"><div class="metric-label">À encaisser · selon saisies</div><strong>${money(receivable)}</strong><div class="metric-note">Pas un solde bancaire réel</div></article><article class="metric-card"><div class="metric-label">Dépenses saisies</div><strong>${money(expenses)}</strong><div class="metric-note">Engagées ou payées selon votre saisie</div></article></div><section class="panel"><div class="panel-head"><div><h2>Factures</h2><p>Ouvrez une facture pour la visualiser, l’imprimer en PDF ou saisir un règlement.</p></div></div>${moduleList(data.invoices.map(invoiceListRow), 'Aucune facture. Créez-en une à partir d’un devis accepté.')}</section><section class="panel list-panel"><div class="panel-head"><div><h2>Dépenses</h2><p>Une facture fournisseur n’est pas un paiement confirmé.</p></div></div>${moduleList(data.expenses.map(x => moduleRow('◒', x.label, `${siteLabel(x)} · ${x.date} · ${x.status}`, `<strong>${money(x.amount)}</strong>`, x.id)), 'Aucune dépense saisie.')}</section><section class="panel list-panel"><div class="panel-head"><div><h2>Règlements saisis</h2><p>À rapprocher avec les justificatifs bancaires.</p></div></div>${moduleList(data.payments.map(x => moduleRow('€', x.invoiceRef, `${x.date} · ${x.method}`, `<strong>${money(x.amount)}</strong>`, x.id)), 'Aucun règlement saisi.')}</section>`;
}

function documentsPage() {
  const active = documentsView === 'active';
  const archived = documentsView === 'archived';
  const rows = (data.documents || []).filter(item => !!item.archivedAt === archived).map(item => {
    const subtitle = `${siteLabel(item)} · ${item.date || ''} · ${item.fileName || 'Photo'} · ${Math.ceil(Number(item.size || 0) / 1024)} Ko${item.archivedAt ? ` · Archivé ${new Date(item.archivedAt).toLocaleDateString('fr-FR')}` : ''}`;
    return auditedModuleRow(item.kind === 'photo' ? '▧' : '▱', item.name, subtitle, item.id);
  });
  const auditRows = (data.auditLogs || []).slice(0, 100).map(entry => `<li class="document-audit-row"><b>${esc(ACTIVITY_LABELS[entry.collection] || entry.collection || 'Élément')} · ${esc(entry.recordName)}</b><span>${esc(entry.action)}</span><small>${esc(entry.actorName || 'Compte local non identifié')}${entry.actorUsername ? ` (@${esc(entry.actorUsername)})` : ''} · ${esc(new Date(entry.occurredAt).toLocaleString('fr-FR'))}</small></li>`).join('');
  const tabs = `<div class="document-tabs" role="tablist" aria-label="Affichage des documents"><button role="tab" aria-selected="${active}" data-document-view="active">Actifs <span>${(data.documents || []).filter(item => !item.archivedAt).length}</span></button><button role="tab" aria-selected="${archived}" data-document-view="archived">Archives <span>${(data.documents || []).filter(item => item.archivedAt).length}</span></button><button role="tab" aria-selected="${documentsView === 'history'}" data-document-view="history">Historique</button></div>`;
  const content = documentsView === 'history' ? `<section class="panel"><div class="panel-head"><div><h2>Qui a fait quoi ?</h2><p>Les 100 dernières actions s’affichent ici ; jusqu’à 2 000 événements sont conservés sur cet appareil.</p></div></div><ol class="document-audit-list">${auditRows || '<li class="empty-state">Aucune action depuis l’activation de l’historique.</li>'}</ol></section>` : `<section class="panel"><div class="panel-head"><div><h2>${active ? 'Documents disponibles' : 'Documents archivés'}</h2><p>${archived ? 'Restaurez un élément ou supprimez-le définitivement.' : 'Ouvrez une pièce pour la télécharger, la modifier ou l’archiver.'}</p></div><span class="pill neutral">${rows.length} élément(s)</span></div>${moduleList(rows, archived ? 'Aucun élément dans les archives.' : 'Aucun document ajouté.')}</section>`;
  return `${heading('DOSSIERS', 'Documents', 'Retrouvez les pièces par chantier, consultez leur historique et gérez les archives.', active ? `<button class="btn primary" data-module-action="document">＋ Ajouter un document</button>` : '')}${localNotice}<div class="notice"><span class="notice-icon">ⓘ</span><span>Fichiers et photos restent sur cet appareil (700 Ko maximum pour les pièces jointes). Les profils locaux indiquent le compte utilisé, sans identité vérifiée par un serveur.</span></div>${tabs}${content}`;
}

function reportsPage() {
  const archived = documentsView === 'archived';
  const rows = (data.reports || []).filter(item => !!item.archivedAt === archived).map(item => auditedModuleRow('⌁', item.title, `${siteLabel(item)} · ${item.date} · ${item.kind} · brouillon local${item.archivedAt ? ' · Archivé' : ''}`, item.id));
  const auditRows = (data.auditLogs || []).slice(0, 100).map(entry => `<li class="document-audit-row"><b>${esc(ACTIVITY_LABELS[entry.collection] || entry.collection || 'Élément')} · ${esc(entry.recordName)}</b><span>${esc(entry.action)}</span><small>${esc(entry.actorName || 'Compte local non identifié')}${entry.actorUsername ? ` (@${esc(entry.actorUsername)})` : ''} · ${esc(new Date(entry.occurredAt).toLocaleString('fr-FR'))}</small></li>`).join('');
  const tabs = `<div class="document-tabs" role="tablist" aria-label="Affichage des rapports"><button role="tab" aria-selected="${!archived && documentsView !== 'history'}" data-document-view="active">Actifs <span>${(data.reports || []).filter(item => !item.archivedAt).length}</span></button><button role="tab" aria-selected="${archived}" data-document-view="archived">Archives <span>${(data.reports || []).filter(item => item.archivedAt).length}</span></button><button role="tab" aria-selected="${documentsView === 'history'}" data-document-view="history">Historique</button></div>`;
  const content = documentsView === 'history' ? `<section class="panel"><div class="panel-head"><div><h2>Qui a fait quoi ?</h2><p>Les 100 dernières actions s’affichent ici ; jusqu’à 2 000 événements sont conservés sur cet appareil.</p></div></div><ol class="document-audit-list">${auditRows || '<li class="empty-state">Aucune action depuis l’activation de l’historique.</li>'}</ol></section>` : `<section class="panel"><div class="panel-head"><div><h2>${archived ? 'Rapports archivés' : 'Rapports disponibles'}</h2><p>${archived ? 'Restaurez un rapport ou supprimez-le définitivement.' : 'Ouvrez un rapport pour le modifier ou l’archiver.'}</p></div><span class="pill neutral">${rows.length} rapport(s)</span></div>${moduleList(rows, archived ? 'Aucun rapport dans les archives.' : 'Aucun rapport rédigé.')}</section>`;
  return `${heading('QUALITÉ & SUIVI', 'Rapports', 'Rédigez et retrouvez les comptes rendus liés aux chantiers.', !archived && documentsView !== 'history' ? `<button class="btn primary" data-module-action="report">＋ Nouveau rapport</button>` : '')}${localNotice}${tabs}${content}`;
}

function localReminderItems() {
  const today = todayISO();
  const horizon = new Date(`${today}T12:00:00`); horizon.setDate(horizon.getDate() + 7);
  const through = SSPDomain.localDateISO(horizon);
  const items = [];
  for (const followup of data.followups || []) {
    if (followup.status === 'Terminée' || !followup.dueDate || followup.dueDate > through) continue;
    const prospect = data.prospects.find(item => item.id === followup.entityId);
    items.push({ date: followup.dueDate, kind: 'Relance', title: followup.title || `Relancer ${prospect?.name || 'le prospect'}`, detail: followup.note || prospect?.name || 'Prospect', overdue: followup.dueDate < today });
  }
  for (const task of data.tasks || []) {
    if (task.status === 'Terminée' || !task.dueDate || task.dueDate > through) continue;
    items.push({ date: task.dueDate, kind: 'Tâche chantier', title: task.title, detail: `${siteLabel(task)}${task.assignee ? ` · ${task.assignee}` : ''}`, overdue: task.dueDate < today });
  }
  for (const appointment of data.appointments || []) {
    if (['Terminée', 'Annulée'].includes(appointment.status) || !appointment.date || appointment.date < today || appointment.date > through) continue;
    items.push({ date: appointment.date, kind: 'Intervention', title: appointment.title, detail: `${appointment.time || 'Heure à préciser'} · ${siteLabel(appointment)}`, overdue: false });
  }
  for (const invoice of data.invoices || []) {
    if (!invoice.dueDate || invoice.dueDate > today) continue;
    const paid = (data.payments || []).filter(item => item.invoiceId === invoice.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balance = Number(invoice.amountTTC || 0) - paid;
    if (balance > 0) items.push({ date: invoice.dueDate, kind: 'Échéance de facture', title: invoice.reference || 'Facture brouillon', detail: `${invoice.client} · reste indicatif ${money(balance)}`, overdue: true });
  }
  for (const purchase of data.purchases || []) {
    if (!purchase.delivery || purchase.delivery < today || purchase.delivery > through || ['Reçue', 'Annulée'].includes(purchase.status)) continue;
    items.push({ date: purchase.delivery, kind: 'Livraison attendue', title: purchase.reference || `Commande ${purchase.supplier}`, detail: `${purchase.supplier} · ${siteLabel(purchase)}`, overdue: false });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'));
}

function openLocalReminders() {
  const items = localReminderItems();
  const rows = items.map(item => `<article class="local-reminder ${item.overdue ? 'is-overdue' : ''}"><span class="local-reminder-date">${esc(item.date)}${item.overdue ? ' · En retard' : ''}</span><b>${esc(item.title)}</b><small>${esc(item.kind)} · ${esc(item.detail)}</small></article>`).join('');
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  const state = !supported ? 'Les notifications système ne sont pas disponibles dans ce navigateur.' : Notification.permission === 'denied' ? 'Les notifications sont bloquées dans les réglages du navigateur.' : data.settings.browserReminders && Notification.permission === 'granted' ? 'Notifications activées : rappels du jour lorsque l’application est ouverte.' : 'Les rappels restent dans l’application tant que vous ne les activez pas.';
  const button = supported && Notification.permission !== 'denied' ? `<button class="btn ${data.settings.browserReminders ? 'secondary' : 'primary'} full-btn" data-module-action="toggle-browser-notifications">${data.settings.browserReminders ? 'Désactiver les notifications locales' : 'Activer les notifications locales'}</button>` : '';
  modal('Rappels locaux', `<div class="detail-card"><p class="form-hint">Échéances de cet appareil, jusqu’aux 7 prochains jours. ${esc(state)} Les notifications ne sont pas garanties en arrière-plan et aucun e-mail ou SMS n’est envoyé.</p>${button}${rows || '<div class="empty-state">Aucun rappel à venir ou en retard.</div>'}</div>`);
}

async function toggleBrowserReminders() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return notify('Les notifications système ne sont pas prises en charge ici.');
  if (data.settings.browserReminders) {
    data.settings.browserReminders = false;
    if (save()) { openLocalReminders(); notify('Notifications locales désactivées.'); }
    return;
  }
  if (Notification.permission === 'denied') return notify('Autorisez les notifications dans les réglages du navigateur.');
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return notify('Aucune notification ne sera affichée sans autorisation.');
  data.settings.browserReminders = true;
  if (!save()) { data.settings.browserReminders = false; return; }
  openLocalReminders(); notify('Notifications locales activées pour les rappels du jour.');
  dispatchDueBrowserNotifications();
}

function dispatchDueBrowserNotifications() {
  if (!data.settings.browserReminders || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const today = todayISO();
  const due = localReminderItems().filter(item => item.date <= today);
  const marks = new Set(data.reminderNotificationMarks || []);
  navigator.serviceWorker.ready.then(registration => {
    let sent = false;
    for (const item of due) {
      const mark = `${item.kind}|${item.title}|${item.date}`;
      if (marks.has(mark)) continue;
      registration.showNotification('Smart syst’m Pilot — rappel', { body: `${item.kind} à consulter dans votre espace.`, tag: `ssp-${encodeURIComponent(mark)}`, data: { url: './index.html#accueil' } });
      marks.add(mark); sent = true;
    }
    if (sent) { data.reminderNotificationMarks = [...marks].slice(-200); save(); }
  }).catch(() => {});
}

window.addEventListener('storage', event => {
  if (event.key !== 'ssp-data') return;
  if (!event.newValue) { location.reload(); return; }
  try {
    const latest = JSON.parse(event.newValue);
    if (!latest || !Array.isArray(latest.clients) || !Array.isArray(latest.sites)) return;
    data = { ...localModulesDefault, ...latest, settings: { ...localModulesDefault.settings, ...(latest.settings || {}) } };
    applyBrandSettings(); render(); notify('Données actualisées depuis un autre onglet de ce navigateur.');
  } catch { /* Ignore les données partielles ou mal formées. */ }
});

if (document.visibilityState === 'visible') setTimeout(dispatchDueBrowserNotifications, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') dispatchDueBrowserNotifications(); });
setInterval(() => { if (document.visibilityState === 'visible') dispatchDueBrowserNotifications(); }, 15 * 60 * 1000);

function settingsPage() {
  let priorRestore = null; try { priorRestore = localStorage.getItem('ssp-pre-restore-backup-v1'); } catch { /* Le stockage local peut être indisponible. */ }
  return `${heading('VOTRE ESPACE', 'Paramètres', 'Personnalisez les informations locales de l’entreprise.')} ${localNotice}<section class="panel settings-form"><form data-module-form="settings"><label>Nom de l’application<input name="appName" required maxlength="80" value="${esc(data.settings.appName)}"></label><label>Nom de l’entreprise<input name="companyName" required maxlength="120" value="${esc(data.settings.companyName)}"></label><div class="form-row"><label>Pays de référence<select name="country"><option value="FR" ${data.settings.country === 'FR' ? 'selected' : ''}>France</option><option value="CH" ${data.settings.country === 'CH' ? 'selected' : ''}>Suisse</option></select></label><label>Devise par défaut<select name="currency"><option value="EUR" ${data.settings.currency === 'EUR' ? 'selected' : ''}>EUR · Euro</option><option value="CHF" ${data.settings.currency === 'CHF' ? 'selected' : ''}>CHF · Franc suisse</option></select></label></div><label>Clé API Google Maps<input name="googleMapsApiKey" type="password" autocomplete="off" value="${esc(data.settings.googleMapsApiKey || '')}" placeholder="Collez votre clé API restreinte"></label><p class="form-hint">N’ajoutez ici qu’une clé limitée à Google Maps JavaScript API et Places API, avec restriction HTTP au domaine zargo69.github.io. Cette clé est enregistrée dans ce navigateur et devient visible dans le code chargé par celui-ci. La facturation Google doit être activée. Ne mettez pas une clé non restreinte dans ce champ.</p><p class="form-hint">Les règles fiscales ne sont pas calculées automatiquement par ce réglage.</p><button class="btn primary">Enregistrer</button></form></section><section class="panel"><div class="panel-head"><div><h2>Copie de sauvegarde locale</h2><p>Exportez puis restaurez une copie JSON de ce navigateur.</p></div><button class="btn secondary" data-module-action="export">Exporter mes données</button></div><label class="import-label">Restaurer une copie<input id="import-file" type="file" accept="application/json,.json"></label><p class="form-hint">Avant de remplacer les données, l’application conserve automatiquement une copie locale de l’état actuel. Téléchargez-la ci-dessous si vous voulez garder un fichier externe.</p>${priorRestore ? '<button class="btn secondary" data-module-action="export-restore-backup">Télécharger la copie précédant la restauration</button>' : ''}<p class="form-hint">Le fichier peut contenir des coordonnées personnelles ; conservez-le dans un endroit sûr.</p><button class="btn danger" data-module-action="clear">Effacer les données locales</button></section>`;
}

function moduleForm(type, title, content) {
  modal(title, `<form data-module-form="${type}">${content}<div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer sur cet appareil</button></div></form>`);
  $('.cancel').onclick = closeModal;
}

function purchaseLineTemplate() {
  const unitChoices = ['unité', 'm', 'kg', 'lot', 'heure'];
  const options = data.stockItems.filter(item => unitChoices.includes(item.unit)).map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.unit)}</option>`).join('');
  return `<div class="purchase-order-line"><label>Article<input name="lineDescription" required maxlength="160" placeholder="Ex. Disjoncteur 20 A"></label><div class="form-row"><label>Quantité<input name="lineQuantity" required type="number" min="0.001" step="0.001" value="1"></label><label>Unité<select name="lineUnit"><option>unité</option><option>m</option><option>kg</option><option>lot</option><option>heure</option></select></label></div><label>Associer au catalogue de stock<select name="lineStockItemId"><option value="">Non suivi en stock</option>${options}</select></label><div class="form-row"><label>Prix unitaire HT (€)<input name="lineUnitPriceHT" required type="number" min="0" step="0.01" value="0"></label><label>TVA indicative<select name="lineVatRate"><option value="20">20 %</option><option value="10">10 %</option><option value="5.5">5,5 %</option><option value="0">0 %</option><option value="8.1">8,1 % · CH</option><option value="2.6">2,6 % · CH</option></select></label></div><button type="button" class="btn danger purchase-remove-line" data-purchase-line-remove>Retirer cette ligne</button></div>`;
}

function wirePurchaseOrderForm() {
  const form = document.querySelector('[data-module-form="purchase"]');
  const lines = form?.querySelector('#purchase-order-lines');
  if (!form || !lines) return;
  const filterStockOptions = row => {
    const unit = row.querySelector('[name="lineUnit"]')?.value;
    const stockSelect = row.querySelector('[name="lineStockItemId"]');
    [...(stockSelect?.options || [])].forEach(option => {
      const item = data.stockItems.find(candidate => candidate.id === option.value);
      if (item) option.hidden = item.unit !== unit;
    });
    const selectedItem = data.stockItems.find(item => item.id === stockSelect?.value);
    if (selectedItem && selectedItem.unit !== unit) stockSelect.value = '';
  };
  [...lines.querySelectorAll('.purchase-order-line')].forEach(filterStockOptions);
  const update = () => {
    const cents = [...lines.querySelectorAll('.purchase-order-line')].reduce((sum, row) => {
      const qty = Number(row.querySelector('[name="lineQuantity"]')?.value);
      const price = Number(row.querySelector('[name="lineUnitPriceHT"]')?.value);
      return sum + (Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0 ? Math.round(qty * Math.round(price * 100)) : 0);
    }, 0);
    const total = form.querySelector('[data-purchase-total]');
    if (total) total.textContent = money(cents / 100);
  };
  form.querySelector('[data-purchase-line-add]')?.addEventListener('click', () => {
    lines.insertAdjacentHTML('beforeend', purchaseLineTemplate());
    filterStockOptions(lines.lastElementChild);
    update();
  });
  lines.addEventListener('change', event => {
    if (!event.target.matches('[name="lineUnit"]')) return;
    const row = event.target.closest('.purchase-order-line');
    const stockSelect = row?.querySelector('[name="lineStockItemId"]');
    const selected = data.stockItems.find(item => item.id === stockSelect?.value);
    if (selected && selected.unit !== event.target.value) {
      stockSelect.value = '';
      notify('L’association au stock a été retirée : les unités ne correspondent plus.');
    }
    filterStockOptions(row);
  });
  lines.addEventListener('click', event => {
    if (!event.target.closest('[data-purchase-line-remove]')) return;
    if (lines.querySelectorAll('.purchase-order-line').length <= 1) return notify('Une commande doit garder au moins une ligne.');
    event.target.closest('.purchase-order-line').remove(); update();
  });
  lines.addEventListener('input', update); update();
}

function purchaseReceivedSummary(purchase) {
  const lines = Array.isArray(purchase.lines) ? purchase.lines : [];
  const ordered = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const received = lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0);
  return { lines, ordered, received, remaining: lines.some(line => Number(line.quantity || 0) - Number(line.receivedQuantity || 0) > 0.0005) };
}

function openPurchaseDetails(id) {
  const purchase = data.purchases.find(item => item.id === id);
  if (!purchase) return;
  const { lines, ordered, received, remaining } = purchaseReceivedSummary(purchase);
  const rows = lines.map(line => { const stockItem = data.stockItems.find(item => item.id === line.stockItemId); return `<div class="purchase-detail-line"><span><b>${esc(line.description)}</b><small>${Number(line.receivedQuantity || 0)} / ${Number(line.quantity || 0)} ${esc(line.unit || 'unité')} reçue(s) · ${money(line.unitPriceHT || 0)} HT / unité · ${stockItem ? `stock : ${esc(stockItem.name)}` : 'hors catalogue de stock'}</small></span><strong>${money(Number(line.quantity || 0) * Number(line.unitPriceHT || 0))}</strong></div>`; }).join('');
  const controls = `<div class="form-actions">${purchase.status === 'À valider' ? `<button class="btn primary" data-purchase-status="Commandée" data-id="${esc(id)}">Marquer commandée</button>` : ''}${['Commandée','Partiellement reçue'].includes(purchase.status) && remaining ? `<button class="btn primary" data-purchase-receive="${esc(id)}">Enregistrer une réception</button>` : ''}${!received && purchase.status !== 'Annulée' ? `<button class="btn danger" data-purchase-status="Annulée" data-id="${esc(id)}">Annuler la commande</button>` : ''}${!received ? `<button class="btn danger" data-purchase-delete="${esc(id)}">Supprimer la commande</button>` : ''}</div>`;
  modal(`Commande ${purchase.reference}`, `<div class="detail-card"><p><b>Fournisseur</b><br>${esc(purchase.supplier)}</p><p><b>Chantier</b><br>${esc(siteLabel(purchase))}</p><p><b>Livraison prévue</b><br>${esc(purchase.delivery || 'Non renseignée')} · <span class="pill neutral">${esc(purchase.status)}</span></p>${rows ? `<div class="purchase-detail-lines"><div class="purchase-detail-head"><b>Articles</b><b>Total ligne HT</b></div>${rows}</div>` : '<p class="form-hint">Cette commande ancienne n’a pas de lignes détaillées. Son montant historique est conservé, mais les quantités ne peuvent pas être réceptionnées ligne par ligne.</p>'}<div class="purchase-total-row"><span>Montant HT indicatif</span><b>${money(purchase.amountHT || 0)}</b></div>${lines.length ? `<p class="form-hint">Quantité totale réceptionnée : ${received} / ${ordered} unités. La TVA, la facture fournisseur et le règlement restent à contrôler séparément.</p>` : ''}${controls}</div>`);
}

function openPurchaseReceiptForm(id) {
  const purchase = data.purchases.find(item => item.id === id);
  if (!purchase || !['Commandée','Partiellement reçue'].includes(purchase.status)) return;
  const { lines, remaining } = purchaseReceivedSummary(purchase);
  if (!lines.length) return notify('Ajoutez des lignes détaillées pour enregistrer une réception.');
  if (!remaining) return notify('Toutes les quantités de cette commande sont déjà réceptionnées.');
  const fields = lines.map((line, index) => {
    const outstanding = Math.max(0, Number(line.quantity || 0) - Number(line.receivedQuantity || 0));
    return `<div class="purchase-receipt-line"><span><b>${esc(line.description)}</b><small>Reste à recevoir : ${outstanding} ${esc(line.unit || 'unité')}</small></span><label>Reçu maintenant<input name="received-${index}" type="number" min="0" max="${outstanding}" step="0.001" value="0" data-receipt-index="${index}"></label></div>`;
  }).join('');
  modal(`Réception · ${purchase.reference}`, `<form data-purchase-receipt-form data-id="${esc(id)}"><p class="form-hint">Saisissez uniquement les quantités présentes et contrôlées sur cette livraison. Les reliquats restent ouverts.</p>${fields}<label>Note de réception<input name="receiptNote" maxlength="300" placeholder="Article manquant, colis abîmé…"></label><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la réception</button></div></form>`);
  $('.cancel').onclick = closeModal;
}

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-purchase-receipt-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const purchase = data.purchases.find(item => item.id === form.dataset.id);
  if (!purchase) return notify('Cette commande n’existe plus.');
  const { lines } = purchaseReceivedSummary(purchase);
  const values = lines.map((line, index) => Number(form.elements[`received-${index}`]?.value || 0));
  if (values.some((qty, index) => !Number.isFinite(qty) || qty < 0 || qty - (Number(lines[index].quantity || 0) - Number(lines[index].receivedQuantity || 0)) > 0.0005)) return notify('Une quantité dépasse le reliquat de sa ligne. Vérifiez la réception.');
  if (!values.some(qty => qty > 0)) return notify('Saisissez au moins une quantité réceptionnée.');
  const receiptId = newId();
  data.stockMovements ||= [];
  const receiptMovements = [];
  values.forEach((quantity, index) => {
    const line = lines[index];
    const item = data.stockItems.find(stockItem => stockItem.id === line.stockItemId);
    if (!quantity || !item) return;
    if (item.unit !== line.unit) return;
    const sourceKey = `${purchase.id}:${receiptId}:${index}`;
    if (data.stockMovements.some(movement => movement.sourceKey === sourceKey)) return;
    const unitCostHT = Math.round(Number(line.unitPriceHT || 0) * 100) / 100;
    receiptMovements.push({ id: newId(), itemId: item.id, kind: 'entrée', quantity, unit: item.unit, unitCostHT, totalCostHT: Math.round(quantity * unitCostHT * 100) / 100, siteId: purchase.siteId || '', site: purchase.site || '', date: todayISO(), note: `Réception ${purchase.reference}`, source: 'purchase-receipt', sourceKey, purchaseId: purchase.id, receiptId, purchaseLineIndex: index, createdAt: new Date().toISOString() });
  });
  values.forEach((qty, index) => { lines[index].receivedQuantity = Math.round((Number(lines[index].receivedQuantity || 0) + qty) * 1000) / 1000; });
  const { remaining } = purchaseReceivedSummary(purchase);
  purchase.status = remaining ? 'Partiellement reçue' : 'Reçue';
  purchase.receipts = [...(purchase.receipts || []), { id: receiptId, date: todayISO(), note: String(new FormData(form).get('receiptNote') || '').trim(), lines: values.map((quantity, index) => ({ description: lines[index].description, quantity })).filter(line => line.quantity > 0) }];
  data.stockMovements.unshift(...receiptMovements);
  if (!save()) return;
  closeModal(); render(); notify(remaining ? 'Réception partielle enregistrée ; reliquat conservé.' : 'Toutes les lignes sont réceptionnées.');
}, true);

function openModuleForm(type, selectedId = '') {
  if (type === 'appointment' && !data.sites.length) return notify('Créez d’abord un chantier : l’intervention devra y être rattachée.');
  const date = type === 'appointment' ? planningAnchor : todayISO();
  const commonSite = `<label>Chantier<select name="site" required>${siteOptions(type === 'appointment' ? planningSiteFilter : '')}</select></label>`;
  if (type === 'appointment') moduleForm(type, 'Nouvelle intervention', `<label>Objet<input name="title" required maxlength="140" placeholder="Ex. Diagnostic panne tableau"></label>${commonSite}<div class="form-row"><label>Date<input type="date" name="date" required value="${date}"></label><label>Heure<input type="time" name="time" required value="09:00"></label></div><div class="form-row"><label>Durée (minutes)<input type="number" name="duration" required min="15" step="15" value="60"></label><label>Intervenant<input name="assignee" required value="Dirigeant"></label></div><label>Note<input name="note" maxlength="300" placeholder="Accès, matériel à prévoir…"></label>`);
  if (type === 'supplier') moduleForm(type, 'Nouveau fournisseur', `<label>Nom<input name="name" required maxlength="160"></label><div class="form-row"><label>E-mail<input name="email" type="email"></label><label>Téléphone<input name="phone" type="tel"></label></div><label>Conditions / délai habituel<input name="terms" maxlength="200"></label>`);
  if (type === 'purchase') {
    if (!data.suppliers.length) return notify('Ajoutez d’abord un fournisseur avant de créer une commande.');
    moduleForm(type, 'Nouvelle commande', `<label>Référence de commande<input name="reference" required maxlength="80" value="ACH-${new Date().getFullYear()}-${String(data.purchases.length + 1).padStart(3, '0')}"></label><label>Fournisseur<select name="supplier" required>${supplierOptions()}</select></label>${commonSite}<div class="form-row"><label>Date de commande<input name="date" type="date" value="${todayISO()}" required></label><label>Livraison prévue<input name="delivery" type="date"></label></div><label>État initial<select name="status"><option>À valider</option><option>Commandée</option></select></label><div class="purchase-lines-heading"><b>Lignes de commande</b><button type="button" class="btn secondary" data-purchase-line-add>＋ Ajouter un article</button></div><div id="purchase-order-lines">${purchaseLineTemplate()}</div><div class="purchase-total-row"><span>Total HT indicatif</span><b data-purchase-total>0,00 €</b></div><p class="form-hint">Les taux de TVA sont indicatifs. Cette saisie ne crée pas de facture fournisseur et ne confirme aucun paiement.</p>`);
    wirePurchaseOrderForm();
  }
  if (type === 'invoice') {
    const accepted = data.quotes.filter(q => q.status === 'Accepté');
    if (!accepted.length) return notify('Marquez d’abord un devis comme accepté dans la rubrique Devis.');
    moduleForm(type, 'Nouvelle facture brouillon', `<label>Devis accepté<select name="quoteId" required>${accepted.map(q => `<option value="${esc(q.id)}">${esc(q.reference || q.id)} · ${esc(q.title)} · ${esc(q.client)}</option>`).join('')}</select></label><div class="form-row"><label>Date de facture<input name="invoiceDate" type="date" required value="${todayISO()}"></label><label>Échéance<input name="dueDate" type="date"></label></div><p class="form-hint">Les lignes et montants sont repris du devis et conservés dans une copie. La facture restera un brouillon local non numéroté ; vérifiez les mentions légales avant toute utilisation.</p>`);
  }
  if (type === 'payment') {
    const invoice = data.invoices.find(x => x.id === selectedId);
    if (!invoice) return;
    const already = data.payments.filter(x => x.invoiceId === invoice.id).reduce((s, x) => s + Number(x.amount || 0), 0);
    const remaining = Math.max(0, Number(invoice.amountTTC) - already);
    moduleForm(type, 'Saisir un règlement reçu', `<p class="form-hint">${esc(invoice.reference)} · reste indiqué ${money(remaining)}. Inscrivez uniquement un paiement réellement reçu.</p><label>Montant reçu (€)<input name="amount" required type="number" min="0.01" max="${remaining.toFixed(2)}" step="0.01"></label><div class="form-row"><label>Date<input name="date" type="date" required value="${date}"></label><label>Mode<select name="method"><option>Virement</option><option>Carte</option><option>Chèque</option><option>Espèces</option><option>Autre</option></select></label></div>`);
  }
  if (type === 'expense') moduleForm(type, 'Nouvelle dépense', `<label>Libellé<input name="label" required maxlength="160"></label>${commonSite}<div class="form-row"><label>Montant (€)<input name="amount" required type="number" min="0.01" step="0.01"></label><label>Date<input name="date" type="date" required value="${date}"></label></div><label>État<select name="status"><option>Engagée — non payée</option><option>Payée — règlement confirmé</option></select></label>`);
  if (type === 'document') moduleForm(type, 'Ajouter un document local', `<label>Nom de la pièce<input name="name" required maxlength="160"></label>${commonSite}<label>Fichier (700 Ko maximum)<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx,.xls,.xlsx"></label><p class="form-hint">Ce fichier sera gardé dans le stockage local du navigateur. Faites un export de données pour en conserver une copie ailleurs.</p>`);
  if (type === 'report') moduleForm(type, 'Nouveau compte rendu', `<label>Type<select name="kind"><option>Intervention électrique</option><option>Maintenance</option><option>Diagnostic GTB/GTC</option><option>Visite technique</option><option>Réserves</option></select></label><label>Titre<input name="title" required maxlength="160"></label>${commonSite}<label>Compte rendu<textarea name="body" required rows="6" maxlength="8000" placeholder="Travaux effectués, mesures relevées, réserves et suite à donner…"></textarea></label><p class="form-hint">Enregistré en brouillon à relire. Aucun rapport certifiant la conformité n’est généré.</p>`);
}

function storeModuleForm(form, fileData = null) {
  const type = form.dataset.moduleForm;
  const values = Object.fromEntries(new FormData(form));
  const previousMapsKey = String(data.settings?.googleMapsApiKey || '').trim();
  if (type === 'settings') {
    data.settings = { ...data.settings, appName: values.appName.trim(), companyName: values.companyName.trim(), country: values.country, currency: values.currency, googleMapsApiKey: String(values.googleMapsApiKey || '').trim() };
    window.__sspGoogleMapsLoad = null;
    applyBrandSettings();
  }
  if (type === 'supplier') {
    if (data.suppliers.some(x => x.name.trim().toLocaleLowerCase('fr') === values.name.trim().toLocaleLowerCase('fr'))) return notify('Un fournisseur portant ce nom existe déjà.');
    data.suppliers.unshift({ id: newId(), name: values.name.trim(), email: values.email, phone: values.phone, terms: values.terms });
  }
  if (type === 'appointment') {
    const linkedSite = siteFromValue(values.site);
    if (!linkedSite) return notify('Choisissez un chantier existant.');
    const start = values.date + 'T' + values.time;
    const end = Date.parse(start) + Number(values.duration) * 60000;
    const conflict = data.appointments.find(x => x.date === values.date && String(x.assignee || '').toLocaleLowerCase() === values.assignee.trim().toLocaleLowerCase() && Date.parse(x.date + 'T' + x.time) < end && Date.parse(x.date + 'T' + x.time) + Number(x.duration || 60) * 60000 > Date.parse(start));
    if (conflict) return notify(`Conflit avec « ${conflict.title} » pour ${values.assignee}. Choisissez un autre horaire.`);
    data.appointments.unshift({ id: newId(), title: values.title.trim(), siteId: linkedSite.id, site: linkedSite.name, date: values.date, time: values.time, duration: Number(values.duration), assignee: values.assignee.trim(), note: values.note, status: 'Planifiée' });
  }
  if (type === 'purchase') {
    if (!data.suppliers.some(x => x.name === values.supplier)) return notify('Ajoutez d’abord un fournisseur valide.');
    const linkedSite = siteFromValue(values.site);
    if (!linkedSite) return notify('Choisissez un chantier existant.');
    const reference = values.reference.trim();
    if (data.purchases.some(item => item.supplier === values.supplier && String(item.reference).trim().toLocaleLowerCase('fr') === reference.toLocaleLowerCase('fr'))) return notify('Cette référence existe déjà pour ce fournisseur.');
    const lines = [...form.querySelectorAll('.purchase-order-line')].map(row => {
      const quantity = Number(row.querySelector('[name="lineQuantity"]')?.value);
      const unitPriceHT = Number(row.querySelector('[name="lineUnitPriceHT"]')?.value);
      const vatRate = Number(row.querySelector('[name="lineVatRate"]')?.value);
      const description = row.querySelector('[name="lineDescription"]')?.value.trim() || '';
      const unit = row.querySelector('[name="lineUnit"]')?.value || 'unité';
      const stockItemId = row.querySelector('[name="lineStockItemId"]')?.value || '';
      return { description, quantity, unit, unitPriceHT, vatRate, receivedQuantity: 0, stockItemId };
    });
    if (!lines.length || lines.some(line => !line.description || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPriceHT) || line.unitPriceHT < 0 || !Number.isFinite(line.vatRate) || line.vatRate < 0 || line.vatRate > 100)) return notify('Vérifiez la description, la quantité, le prix et la TVA de chaque ligne.');
    if (lines.some(line => line.stockItemId && !data.stockItems.some(item => item.id === line.stockItemId && item.unit === line.unit))) return notify('Une association au stock ne correspond pas à l’unité de sa ligne.');
    const totalHTCents = lines.reduce((sum, line) => sum + Math.round(line.quantity * Math.round(line.unitPriceHT * 100)), 0);
    data.purchases.unshift({ id: newId(), reference, supplier: values.supplier, siteId: linkedSite.id, site: linkedSite.name, lines, amountHT: centsToEuros(totalHTCents), date: values.date || todayISO(), createdAt: new Date().toISOString(), delivery: values.delivery, status: values.status, receipts: [] });
  }
  if (type === 'invoice') {
    const quote = data.quotes.find(q => q.id === values.quoteId && q.status === 'Accepté');
    if (!quote || data.invoices.some(i => i.quoteId === quote.id)) return notify('Ce devis est indisponible ou a déjà un brouillon de facture associé.');
    const amountHT = quote.totals?.totalHTCents ?? eurosToCents(quote.amountHT ?? quote.amount);
    const amountTTC = quote.totals?.totalTTCCents ?? amountHT + Math.round(amountHT * Number(quote.vat ?? 20) / 100);
    const vatRates = quote.totals?.vatByRateCents ?? { [String(quote.vat ?? 20)]: amountTTC - amountHT };
    const clientSites = data.sites.filter(site => site.client === quote.client);
    const linkedSite = siteFromValue(quote.siteId || quote.site) || (clientSites.length === 1 ? clientSites[0] : null);
    const invoiceId = newId();
    const quoteSnapshot = JSON.parse(JSON.stringify({ id: quote.id, reference: quote.reference || quote.id, title: quote.title, client: quote.client, site: quote.site || '', lines: quote.lines || [], totals: quote.totals || null }));
    data.invoices.unshift({ id: invoiceId, reference: `BROUILLON-${invoiceId.slice(-6).toUpperCase()}`, quoteId: quote.id, quoteSnapshot, client: quote.client, siteId: linkedSite?.id || '', site: linkedSite?.name || quote.site || 'À rattacher', amountHT: centsToEuros(amountHT), amountTTC: centsToEuros(amountTTC), vatRates, vat: quote.vat || 'multi-taux', invoiceDate: values.invoiceDate || todayISO(), dueDate: values.dueDate, createdAt: new Date().toISOString(), status: 'Brouillon local' });
  }
  if (type === 'payment') {
    const invoice = data.invoices.find(x => x.id === form.dataset.invoiceId);
    const already = invoice ? data.payments.filter(x => x.invoiceId === invoice.id).reduce((s, x) => s + Number(x.amount || 0), 0) : 0;
    const amount = eurosToCents(values.amount) / 100;
    if (!invoice || amount <= 0 || amount > Number(invoice.amountTTC) - already) return notify('Le montant dépasse le reste indiqué. Vérifiez le règlement saisi.');
    data.payments.unshift({ id: newId(), invoiceId: invoice.id, invoiceRef: invoice.reference, amount, date: values.date, method: values.method });
  }
  if (type === 'expense') {
    const linkedSite = siteFromValue(values.site);
    if (!linkedSite) return notify('Choisissez un chantier existant.');
    data.expenses.unshift({ id: newId(), label: values.label.trim(), siteId: linkedSite.id, site: linkedSite.name, amount: eurosToCents(values.amount) / 100, date: values.date, status: values.status });
  }
  if (type === 'document') {
    const linkedSite = siteFromValue(values.site);
    const file = form.elements.file.files[0];
    if (!linkedSite) return notify('Choisissez un chantier existant.');
    if (!file || file.size > 700 * 1024 || !fileData) return notify('Fichier absent ou supérieur à 700 Ko : aucun document n’a été enregistré.');
    const actor = currentLocalActor();
    const record = { id: newId(), name: values.name.trim(), siteId: linkedSite.id, site: linkedSite.name, date: todayISO(), fileName: file.name, mime: file.type || 'application/octet-stream', size: file.size, dataUrl: fileData, createdAt: new Date().toISOString(), createdBy: actor.actorName, createdById: actor.actorId, createdByUsername: actor.actorUsername };
    data.documents.unshift(record); recordDocumentAudit('documents', record, 'Ajouté');
  }
  if (type === 'document-edit') {
    const record = data.documents.find(item => item.id === form.dataset.recordId && !item.archivedAt);
    const linkedSite = siteFromValue(values.site);
    const file = form.elements.file?.files?.[0];
    if (!record || !linkedSite) return notify('Le document ou le chantier sélectionné n’est plus disponible.');
    if (file && (!fileData || file.size > 700 * 1024)) return notify('Le nouveau fichier dépasse 700 Ko ou n’a pas pu être lu.');
    record.name = values.name.trim(); record.siteId = linkedSite.id; record.site = linkedSite.name;
    if (file) { record.fileName = file.name; record.mime = file.type || 'application/octet-stream'; record.size = file.size; record.dataUrl = fileData; }
    const actor = currentLocalActor(); record.updatedAt = new Date().toISOString(); record.updatedBy = actor.actorName; record.updatedById = actor.actorId; record.updatedByUsername = actor.actorUsername;
    recordDocumentAudit('documents', record, 'Modifié');
  }
  if (type === 'report') {
    const linkedSite = siteFromValue(values.site);
    if (!linkedSite) return notify('Choisissez un chantier existant.');
    const actor = currentLocalActor();
    const record = { id: newId(), kind: values.kind, title: values.title.trim(), siteId: linkedSite.id, site: linkedSite.name, date: todayISO(), body: values.body.trim(), createdAt: new Date().toISOString(), createdBy: actor.actorName, createdById: actor.actorId, createdByUsername: actor.actorUsername };
    data.reports.unshift(record); recordDocumentAudit('reports', record, 'Ajouté');
  }
  if (type === 'report-edit') {
    const record = data.reports.find(item => item.id === form.dataset.recordId && !item.archivedAt);
    const linkedSite = siteFromValue(values.site);
    if (!record || !linkedSite) return notify('Le rapport ou le chantier sélectionné n’est plus disponible.');
    record.kind = values.kind; record.title = values.title.trim(); record.siteId = linkedSite.id; record.site = linkedSite.name; record.body = values.body.trim();
    const actor = currentLocalActor(); record.updatedAt = new Date().toISOString(); record.updatedBy = actor.actorName; record.updatedById = actor.actorId; record.updatedByUsername = actor.actorUsername;
    recordDocumentAudit('reports', record, 'Modifié');
  }
  if (!save()) return;
  if (type === 'settings' && previousMapsKey !== String(data.settings.googleMapsApiKey || '').trim()) { location.reload(); return; }
  clearFormDraft(form); closeModal(); render(); notify('Enregistré sur cet appareil.');
}

function render() {
  const view = page === 'accueil' ? dashboard() : page === 'chantiers' ? sitesPage() : page === 'clients' ? clientsPage() : page === 'devis' ? quotesPage() : simplePage();
  $('#page-content').innerHTML = view;
  wire();
}

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-module-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (['document', 'document-edit'].includes(form.dataset.moduleForm)) {
    const file = form.elements.file?.files?.[0];
    if (form.dataset.moduleForm === 'document-edit' && !file) { storeModuleForm(form); return; }
    if (!file || file.size > 700 * 1024) return notify('Choisissez un fichier de 700 Ko maximum.');
    const reader = new FileReader();
    reader.onload = () => storeModuleForm(form, reader.result);
    reader.onerror = () => notify('Lecture du fichier impossible. Réessayez.');
    reader.readAsDataURL(file);
    return;
  }
  storeModuleForm(form);
}, true);

// Conserve les données HT, le taux choisi et le TTC sans laisser l’ancien
// formulaire de démonstration perdre le taux de TVA.
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form="quote"]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const values = Object.fromEntries(new FormData(form));
  const htCents = eurosToCents(values.amount);
  const vat = Number(values.vat);
  if (!Number.isFinite(htCents) || htCents < 0 || !Number.isFinite(vat)) return notify('Vérifiez le montant et le taux saisis.');
  data.quotes.unshift({ id: `BROUILLON-${newId().slice(-8).toUpperCase()}`, client: values.client, title: values.title.trim(), amountHT: centsToEuros(htCents), vat, amountTTC: centsToEuros(htCents + Math.round(htCents * vat / 100)), status: values.status, date: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()) });
  if (!save()) return;
  clearFormDraft(form); closeModal(); render(); notify('Brouillon enregistré sur cet appareil.');
}, true);

document.addEventListener('click', event => {
  const documentView = event.target.closest('[data-document-view]');
  if (documentView) { documentsView = documentView.dataset.documentView; render(); return; }
  const deletePurchase = event.target.closest('[data-purchase-delete]');
  if (deletePurchase) {
    const purchase = data.purchases.find(item => item.id === deletePurchase.dataset.purchaseDelete);
    if (!purchase) return;
    if (purchaseReceivedSummary(purchase).received > 0) return notify('Une commande avec réception ne peut pas être supprimée ; gardez sa trace et documentez un retour.');
    if (!confirm(`Supprimer définitivement la commande « ${purchase.reference} » non réceptionnée ?`)) return;
    const previous = data.purchases; data.purchases = previous.filter(item => item.id !== purchase.id);
    if (save()) { closeModal(); render(); notify('Commande supprimée et action inscrite dans l’historique.'); } else data.purchases = previous;
    return;
  }
  const receiveButton = event.target.closest('[data-purchase-receive]');
  if (receiveButton) { openPurchaseReceiptForm(receiveButton.dataset.purchaseReceive); return; }
  const statusButton = event.target.closest('[data-purchase-status]');
  if (statusButton) {
    const purchase = data.purchases.find(item => item.id === statusButton.dataset.id);
    if (!purchase) return;
    const next = statusButton.dataset.purchaseStatus;
    if (next === 'Annulée' && !confirm(`Annuler la commande ${purchase.reference} ? Cette annulation sera enregistrée localement.`)) return;
    if (next === 'Commandée' && purchase.status !== 'À valider') return notify('Seule une commande à valider peut être confirmée.');
    if (next === 'Annulée' && purchaseReceivedSummary(purchase).received > 0) return notify('Une commande réceptionnée ne peut pas être annulée ici ; documentez un retour séparément.');
    purchase.status = next;
    if (save()) { closeModal(); render(); notify(next === 'Commandée' ? 'Commande marquée comme passée.' : 'Commande annulée localement.'); }
    return;
  }
  const button = event.target.closest('[data-module-action]');
  if (button) {
    const action = button.dataset.moduleAction;
    if (action === 'notifications') return openLocalReminders();
    if (action === 'toggle-browser-notifications') return toggleBrowserReminders();
    if (action === 'refresh-assistant') { render(); return notify('Analyse locale actualisée.'); }
    if (['appointment', 'supplier', 'purchase', 'invoice', 'expense', 'document', 'report'].includes(action)) return openModuleForm(action);
    if (action === 'payment') {
      const form = document.querySelector('[data-module-form="payment"]');
      return openModuleForm('payment', button.dataset.id);
    }
    if (action === 'export') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `smart-systm-pilot-export-${todayISO()}.json`; link.click(); URL.revokeObjectURL(link.href); return;
    }
    if (action === 'export-restore-backup') {
      const backup = localStorage.getItem('ssp-pre-restore-backup-v1');
      if (!backup) return notify('Aucune copie précédente n’est disponible.');
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([backup], { type: 'application/json' })); link.download = `smart-systm-pilot-avant-restauration-${todayISO()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); return;
    }
    if (action === 'import') { $('#import-file')?.click(); return; }
    if (action === 'clear' && confirm('Effacer toutes les données locales de cette démonstration ? Cette action est irréversible.')) {
      localStorage.removeItem('ssp-data'); location.reload(); return;
    }
    return;
  }
  const invoiceAction = event.target.closest('[data-invoice-action]');
  if (invoiceAction) {
    event.preventDefault(); event.stopPropagation();
    const id = invoiceAction.dataset.id;
    const invoice = data.invoices.find(item => item.id === id);
    if (invoiceAction.dataset.invoiceAction === 'open') return openInvoiceDetails(id);
    if (invoiceAction.dataset.invoiceAction === 'print') return openInvoicePrint(id);
    if (invoiceAction.dataset.invoiceAction === 'print-now') return window.print();
    if (invoiceAction.dataset.invoiceAction === 'back') return openInvoiceDetails(id);
    if (invoiceAction.dataset.invoiceAction === 'delete' && invoice) {
      if (data.payments.some(payment => payment.invoiceId === id)) return notify('Supprimez ou corrigez d’abord les règlements rattachés.');
      if (!confirm(`Supprimer définitivement la facture brouillon « ${invoice.reference} » ?`)) return;
      const old = data.invoices; data.invoices = old.filter(item => item.id !== id); if (!save()) { data.invoices = old; return; }
      closeModal(); render(); notify('Facture brouillon supprimée et suppression inscrite dans l’historique.'); return;
    }
    if (invoiceAction.dataset.invoiceAction === 'payment' && invoice) {
      openModuleForm('payment', id);
      const paymentForm = document.querySelector('[data-module-form="payment"]');
      if (paymentForm) paymentForm.dataset.invoiceId = id;
      return;
    }
    if (invoiceAction.dataset.invoiceAction === 'email' && invoice) {
      const client = data.clients.find(item => item.name === invoice.client);
      if (!client?.email) return notify('Ajoutez une adresse e-mail dans la fiche client avant de préparer le message.');
      const subject = encodeURIComponent(`Facture brouillon ${invoice.reference} — ${data.settings.companyName}`);
      const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint le PDF de la facture brouillon ${invoice.reference}.\n\nCordialement,\n${data.settings.companyName}\n\nPensez à joindre le PDF enregistré depuis l’aperçu.`);
      location.href = `mailto:${encodeURIComponent(client.email)}?subject=${subject}&body=${body}`;
      return;
    }
  }
  const menu = event.target.closest('[data-record-menu]');
  if (!menu) return;
  const id = menu.dataset.recordMenu;
  const appointment = data.appointments.find(x => x.id === id);
  if (appointment) { if (confirm(`Supprimer l’intervention « ${appointment.title} » ?`)) { const previous = data.appointments; data.appointments = previous.filter(x => x.id !== id); if (save()) render(); else data.appointments = previous; } return; }
  const supplier = data.suppliers.find(x => x.id === id);
  if (supplier) { if (confirm(`Supprimer le fournisseur « ${supplier.name} » ?`)) { if (data.purchases.some(x => x.supplier === supplier.name)) return notify('Ce fournisseur est lié à une commande et ne peut pas être supprimé.'); const previous = data.suppliers; data.suppliers = previous.filter(x => x.id !== id); if (save()) render(); else data.suppliers = previous; } return; }
  const purchase = data.purchases.find(x => x.id === id);
  if (purchase) { openPurchaseDetails(id); return; }
  const invoice = data.invoices.find(x => x.id === id);
  if (invoice) {
    return openInvoiceDetails(id);
  }
  const documentRecord = data.documents.find(x => x.id === id);
  if (documentRecord) {
    openAuditedRecord('documents', documentRecord);
    return;
  }
  const report = data.reports.find(x => x.id === id);
  if (report) {
    openAuditedRecord('reports', report);
    return;
  }
  const payment = data.payments.find(x => x.id === id);
  if (payment && confirm(`Supprimer le règlement saisi de ${money(payment.amount)} pour « ${payment.invoiceRef} » ?`)) { const previous = data.payments; data.payments = previous.filter(x => x.id !== id); if (save()) render(); else data.payments = previous; return; }
  const expense = data.expenses.find(x => x.id === id);
  if (expense && confirm(`Supprimer la dépense « ${expense.label} » ?`)) { const previous = data.expenses; data.expenses = previous.filter(x => x.id !== id); if (save()) render(); else data.expenses = previous; return; }
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-map-action]');
  if (!button) return;
  event.preventDefault();
  if (button.dataset.mapAction === 'load') {
    if (sessionStorage.getItem('ssp-map-consent') === '1') return initializeSiteMap();
    return showMapConsent();
  }
  if (button.dataset.mapAction === 'cancel-load') return closeModal();
  if (button.dataset.mapAction === 'confirm-load') {
    sessionStorage.setItem('ssp-map-consent', '1'); closeModal(); return initializeSiteMap();
  }
});

document.addEventListener('click', event => {
  const openSiteLink = event.target.closest('[data-open-site]');
  if (openSiteLink) { event.preventDefault(); const id = openSiteLink.dataset.openSite; route('chantiers'); showSite(id); }
});

document.addEventListener('input', event => {
  if (event.target.id === 'map-search') refreshSiteMapMarkers();
});
document.addEventListener('change', event => {
  if (['map-search', 'map-filter-status', 'map-filter-client'].includes(event.target.id)) refreshSiteMapMarkers({ fitView: true });
  if (event.target.id === 'planning-anchor' && event.target.value) { planningAnchor = event.target.value; render(); }
  if (event.target.id === 'planning-site-filter') { planningSiteFilter = event.target.value; render(); }
  if (event.target.id === 'planning-assignee-filter') { planningAssigneeFilter = event.target.value; render(); }
});

document.addEventListener('click', event => {
  const view = event.target.closest('[data-planning-view]');
  if (view) { planningView = view.dataset.planningView; render(); return; }
  const shift = event.target.closest('[data-planning-shift]');
  if (shift) {
    const anchor = new Date(`${planningAnchor}T12:00:00`);
    if (planningView === 'day') anchor.setDate(anchor.getDate() + Number(shift.dataset.planningShift));
    else if (planningView === 'week') anchor.setDate(anchor.getDate() + 7 * Number(shift.dataset.planningShift));
    else {
      const year = anchor.getFullYear(), month = anchor.getMonth() + Number(shift.dataset.planningShift);
      anchor.setDate(Math.min(anchor.getDate(), new Date(year, month + 1, 0).getDate()));
      anchor.setMonth(month);
    }
    planningAnchor = planningISO(anchor); render(); return;
  }
  if (event.target.closest('[data-planning-today]')) { planningAnchor = todayISO(); render(); return; }
  const calendarDay = event.target.closest('[data-calendar-date]');
  if (calendarDay && planningView === 'month') { planningAnchor = calendarDay.dataset.calendarDate; planningView = 'day'; render(); }
});

document.addEventListener('change', async event => {
  if (event.target.id !== 'import-file') return;
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 15 * 1024 * 1024) return notify('Fichier trop volumineux pour cette démonstration locale.');
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || !Array.isArray(imported.clients) || !Array.isArray(imported.sites) || !Array.isArray(imported.quotes)) throw new Error('format');
    const validation = SSPDomain.validateStoredData(imported);
    if (!validation.valid) throw new Error(validation.reason);
    for (const [key, defaultValue] of Object.entries(localModulesDefault)) if (Array.isArray(defaultValue) && imported[key] !== undefined && !Array.isArray(imported[key])) throw new Error('collection');
    if (imported.settings !== undefined && (!imported.settings || typeof imported.settings !== 'object' || Array.isArray(imported.settings))) throw new Error('settings');
    const counts = `Clients : ${imported.clients.length}, chantiers : ${imported.sites.length}, devis : ${imported.quotes.length}.`;
    if (!confirm(`Remplacer toutes les données locales actuelles par cette copie ?\n\n${counts}\n\nUne copie de l’état actuel sera conservée sur cet appareil.`)) { event.target.value = ''; return; }
    const previousData = JSON.stringify(data);
    try { localStorage.setItem('ssp-pre-restore-backup-v1', previousData); }
    catch { event.target.value = ''; return notify('Espace insuffisant pour garder la copie actuelle. Exportez vos données depuis Paramètres puis libérez de l’espace avant de restaurer.'); }
    data = { ...localModulesDefault, ...imported, settings: { ...localModulesDefault.settings, ...(imported.settings || {}) } };
    for (const key of Object.keys(localModulesDefault)) if (Array.isArray(localModulesDefault[key]) && !Array.isArray(data[key])) data[key] = [];
    if (!save({ restoring: true })) { data = JSON.parse(previousData); event.target.value = ''; return; }
    applyBrandSettings(); render(); notify('Copie locale restaurée.');
  } catch { notify('Fichier de sauvegarde invalide ou illisible.'); }
  event.target.value = '';
});

let crmView = 'clients';
let pendingCrmDraft = null;

function clientsPage() {
  const clients = data.clients || [];
  const prospects = data.prospects || [];
  const openFollowups = (data.followups || []).filter(item => item.status !== 'Fait').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const tabs = `<div class="crm-tabs" role="tablist" aria-label="Contacts"><button role="tab" aria-selected="${crmView === 'clients'}" class="${crmView === 'clients' ? 'active' : ''}" data-crm-view="clients">Clients <span>${clients.length}</span></button><button role="tab" aria-selected="${crmView === 'prospects'}" class="${crmView === 'prospects' ? 'active' : ''}" data-crm-view="prospects">Prospects <span>${prospects.filter(x => !x.convertedAt && x.status !== 'Perdu').length}</span></button></div>`;
  if (crmView === 'prospects') {
    const rows = prospects.map(prospect => {
      const next = openFollowups.find(item => item.entityType === 'prospect' && item.entityId === prospect.id);
      const status = prospect.convertedAt ? 'Converti en client' : prospect.status || 'Nouveau';
      return `<article class="client-card prospect-card"><div class="client-card-head"><span class="client-avatar">${initials(prospect.name || '?')}</span><span class="pill neutral">${esc(status)}</span></div><h3>${esc(prospect.name)}</h3><p class="client-city">⌖ ${esc(prospect.city || 'Ville non renseignée')}</p><div class="client-contact"><span>✉</span>${esc(prospect.email || 'E-mail non renseigné')}</div><div class="client-contact"><span>♧</span>${esc(prospect.phone || 'Téléphone non renseigné')}</div><p class="prospect-followup">${next ? `Relance ${esc(next.dueDate)} · ${esc(next.note || next.title)}` : prospect.nextFollowup ? `À recontacter le ${esc(prospect.nextFollowup)}` : 'Aucune relance planifiée'}</p><div class="prospect-actions"><button class="btn secondary" data-crm-action="open-prospect" data-id="${esc(prospect.id)}">Voir la fiche</button>${prospect.convertedAt ? `<button class="btn secondary" data-client="${esc(prospect.clientId)}">Ouvrir le client</button>` : `<button class="btn primary" data-crm-action="convert-prospect" data-id="${esc(prospect.id)}">Convertir en client</button>`}</div></article>`;
    }).join('');
    return `${heading('RELATION CLIENT', 'Clients & prospects', 'Suivez les contacts, les occasions et les relances au même endroit.', `<button class="btn secondary" data-action="add-client">＋ Nouveau client</button> <button class="btn primary" data-crm-action="new-prospect">＋ Nouveau prospect</button>`)}${tabs}<div class="toolbar"><label class="search list-search"><span>⌕</span><input id="prospect-search" placeholder="Rechercher un prospect"></label><span class="toolbar-count">${prospects.length} fiche(s)</span></div>${openFollowups.length ? `<section class="panel crm-followups"><div class="panel-head"><div><h2>Relances à faire</h2><p>Rappels locaux dans cette démonstration, sans notification externe.</p></div><span class="pill neutral">${openFollowups.length}</span></div>${openFollowups.map(item => { const prospect = prospects.find(x => x.id === item.entityId); const client = data.clients.find(x => x.id === item.entityId); return `<div class="crm-followup-row"><span><b>${esc(item.title)}</b><small>${esc(item.dueDate || 'Date non définie')} · ${esc(prospect?.name || client?.name || 'Contact')}</small></span><span class="crm-followup-actions"><button class="btn secondary" data-crm-action="complete-followup" data-id="${esc(item.id)}">Marquer fait</button><button class="btn danger" data-crm-action="delete-followup" data-id="${esc(item.id)}">Supprimer</button></span></div>`; }).join('')}</section>` : ''}<div class="client-grid prospect-grid">${rows || `<div class="panel">${empty('Aucun prospect enregistré.','new-prospect','Ajouter un prospect')}</div>`}</div>`;
  }
  return `${heading('RELATION CLIENT', 'Clients & prospects', 'Retrouvez les clients et transformez vos opportunités sans ressaisir leurs coordonnées.', `<button class="btn secondary" data-crm-action="new-prospect">＋ Nouveau prospect</button> <button class="btn primary" data-action="add-client">＋ Nouveau client</button>`)}${tabs}<div class="toolbar"><label class="search list-search"><span>⌕</span><input id="client-search" placeholder="Rechercher un client"></label><span class="toolbar-count">${clients.length} client(s)</span></div><div class="client-grid">${clients.map(client => `<article class="client-card"><div class="client-card-head"><span class="client-avatar">${initials(client.name)}</span><span class="pill neutral">${esc(client.type || 'Client')}</span><button class="more-button" data-client-menu="${esc(client.id)}">···</button></div><h3>${esc(client.name)}</h3><p class="client-city">⌖ ${esc(client.city || 'Ville non renseignée')}</p><div class="client-contact"><span>✉</span>${esc(client.email || 'E-mail non renseigné')}</div><div class="client-contact"><span>♧</span>${esc(client.phone || 'Téléphone non renseigné')}</div><div class="client-card-foot"><span>${data.sites.filter(site => site.client === client.name).length} chantier(s)</span><button data-client="${esc(client.id)}">Ouvrir la fiche →</button></div></article>`).join('') || `<div class="panel">${empty('Aucun client enregistré.','add-client','Ajouter un client')}</div>`}</div>`;
}

function openProspectForm() {
  modal('Nouveau prospect', `<form data-crm-form="prospect"><label>Nom du contact ou de l’entreprise<input name="name" required maxlength="160" autocomplete="organization" placeholder="Ex. Atelier Dupont"></label><div class="form-row"><label>Type<select name="type"><option>Professionnel</option><option>Particulier</option><option>Syndic</option><option>Collectivité</option></select></label><label>Ville<input name="city" maxlength="100" autocomplete="address-level2"></label></div><div class="form-row"><label>E-mail<input name="email" type="email" maxlength="180" autocomplete="email"></label><label>Téléphone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label></div><div class="form-row"><label>Origine du contact<input name="origin" maxlength="100" placeholder="Recommandation, site web…"></label><label>Étape<select name="status"><option>Nouveau</option><option>À contacter</option><option>Devis à préparer</option><option>En attente</option><option>Perdu</option></select></label></div><label>Besoin ou travaux envisagés<textarea name="need" maxlength="1000" rows="3" placeholder="Dépannage, rénovation, maintenance GTB…"></textarea></label><div class="form-row"><label>Prochaine relance<input name="nextFollowup" type="date"></label><label>Note de suivi<input name="notes" maxlength="500"></label></div><p class="form-hint">Les informations restent dans ce navigateur. Aucun e-mail ni rappel n’est envoyé.</p><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer le prospect</button></div></form>`);
  $('.cancel').onclick = closeModal;
}

function crmContactMatches(candidate, includeProspects = true) {
  const records = [...(data.clients || []).map(record => ({ ...record, crmKind: 'client' }))];
  if (includeProspects) records.push(...(data.prospects || []).filter(record => !record.convertedAt).map(record => ({ ...record, crmKind: 'prospect' })));
  return SSPDomain.findPotentialContactDuplicates(candidate, records);
}

function showDuplicateReview(draft, matches) {
  pendingCrmDraft = draft;
  modal('Vérifier les contacts similaires', `<div class="detail-card"><p>Un nom, une adresse e-mail ou un numéro semble déjà exister. Vérifiez ces fiches avant de créer un doublon. La fusion proposée complète les champs vides et conserve chaque valeur différente dans la fiche existante.</p>${matches.map(({ record, reasons }) => `<div class="crm-duplicate"><b>${esc(record.name)}</b><small>${esc(record.crmKind === 'prospect' ? 'Prospect' : 'Client')} · ${esc(reasons.join(', '))}${record.city ? ` · ${esc(record.city)}` : ''}</small>${draft.kind === 'client' && record.crmKind === 'client' ? `<button class="btn secondary" data-crm-action="merge-client" data-client-id="${esc(record.id)}">Fusionner sans perdre les différences</button>` : ''}</div>`).join('')}<div class="form-actions"><button class="btn secondary" data-crm-action="cancel-duplicate">Annuler</button><button class="btn primary" data-crm-action="save-duplicate">Créer quand même</button></div></div>`);
}

function persistProspect(candidate) {
  const prospect = { id: newId(), ...candidate, createdAt: new Date().toISOString(), status: candidate.status || 'Nouveau' };
  data.prospects.unshift(prospect);
  if (candidate.nextFollowup) data.followups.unshift({ id: newId(), entityType: 'prospect', entityId: prospect.id, title: `Relancer ${prospect.name}`, dueDate: candidate.nextFollowup, note: candidate.notes || '', status: 'À faire' });
  if (!save()) return;
  pendingCrmDraft = null; crmView = 'prospects'; closeModal(); render(); notify('Prospect enregistré sur cet appareil.');
}

function persistClient(candidate, sourceProspect = null) {
  const client = { id: newId(), name: candidate.name.trim(), type: candidate.type || 'Professionnel', city: candidate.city || '', address: candidate.address || '', postalCode: candidate.postalCode || '', latitude: candidate.latitude === '' ? '' : Number(candidate.latitude) || '', longitude: candidate.longitude === '' ? '' : Number(candidate.longitude) || '', email: candidate.email || '', phone: candidate.phone || '', origin: candidate.origin || '', notes: candidate.need || candidate.notes || '', sourceProspectId: sourceProspect?.id || '' };
  data.clients.unshift(client);
  if (sourceProspect) {
    sourceProspect.convertedAt = new Date().toISOString(); sourceProspect.clientId = client.id; sourceProspect.status = 'Converti';
    for (const followup of data.followups || []) if (followup.entityType === 'prospect' && followup.entityId === sourceProspect.id) { followup.entityType = 'client'; followup.entityId = client.id; }
  }
  if (!save()) return;
  pendingCrmDraft = null; crmView = sourceProspect ? 'clients' : crmView; closeModal(); render(); notify(sourceProspect ? 'Prospect converti en client avec ses coordonnées.' : 'Client enregistré sur cet appareil.');
}

function convertProspect(prospect, existingClient = null) {
  if (existingClient) {
    prospect.convertedAt = new Date().toISOString(); prospect.clientId = existingClient.id; prospect.status = 'Converti';
    for (const followup of data.followups || []) if (followup.entityType === 'prospect' && followup.entityId === prospect.id) { followup.entityType = 'client'; followup.entityId = existingClient.id; }
    if (!save()) return;
    pendingCrmDraft = null; crmView = 'clients'; closeModal(); render(); notify(`Prospect rattaché à la fiche client « ${existingClient.name} ».`); return;
  }
  persistClient(prospect, prospect);
}

function showProspect(prospect) {
  const client = data.clients.find(item => item.id === prospect.clientId);
  const followups = (data.followups || []).filter(item => item.entityId === prospect.id || item.entityId === prospect.clientId);
  modal(prospect.name, `<div class="detail-card"><span class="pill neutral">${esc(prospect.convertedAt ? 'Converti en client' : prospect.status || 'Nouveau')}</span><p><b>Type</b><br>${esc(prospect.type || 'Non précisé')}</p><p><b>Ville</b><br>${esc(prospect.city || 'Non renseignée')}</p><p><b>E-mail</b><br>${esc(prospect.email || 'Non renseigné')}</p><p><b>Téléphone</b><br>${esc(prospect.phone || 'Non renseigné')}</p><p><b>Origine</b><br>${esc(prospect.origin || 'Non renseignée')}</p><p><b>Besoin</b><br>${esc(prospect.need || 'Non renseigné')}</p>${client ? `<p><b>Fiche client liée</b><br>${esc(client.name)}</p>` : ''}<label>Étape commerciale<select id="prospect-stage" ${prospect.convertedAt ? 'disabled' : ''}>${['Nouveau','À contacter','Devis à préparer','En attente','Perdu'].map(status => `<option ${prospect.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label><p><b>Relances</b><br>${followups.map(item => `${esc(item.dueDate || 'Sans date')} · ${esc(item.note || item.title)} (${esc(item.status)})`).join('<br>') || 'Aucune relance planifiée'}</p><div class="form-actions">${prospect.convertedAt ? '' : `<button class="btn secondary" data-crm-action="add-followup" data-id="${esc(prospect.id)}">Planifier une relance</button><button class="btn primary" data-crm-action="convert-prospect" data-id="${esc(prospect.id)}">Convertir en client</button><button class="btn danger" data-crm-action="delete-prospect" data-id="${esc(prospect.id)}">Supprimer le prospect</button>`}</div></div>`);
  const stage = $('#prospect-stage');
  stage?.addEventListener('change', () => { const previous = prospect.status; prospect.status = stage.value; if (save()) notify('Étape mise à jour sur cet appareil.'); else stage.value = previous; });
}

function openFollowupForm(prospect) {
  modal('Planifier une relance', `<form data-crm-form="followup" data-prospect-id="${esc(prospect.id)}"><p>Contact : <b>${esc(prospect.name)}</b></p><label>Date prévue<input name="dueDate" type="date" required value="${esc(prospect.nextFollowup || todayISO())}"></label><label>Objet de la relance<input name="note" required maxlength="240" placeholder="Ex. Reprendre le devis envoyé"></label><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la relance</button></div></form>`);
  $('.cancel').onclick = closeModal;
}

function showClient(id) {
  const client = data.clients.find(item => item.id === id);
  if (!client) return notify('Cette fiche client n’existe plus.');
  const sites = data.sites.filter(site => site.client === client.name);
  const quotes = data.quotes.filter(quote => quote.client === client.name);
  const invoices = data.invoices.filter(invoice => invoice.client === client.name);
  const sourceProspects = (data.prospects || []).filter(prospect => prospect.clientId === client.id || prospect.id === client.sourceProspectId);
  const followups = (data.followups || []).filter(item => item.entityType === 'client' && item.entityId === client.id);
  const fieldNames = { name: 'Autre nom', type: 'Autre type', city: 'Autre ville', email: 'Autre e-mail', phone: 'Autre téléphone', origin: 'Autre origine', notes: 'Autre note' };
  const alternateValues = Object.entries(client.alternateValues || {}).flatMap(([field, values]) => (values || []).map(value => `<p><b>${esc(fieldNames[field] || field)}</b><br>${esc(value)}</p>`)).join('');
  const mergeHistory = (client.mergeHistory || []).map(item => `<li>${esc(new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(item.mergedAt)))} · coordonnées rapprochées de « ${esc(item.incomingName)} » ; ${item.conflictFields?.length || 0} valeur(s) différente(s) conservée(s).</li>`).join('');
  modal(client.name, `<div class="detail-card"><span class="pill neutral">${esc(client.type || 'Client')}</span><p><b>Adresse</b><br>${esc([client.address, client.postalCode, client.city].filter(Boolean).join(', ') || 'Non renseignée')}</p><p><b>E-mail</b><br>${esc(client.email || 'Non renseigné')}</p><p><b>Téléphone</b><br>${esc(client.phone || 'Non renseigné')}</p><p><b>Chantiers</b><br>${sites.map(site => esc(site.name)).join(', ') || 'Aucun chantier'}</p><p><b>Devis</b><br>${quotes.map(quote => `${esc(quote.title)} · ${esc(quote.status)} · ${money(quote.amountTTC ?? quote.amount)}`).join('<br>') || 'Aucun devis'}</p><p><b>Factures brouillon</b><br>${invoices.map(invoice => `${esc(invoice.reference)} · ${money(invoice.amountTTC)}`).join('<br>') || 'Aucune facture'}</p><p><b>Prospects associés</b><br>${sourceProspects.map(prospect => esc(prospect.name)).join(', ') || 'Aucun'}</p>${followups.length ? `<p><b>Relances</b><br>${followups.map(item => `${esc(item.dueDate || 'Sans date')} · ${esc(item.note || item.title)} (${esc(item.status)})`).join('<br>')}</p>` : ''}${alternateValues ? `<section class="crm-alternates"><h3>Autres coordonnées conservées</h3>${alternateValues}</section>` : ''}${mergeHistory ? `<section class="crm-alternates"><h3>Historique des rapprochements</h3><ul>${mergeHistory}</ul></section>` : ''}<div class="form-actions"><button class="btn secondary" data-client-action="edit" data-id="${esc(client.id)}">Modifier le client</button><button class="btn danger" data-client-action="delete" data-id="${esc(client.id)}">Supprimer le client</button></div></div>`);
}

function openClientEdit(id) {
  const client = data.clients.find(item => item.id === id); if (!client) return;
  modal(`Modifier · ${client.name}`, `<form data-form="client-edit" data-id="${esc(id)}"><label>Nom du client<input name="name" required maxlength="160" value="${esc(client.name)}"></label><div class="form-row"><label>Type<select name="type">${['Professionnel','Particulier','Syndic','Collectivité'].map(type => `<option ${client.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label><label>Ville<input name="city" maxlength="100" value="${esc(client.city || '')}"></label></div><label>Adresse complète<input name="address" maxlength="240" value="${esc(client.address || '')}" autocomplete="street-address"></label><div class="form-row"><label>E-mail<input name="email" type="email" maxlength="180" value="${esc(client.email || '')}"></label><label>Téléphone<input name="phone" type="tel" maxlength="40" value="${esc(client.phone || '')}"></label></div><input type="hidden" name="latitude" value="${esc(client.latitude ?? '')}"><input type="hidden" name="postalCode" value="${esc(client.postalCode || '')}"><input type="hidden" name="longitude" value="${esc(client.longitude ?? '')}"><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer les modifications</button></div></form>`);
  $('.cancel').onclick = () => showClient(id);
}

document.addEventListener('submit', event => {
  const clientForm = event.target.closest('[data-form="client"]');
  const clientEditForm = event.target.closest('[data-form="client-edit"]');
  const crmForm = event.target.closest('[data-crm-form]');
  if (!clientForm && !clientEditForm && !crmForm) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const values = Object.fromEntries(new FormData(event.target));
  if (clientEditForm) {
    const client = data.clients.find(item => item.id === clientEditForm.dataset.id);
    if (!client) return notify('Cette fiche client n’existe plus.');
    const nextName = String(values.name || '').trim();
    if (!nextName) return notify('Le nom du client est obligatoire.');
    const previous = { ...client };
    Object.assign(client, { name: nextName, type: values.type, city: values.city, address: values.address, email: values.email, phone: values.phone, postalCode: values.postalCode || '', latitude: values.latitude === '' ? '' : Number(values.latitude), longitude: values.longitude === '' ? '' : Number(values.longitude) });
    for (const site of data.sites) if (site.client === previous.name) site.client = nextName;
    for (const collection of ['quotes','invoices','prospects']) for (const item of data[collection] || []) if (item.client === previous.name) item.client = nextName;
    if (!save()) return; closeModal(); render(); notify('Fiche client modifiée et action inscrite dans l’historique.'); return;
  }
  if (clientForm) {
    const candidate = { ...values, name: String(values.name || '').trim(), email: String(values.email || '').trim(), phone: String(values.phone || '').trim() };
    const matches = crmContactMatches(candidate);
    return matches.length ? showDuplicateReview({ kind: 'client', candidate }, matches) : persistClient(candidate);
  }
  if (crmForm.dataset.crmForm === 'prospect') {
    const candidate = { ...values, name: String(values.name || '').trim(), email: String(values.email || '').trim(), phone: String(values.phone || '').trim(), notes: String(values.notes || '').trim() };
    const matches = crmContactMatches(candidate);
    return matches.length ? showDuplicateReview({ kind: 'prospect', candidate }, matches) : persistProspect(candidate);
  }
  if (crmForm.dataset.crmForm === 'followup') {
    const prospect = data.prospects.find(item => item.id === crmForm.dataset.prospectId);
    if (!prospect) return notify('Ce prospect n’existe plus.');
    prospect.nextFollowup = values.dueDate;
    data.followups.unshift({ id: newId(), entityType: 'prospect', entityId: prospect.id, title: `Relancer ${prospect.name}`, dueDate: values.dueDate, note: String(values.note || '').trim(), status: 'À faire' });
    if (!save()) return;
    closeModal(); render(); notify('Relance planifiée localement.');
  }
}, true);

document.addEventListener('input', event => {
  if (event.target.id === 'prospect-search') {
    const query = event.target.value.toLocaleLowerCase('fr').trim();
    document.querySelectorAll('.prospect-card').forEach(card => { card.hidden = !card.textContent.toLocaleLowerCase('fr').includes(query); });
  }
});

document.addEventListener('click', event => {
  const clientAction = event.target.closest('[data-client-action]');
  if (clientAction) {
    const client = data.clients.find(item => item.id === clientAction.dataset.id); if (!client) return;
    if (clientAction.dataset.clientAction === 'edit') return openClientEdit(client.id);
    if (clientAction.dataset.clientAction === 'delete') {
      const referenced = data.sites.some(item => item.client === client.name) || data.quotes.some(item => item.client === client.name) || data.invoices.some(item => item.client === client.name) || (data.prospects || []).some(item => item.clientId === client.id || item.id === client.sourceProspectId) || (data.followups || []).some(item => item.entityType === 'client' && item.entityId === client.id);
      if (referenced) return notify('Ce client est lié à un chantier, un devis, une facture ou un prospect. Supprimez ou rattachez ces éléments avant de supprimer sa fiche.');
      if (!confirm(`Supprimer définitivement la fiche client « ${client.name} » ?`)) return;
      const previous = data.clients; data.clients = previous.filter(item => item.id !== client.id); if (!save()) { data.clients = previous; return; }
      closeModal(); render(); notify('Fiche client supprimée et action inscrite dans l’historique.'); return;
    }
  }
  const viewButton = event.target.closest('[data-crm-view]');
  if (viewButton) { crmView = viewButton.dataset.crmView; render(); return; }
  const button = event.target.closest('[data-crm-action]');
  if (!button) return;
  const action = button.dataset.crmAction;
  const prospect = data.prospects.find(item => item.id === button.dataset.id);
  if (action === 'new-prospect') return openProspectForm();
  if (action === 'open-prospect' && prospect) return showProspect(prospect);
  if (action === 'add-followup' && prospect) return openFollowupForm(prospect);
  if (action === 'convert-prospect' && prospect) {
    const matches = SSPDomain.findPotentialContactDuplicates(prospect, data.clients);
    if (matches.length) {
      pendingCrmDraft = { kind: 'convert', prospectId: prospect.id };
      return modal('Client similaire détecté', `<div class="detail-card"><p>Associez ce prospect à une fiche existante ou confirmez la création d’un nouveau client.</p>${matches.map(({ record, reasons }) => `<div class="crm-duplicate"><b>${esc(record.name)}</b><small>${esc(reasons.join(', '))}${record.city ? ` · ${esc(record.city)}` : ''}</small><button class="btn secondary" data-crm-action="associate-client" data-id="${esc(prospect.id)}" data-client-id="${esc(record.id)}">Associer à cette fiche</button></div>`).join('')}<div class="form-actions"><button class="btn secondary" data-crm-action="cancel-duplicate">Annuler</button><button class="btn primary" data-crm-action="save-duplicate">Créer un nouveau client</button></div></div>`);
    }
    return convertProspect(prospect);
  }
  if (action === 'associate-client' && prospect) {
    const client = data.clients.find(item => item.id === button.dataset.clientId);
    if (client) convertProspect(prospect, client);
    return;
  }
  if (action === 'save-duplicate' && pendingCrmDraft) {
    const draft = pendingCrmDraft;
    if (draft.kind === 'client') return persistClient(draft.candidate);
    if (draft.kind === 'prospect') return persistProspect(draft.candidate);
    if (draft.kind === 'convert') { const source = data.prospects.find(item => item.id === draft.prospectId); if (source) return convertProspect(source); }
  }
  if (action === 'merge-client' && pendingCrmDraft?.kind === 'client') {
    const target = data.clients.find(item => item.id === button.dataset.clientId);
    if (!target) return notify('La fiche client choisie n’existe plus.');
    const merged = SSPDomain.mergeContactDetails(target, pendingCrmDraft.candidate);
    Object.assign(target, merged);
    if (!save()) return;
    pendingCrmDraft = null; crmView = 'clients'; closeModal(); render(); notify('Coordonnées rapprochées. Les différences restent consultables dans la fiche client.');
    return;
  }
  if (action === 'cancel-duplicate') { pendingCrmDraft = null; return closeModal(); }
  if (action === 'delete-followup') {
    const followup = (data.followups || []).find(item => item.id === button.dataset.id);
    if (!followup) return;
    if (!confirm(`Supprimer la relance « ${followup.note || followup.title} » ?`)) return;
    const previous = data.followups; data.followups = previous.filter(item => item.id !== followup.id);
    if (save()) { render(); notify('Relance supprimée et action inscrite dans l’historique.'); } else data.followups = previous;
    return;
  }
  if (action === 'delete-prospect') {
    if (!prospect || prospect.convertedAt) return notify('Un prospect converti doit être géré depuis sa fiche client.');
    if (!confirm(`Supprimer définitivement le prospect « ${prospect.name} » et ses relances ?`)) return;
    const oldProspects = data.prospects, oldFollowups = data.followups;
    data.prospects = oldProspects.filter(item => item.id !== prospect.id);
    data.followups = oldFollowups.filter(item => !(item.entityType === 'prospect' && item.entityId === prospect.id));
    if (save()) { closeModal(); render(); notify('Prospect et relances supprimés et inscrits dans l’historique.'); } else { data.prospects = oldProspects; data.followups = oldFollowups; }
    return;
  }
  if (action === 'complete-followup') {
    const followup = (data.followups || []).find(item => item.id === button.dataset.id);
    if (followup) { followup.status = 'Fait'; followup.completedAt = new Date().toISOString(); if (save()) { render(); notify('Relance marquée comme faite.'); } }
  }
});

let globalSearchRows = [];
let globalSearchActiveIndex = -1;

function normalizeGlobalSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9@.+_-]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function collectGlobalSearchRows(query) {
  const rows = [];
  const add = (kind, record, title, subtitle, searchText, icon) => {
    if (normalizeGlobalSearch(searchText).includes(query)) rows.push({ kind, id: record.id, title, subtitle, icon });
  };
  for (const item of data.clients || []) add('client', item, item.name, [item.type, item.city, item.email, item.phone].filter(Boolean).join(' · '), [item.name, item.type, item.city, item.address, item.email, item.phone, ...(Object.values(item.alternateValues || {}).flat())].join(' '), '♙');
  for (const item of data.prospects || []) if (!item.convertedAt) add('prospect', item, item.name, [item.status, item.city, item.email, item.phone, item.need].filter(Boolean).join(' · '), [item.name, item.status, item.city, item.email, item.phone, item.need, item.origin].join(' '), '◉');
  for (const item of data.sites || []) add('site', item, item.name, [item.client, item.status, item.address].filter(Boolean).join(' · '), [item.name, item.client, item.status, item.address, item.reference].join(' '), '⌖');
  for (const item of data.quotes || []) add('quote', item, item.title, `${item.client || ''} · ${item.status || 'Brouillon'} · ${item.id}`, [item.title, item.client, item.status, item.id].join(' '), '▤');
  for (const item of data.invoices || []) add('invoice', item, item.reference, `${item.client} · brouillon · ${money(item.amountTTC)}`, [item.reference, item.client, item.site, item.status].join(' '), '▧');
  for (const item of data.purchases || []) add('purchase', item, item.reference || item.supplier, `${item.supplier || ''} · ${siteLabel(item)} · ${item.status || ''}`, [item.reference, item.supplier, item.site, item.status].join(' '), '▥');
  for (const item of data.appointments || []) add('appointment', item, item.title, `${siteLabel(item)} · ${item.date} ${item.time || ''} · ${item.assignee || ''}`, [item.title, item.site, item.date, item.assignee, item.status].join(' '), '▦');
  for (const item of data.documents || []) add('document', item, item.name, `${item.fileName || ''} · ${siteLabel(item)} · ${item.date || ''}`, [item.name, item.fileName, item.site, item.date].join(' '), '▱');
  for (const item of data.reports || []) add('report', item, item.title, `${item.kind || 'Compte rendu'} · ${siteLabel(item)} · ${item.date || ''}`, [item.title, item.kind, item.site, item.body, item.date].join(' '), '⌁');
  for (const item of data.tasks || []) add('task', item, item.title, `${siteLabel(item)} · ${item.status || 'À faire'} · ${item.dueDate || ''}`, [item.title, item.site, item.status, item.assignee, item.note].join(' '), '✓');
  for (const item of data.stockItems || []) add('stock', item, item.name, `${item.reference || 'Sans référence'} · ${item.unit || ''}`, [item.name, item.reference, item.unit].join(' '), '▧');
  return rows.slice(0, 12);
}

function renderGlobalSearchResults() {
  const input = $('#global-search');
  const box = $('#global-search-results');
  if (!input || !box) return;
  const query = normalizeGlobalSearch(input.value);
  if (query.length < 2) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); globalSearchRows = []; globalSearchActiveIndex = -1; return; }
  globalSearchRows = collectGlobalSearchRows(query);
  globalSearchActiveIndex = -1;
  box.innerHTML = globalSearchRows.length ? globalSearchRows.map((row, index) => `<button type="button" role="option" aria-selected="false" data-global-kind="${esc(row.kind)}" data-global-id="${esc(row.id)}" data-global-index="${index}"><span aria-hidden="true">${row.icon}</span><span><b>${esc(row.title)}</b><small>${esc(row.subtitle)}</small></span></button>`).join('') : '<div class="search-empty">Aucun résultat local pour cette recherche.</div>';
  box.hidden = false; input.setAttribute('aria-expanded', 'true');
}

function hideGlobalSearchResults({ clear = false } = {}) {
  const input = $('#global-search');
  const box = $('#global-search-results');
  if (box) box.hidden = true;
  if (input) input.setAttribute('aria-expanded', 'false');
  $('.global-search-shell')?.classList.remove('is-open');
  globalSearchActiveIndex = -1;
  if (clear && input) input.value = '';
}

function openGlobalSearchResult(kind, id) {
  hideGlobalSearchResults({ clear: true });
  if (kind === 'client') { const record = data.clients.find(item => item.id === id); if (record) { route('clients'); showClient(id); } return; }
  if (kind === 'prospect') { const record = data.prospects.find(item => item.id === id); if (record) { crmView = 'prospects'; route('clients'); showProspect(record); } return; }
  if (kind === 'site') { const record = data.sites.find(item => item.id === id); if (record) { route('chantiers'); showSite(id); } return; }
  if (kind === 'quote') { const record = data.quotes.find(item => item.id === id); if (record) { route('devis'); openQuoteDetails(id); } return; }
  if (kind === 'invoice') {
    const record = data.invoices.find(item => item.id === id); if (!record) return;
    route('finances'); openInvoiceDetails(id); return;
  }
  if (kind === 'purchase') { const record = data.purchases.find(item => item.id === id); if (record) { route('achats'); modal(record.reference || record.supplier, `<div class="detail-card"><p><b>Fournisseur</b><br>${esc(record.supplier)}</p><p><b>Chantier</b><br>${esc(siteLabel(record))}</p><p><b>État</b><br>${esc(record.status)}</p><p><b>Montant engagé HT</b><br>${money(record.amountHT)}</p><p><b>Livraison attendue</b><br>${esc(record.delivery || 'Non précisée')}</p></div>`); } return; }
  if (kind === 'appointment') { const record = data.appointments.find(item => item.id === id); if (record) { route('planning'); modal(record.title, `<div class="detail-card"><p><b>Chantier</b><br>${esc(siteLabel(record))}</p><p><b>Date et heure</b><br>${esc(record.date)} · ${esc(record.time)}</p><p><b>Intervenant</b><br>${esc(record.assignee)}</p><p><b>Note</b><br>${esc(record.note || 'Aucune')}</p></div>`); } return; }
  if (kind === 'document') { const record = data.documents.find(item => item.id === id); if (record) { route('documents'); openAuditedRecord('documents', record); } return; }
  if (kind === 'report') { const record = data.reports.find(item => item.id === id); if (record) { route('rapports'); openAuditedRecord('reports', record); } return; }
  if (kind === 'task') { const record = data.tasks.find(item => item.id === id); if (record) { route('chantiers'); showSite(record.siteId || record.site); } return; }
  if (kind === 'stock') { const record = data.stockItems.find(item => item.id === id); if (record) { route('achats'); modal(record.name, `<div class="detail-card"><p><b>Référence</b><br>${esc(record.reference || 'Non renseignée')}</p><p><b>Unité</b><br>${esc(record.unit)}</p><p><b>Quantité disponible</b><br>${esc(String(stockBalance(record).quantity))} ${esc(record.unit)}</p><p><b>Seuil de réapprovisionnement</b><br>${esc(String(record.reorderAt || 0))} ${esc(record.unit)}</p></div>`); } }
}

const globalSearchInput = $('#global-search');
globalSearchInput?.addEventListener('input', renderGlobalSearchResults);
globalSearchInput?.addEventListener('focus', () => { if (globalSearchInput.value.length >= 2) renderGlobalSearchResults(); });
if (globalSearchInput) globalSearchInput.onkeydown = event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!globalSearchRows.length) return;
    event.preventDefault(); globalSearchActiveIndex = (globalSearchActiveIndex + (event.key === 'ArrowDown' ? 1 : -1) + globalSearchRows.length) % globalSearchRows.length;
    $('#global-search-results')?.querySelectorAll('[role="option"]').forEach((option, index) => { option.setAttribute('aria-selected', String(index === globalSearchActiveIndex)); if (index === globalSearchActiveIndex) option.scrollIntoView({ block: 'nearest' }); });
  } else if (event.key === 'Enter' && globalSearchRows.length) {
    event.preventDefault(); const index = globalSearchActiveIndex < 0 ? 0 : globalSearchActiveIndex; const row = globalSearchRows[index]; openGlobalSearchResult(row.kind, row.id);
  } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hideGlobalSearchResults(); globalSearchInput.blur(); }
};

document.addEventListener('click', event => {
  const result = event.target.closest('[data-global-kind]');
  if (result) { openGlobalSearchResult(result.dataset.globalKind, result.dataset.globalId); return; }
  const shell = event.target.closest('.global-search-shell');
  if (shell && window.matchMedia('(max-width: 780px)').matches && event.target.closest('.search')) {
    shell.classList.add('is-open'); setTimeout(() => $('#global-search')?.focus(), 0); return;
  }
  if (event.target.closest('[data-global-download]')) {
    const record = data.documents.find(item => item.id === event.target.closest('[data-global-download]').dataset.globalDownload);
    if (record) { const link = document.createElement('a'); link.href = record.dataUrl; link.download = record.fileName; link.click(); }
    return;
  }
  if (!shell) hideGlobalSearchResults();
});

route(page);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => notify('Mise en cache hors ligne indisponible sur cet hébergement.')));
}
