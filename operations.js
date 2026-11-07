/* Suivi de chantier local : tâches, pointages et visibilité des coûts. */
function ensureOperationsData() {
  data.tasks ||= [];
  data.timeEntries ||= [];
  data.siteChecklists ||= {};
  data.stockItems ||= [];
  data.stockMovements ||= [];
  data.siteMilestones ||= [];
  data.siteReservations ||= [];
}
ensureOperationsData();

const siteChecklistTemplate = [
  'Accès et consignes du site vérifiés',
  'Matériel et protections nécessaires préparés',
  'Photos avant intervention ajoutées si utiles',
  'Mesures et contrôles consignés dans le rapport',
  'Réserves et suite à donner notées'
];

function siteRecords(collection, site) {
  return (data[collection] || []).filter(item => SSPDomain.recordBelongsToSite(item, site, data.sites));
}

function siteEconomics(site) {
  const acceptedSalesCents = siteRecords('quotes', site)
    .filter(q => q.status === 'Accepté')
    .map(q => q.totals?.totalHTCents ?? Math.round(Number(q.amountHT ?? q.amount ?? 0) * 100));
  const purchaseCommitmentsCents = siteRecords('purchases', site)
    .filter(p => p.status !== 'Annulée')
    .map(p => Math.round(Number(p.amountHT || 0) * 100));
  const paidExpensesCents = siteRecords('expenses', site)
    .filter(e => String(e.status || '').startsWith('Payée'))
    .map(e => Math.round(Number(e.amount || 0) * 100));
  const stockConsumedCents = siteRecords('stockMovements', site)
    .filter(movement => movement.kind === 'sortie')
    .reduce((sum, movement) => sum + Math.round(Number(movement.totalCostHT || 0) * 100), 0);
  const timeEntries = siteRecords('timeEntries', site).map(entry => ({
    minutes: Math.round(Number(entry.hours || 0) * 60),
    hourlyCostCents: entry.hourlyCost === '' || entry.hourlyCost === null || entry.hourlyCost === undefined
      ? null : Math.round(Number(entry.hourlyCost) * 100)
  }));
  try { return SSPDomain.calculateSiteEconomics({ acceptedSalesCents, purchaseCommitmentsCents, paidExpensesCents, stockConsumedCents, timeEntries }); }
  catch { return null; }
}

function siteCostPanel(site) {
  const result = siteEconomics(site);
  if (!result) return '<p class="form-hint">Les chiffres de chantier ne peuvent pas être calculés avec les données présentes.</p>';
  const acceptedCount = siteRecords('quotes', site).filter(q => q.status === 'Accepté').length;
  const laborHours = siteRecords('timeEntries', site).reduce((sum, item) => sum + Number(item.hours || 0), 0);
  return `<div class="op-economics-grid">
    <div><small>Ventes acceptées · HT</small><b>${acceptedCount ? money(result.acceptedSalesCents / 100) : 'Non renseigné'}</b></div>
    <div><small>Achats commandés · engagés</small><b>${money(result.purchaseCommitmentsCents / 100)}</b></div>
    <div><small>Dépenses marquées payées</small><b>${money(result.paidExpensesCents / 100)}</b></div>
    <div><small>Matériel sorti du stock · coût enregistré</small><b>${money(result.stockConsumedCents / 100)}</b></div>
    <div><small>Temps saisi</small><b>${laborHours.toLocaleString('fr-FR')} h</b></div>
    <div><small>Coût des heures</small><b>${result.laborCostsCents === null ? 'Incomplet' : money(result.laborCostsCents / 100)}</b></div>
    <div><small>Marge sur coûts saisis · indicative</small><b>${result.estimatedMarginCents === null ? 'Non calculable' : money(result.estimatedMarginCents / 100)}</b></div>
  </div><p class="form-hint">Estimation locale : seuls les devis acceptés rattachés à ce chantier, les dépenses marquées payées, le matériel sorti et les heures avec coût horaire comptent. Une même facture ou matière enregistrée dans plusieurs rubriques sera comptée plusieurs fois. Ce calcul n’est pas une marge comptable complète.</p>`;
}

function siteTaskList(site) {
  const tasks = siteRecords('tasks', site).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  if (!tasks.length) return '<p class="form-hint">Aucune tâche enregistrée pour ce chantier.</p>';
  return `<div class="op-record-list">${tasks.map(task => `<div class="op-record ${task.status === 'Terminée' ? 'is-done' : ''}">
    <button class="op-check" data-op-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.status === 'Terminée' ? 'Réouvrir' : 'Terminer'} la tâche">${task.status === 'Terminée' ? '✓' : '○'}</button>
    <span><b>${esc(task.title)}</b><small>${esc(task.dueDate || 'Sans échéance')} · ${esc(task.assignee || 'Non affectée')}</small></span>
    <button class="more-button" data-op-action="delete-task" data-id="${esc(task.id)}" aria-label="Supprimer la tâche">×</button>
  </div>`).join('')}</div>`;
}

function siteTimeList(site) {
  const rows = siteRecords('timeEntries', site).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
  if (!rows.length) return '<p class="form-hint">Aucune heure réelle saisie.</p>';
  return `<div class="op-record-list">${rows.map(entry => `<div class="op-record"><span class="op-time-icon">◷</span><span><b>${Number(entry.hours).toLocaleString('fr-FR')} h · ${esc(entry.assignee)}</b><small>${esc(entry.date)} · ${esc(entry.note || 'Sans note')} · ${entry.hourlyCost === '' ? 'coût horaire absent' : `${money(entry.hourlyCost)}/h`}</small></span><button class="more-button" data-op-action="delete-time" data-id="${esc(entry.id)}" aria-label="Supprimer ce pointage">×</button></div>`).join('')}</div>`;
}

function siteChecklist(site) {
  const checked = data.siteChecklists[site.id] || {};
  return `<div class="op-checklist">${siteChecklistTemplate.map((label, index) => `<label class="op-checklist-row"><input type="checkbox" data-op-check="${index}" data-site-id="${esc(site.id)}" ${checked[index] ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div><p class="form-hint">Aide-mémoire local, à adapter à la prestation. Il ne certifie pas la conformité d’une installation.</p>`;
}

function siteMilestoneList(site) {
  const rows = siteRecords('siteMilestones', site).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  if (!rows.length) return '<p class="form-hint">Aucun jalon défini pour ce chantier.</p>';
  return `<div class="op-record-list">${rows.map(row => `<div class="op-record ${row.status === 'Terminé' ? 'is-done' : ''}">
    <button class="op-check" data-op-action="toggle-milestone" data-id="${esc(row.id)}" aria-label="${row.status === 'Terminé' ? 'Réouvrir' : 'Terminer'} le jalon">${row.status === 'Terminé' ? '✓' : '○'}</button>
    <span><b>${esc(row.title)}</b><small>${esc(row.dueDate || 'Sans date')} · ${esc(row.note || 'Aucune note')}</small></span>
    <button class="more-button" data-op-action="delete-milestone" data-id="${esc(row.id)}" aria-label="Supprimer le jalon">×</button>
  </div>`).join('')}</div>`;
}

function siteReservationList(site) {
  const rows = siteRecords('siteReservations', site).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  if (!rows.length) return '<p class="form-hint">Aucune réserve ou observation enregistrée.</p>';
  return `<div class="op-record-list">${rows.map(row => {
    const nextStatus = row.status === 'À traiter' ? 'En cours' : row.status === 'En cours' ? 'Levée' : 'À traiter';
    return `<div class="op-record op-reservation-row ${row.status === 'Levée' ? 'is-done' : ''}">
      <span class="op-reservation-mark" aria-hidden="true">${row.severity === 'Importante' ? '!' : '◇'}</span>
      <span><b>${esc(row.title)} <small class="op-status-chip">${esc(row.status)}</small></b><small>${esc(row.severity)} · ${esc(row.dueDate || 'Sans échéance')} · ${esc(row.assignee || 'Non affectée')}${row.note ? ` · ${esc(row.note)}` : ''}</small></span>
      <button class="btn secondary op-reservation-next" data-op-action="advance-reservation" data-id="${esc(row.id)}" aria-label="Passer la réserve à l’état ${esc(nextStatus)}">${esc(nextStatus)}</button>
      <button class="more-button" data-op-action="delete-reservation" data-id="${esc(row.id)}" aria-label="Supprimer la réserve">×</button>
    </div>`;
  }).join('')}</div>`;
}

function sitePhotoGallery(site) {
  const photos = siteRecords('documents', site).filter(record => !record.archivedAt && record.kind === 'photo' && String(record.dataUrl || '').startsWith('data:image/'));
  const tiles = photos.map(photo => `<button type="button" class="op-photo-tile" data-op-action="view-photo" data-id="${esc(photo.id)}"><img src="${esc(photo.dataUrl)}" alt="${esc(photo.name || 'Photo du chantier')}" loading="lazy"><span>${esc(photo.phase || 'Photo')} · ${esc(photo.date || '')}</span></button>`).join('');
  return `<div class="op-section-head"><h3>Photos · ${photos.length}</h3><button class="btn secondary" data-op-action="new-photo" data-site-id="${esc(site.id)}">＋ Photo</button></div>${tiles ? `<div class="op-photo-gallery">${tiles}</div>` : '<p class="form-hint">Aucune photo enregistrée. Une photo prise ou choisie ici sera conservée uniquement dans ce navigateur.</p>'}`;
}

function openSitePhotoForm(siteId) {
  const site = data.sites.find(item => item.id === siteId);
  if (!site) return notify('Le chantier associé est introuvable.');
  modal('Ajouter une photo', `<form data-site-photo-form data-site-id="${esc(site.id)}"><p class="form-hint">${esc(site.name)} · Sur téléphone, le navigateur pourra proposer l’appareil photo. L’image sera réduite puis enregistrée sur cet appareil uniquement.</p><label>Photo<input name="photo" type="file" accept="image/*" capture="environment" required></label><div class="form-row"><label>Moment<select name="phase"><option>Avant travaux</option><option selected>Pendant travaux</option><option>Après travaux</option><option>Réserve</option></select></label><label>Libellé<input name="caption" maxlength="120" placeholder="Ex. Tableau avant remise en service"></label></div><p class="form-hint">Taille conservée : 700 Ko maximum par photo. Exportez régulièrement vos données ; elles ne sont pas sauvegardées en ligne.</p><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la photo</button></div></form>`);
  $('.cancel').onclick = closeModal;
}

function openSitePhotoDetail(photoId) {
  const photo = data.documents.find(record => record.id === photoId && record.kind === 'photo');
  if (!photo) return;
  window.openAuditedDocumentRecord?.('documents', photo, photo.siteId || data.sites.find(site => site.name === photo.site)?.id || '');
}

async function compressSitePhoto(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Choisissez un fichier image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La photo d’origine dépasse 20 Mo. Choisissez une image plus légère.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Cette image ne peut pas être ouverte par le navigateur.'));
      element.src = objectUrl;
    });
    const largest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!largest) throw new Error('Les dimensions de la photo sont invalides.');
    for (const maxDimension of [1600, 1280, 960]) {
      const scale = Math.min(1, maxDimension / largest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d', { alpha: false })?.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= 700 * 1024) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Lecture de la photo impossible.'));
            reader.readAsDataURL(blob);
          });
          return { dataUrl, size: blob.size, width: canvas.width, height: canvas.height };
        }
      }
    }
    throw new Error('Cette photo ne peut pas être réduite sous 700 Ko. Choisissez une image moins volumineuse.');
  } finally { URL.revokeObjectURL(objectUrl); }
}

function stockBalance(item) {
  const movements = (data.stockMovements || []).filter(row => row.itemId === item.id)
    .sort((a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date)));
  const normalizedMovements = movements.map(movement => ({
    kind: movement.kind,
    quantityMilliunits: Math.round(Number(movement.quantity || 0) * 1000),
    totalCostCents: Math.round(Number(movement.quantity || 0) * Number(movement.unitCostHT || 0) * 100)
  }));
  const result = SSPDomain.calculateStockBalance({
    openingQuantityMilliunits: Math.round(Number(item.openingQuantity || 0) * 1000),
    openingUnitCostCents: Math.round(Number(item.openingUnitCostHT || 0) * 100),
    movements: normalizedMovements
  });
  const movementCosts = new Map(movements.map((movement, index) => [movement.id, result.calculatedMovements[index].costCents / 100]));
  return { quantity: result.quantityMilliunits / 1000, averageUnitCostHT: result.averageUnitCostCents / 100, movementCosts };
}

function stockSection() {
  const rows = data.stockItems.map(item => {
    const balance = stockBalance(item);
    const low = balance.quantity <= Number(item.reorderAt || 0);
    return `<div class="op-stock-row"><div><b>${esc(item.name)}</b><small>${esc(item.reference || 'Sans référence')} · ${esc(item.unit)} · seuil ${Number(item.reorderAt || 0).toLocaleString('fr-FR')}</small></div>
      <strong class="${low ? 'op-stock-low' : ''}">${balance.quantity.toLocaleString('fr-FR')} ${esc(item.unit)}</strong><button class="more-button" data-stock-action="movement" data-id="${esc(item.id)}" aria-label="Enregistrer un mouvement">＋</button></div>`;
  });
  const movementRows = [...data.stockMovements].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10).map(row => {
    const item = data.stockItems.find(item => item.id === row.itemId);
    const cost = row.kind === 'sortie' ? ` · coût ${money(stockBalance(item || {}).movementCosts.get(row.id) ?? row.totalCostHT)}` : ` · achat unitaire ${money(row.unitCostHT)}`;
    return moduleRow(row.kind === 'entrée' ? '＋' : '−', `${row.kind} · ${item?.name || 'Article retiré'}`, `${row.date} · ${Number(row.quantity).toLocaleString('fr-FR')} ${esc(row.unit)}${row.site ? ` · ${esc(row.site)}` : ''}${cost}`);
  });
  return `<section class="panel list-panel"><div class="panel-head"><div><h2>Stock et matériel</h2><p>Quantités locales, sorties rattachées à un chantier et seuil de réapprovisionnement.</p></div><div class="op-stock-actions"><button class="btn secondary" data-module-action="stock-item">＋ Article</button><button class="btn primary" data-module-action="stock-movement" ${data.stockItems.length ? '' : 'disabled'}>＋ Mouvement</button></div></div>
    <div class="op-record-list">${rows.join('') || '<p class="form-hint">Aucun article en stock. Créez un article puis saisissez sa quantité initiale.</p>'}</div>
    <div class="op-section-head"><h3>Derniers mouvements</h3></div>${moduleList(movementRows, 'Aucun mouvement de stock.')}
    <p class="form-hint">Les entrées et sorties sont un registre local. Aucune commande fournisseur n’est envoyée. Les sorties rattachées aux chantiers utilisent le coût moyen calculé depuis les coûts d’achat saisis.</p></section>`;
}

function openStockForm(type, selectedItemId = '') {
  ensureOperationsData();
  if (type === 'stock-item') {
    modal('Nouvel article de stock', `<form data-stock-form="item"><label>Désignation<input name="name" required maxlength="160"></label><div class="form-row"><label>Référence<input name="reference" maxlength="100"></label><label>Unité<input name="unit" required maxlength="24" value="unité"></label></div><div class="form-row"><label>Quantité de départ<input name="openingQuantity" type="number" min="0" step="0.001" value="0" required></label><label>Seuil d’alerte<input name="reorderAt" type="number" min="0" step="0.001" value="0" required></label></div><label>Coût unitaire HT connu (€)<input name="openingUnitCostHT" type="number" min="0" step="0.01" placeholder="Saisir un coût connu"></label><p class="form-hint">Pour un stock initial supérieur à zéro, le coût est nécessaire au calcul des sorties. Saisir 0 indique explicitement un coût nul. Ce catalogue n’est relié à aucun fournisseur.</p><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer l’article</button></div></form>`);
  } else {
    const options = data.stockItems.map(item => `<option value="${esc(item.id)}" ${item.id === selectedItemId ? 'selected' : ''}>${esc(item.name)} · ${stockBalance(item).quantity.toLocaleString('fr-FR')} ${esc(item.unit)}</option>`).join('');
    modal('Mouvement de stock', `<form data-stock-form="movement"><label>Article<select name="itemId" required>${options}</select></label><label>Type de mouvement<select name="kind"><option value="entrée">Réception / entrée</option><option value="sortie">Utilisation / sortie</option></select></label><div class="form-row"><label>Quantité<input name="quantity" type="number" min="0.001" step="0.001" required></label><label>Date<input name="date" type="date" value="${todayISO()}" required></label></div><label>Coût unitaire HT connu (€) pour une entrée<input name="unitCostHT" type="number" min="0" step="0.01" placeholder="Saisir un coût connu"></label><label>Chantier concerné pour une sortie<select name="site"><option value="">Aucun chantier</option>${data.sites.map(site => `<option value="${esc(site.id)}">${esc(site.name)}</option>`).join('')}</select></label><label>Référence / note<input name="note" maxlength="300"></label><p class="form-hint">Une sortie ne peut pas dépasser le stock disponible. Son coût est calculé au coût moyen d’achat connu. Saisir 0 indique explicitement un coût nul. La saisie n’est pas une facture fournisseur ni une preuve de paiement.</p><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer le mouvement</button></div></form>`);
  }
  $('.cancel').onclick = closeModal;
}

function showSite(id) {
  ensureOperationsData();
  const site = data.sites.find(item => item.id === id);
  if (!site) return;
  const docs = siteRecords('documents', site);
  const photos = docs.filter(record => record.kind === 'photo');
  const reports = siteRecords('reports', site);
  const appointments = siteRecords('appointments', site);
  modal(site.name, `<div class="detail-card op-site-detail">
    <div class="op-site-top"><span class="pill neutral">${esc(site.status)}</span><span class="muted-inline">${Number(site.progress) || 0} % indicatif</span></div>
    <p><b>Client</b><br>${esc(site.client || 'Non renseigné')}</p>
    <p><b>Adresse</b><br>${esc(site.address || 'Non renseignée')}</p>
    <p><b>Budget prévisionnel</b><br>${site.budget === null || site.budget === undefined || site.budget === '' ? 'Non renseigné' : `${money(site.budget)} HT · valeur indicative`}</p>
    <div class="op-section-head"><h3>Ventes et coûts</h3></div>${siteCostPanel(site)}
    <div class="op-section-head"><h3>Tâches</h3><button class="btn secondary" data-op-action="new-task" data-site-id="${esc(site.id)}">＋ Tâche</button></div>${siteTaskList(site)}
    <div class="op-section-head"><h3>Temps de travail</h3><button class="btn secondary" data-op-action="new-time" data-site-id="${esc(site.id)}">＋ Pointer</button></div>${siteTimeList(site)}
    ${sitePhotoGallery(site)}
    <div class="op-section-head"><h3>Phases et jalons</h3><button class="btn secondary" data-op-action="new-milestone" data-site-id="${esc(site.id)}">＋ Jalon</button></div>${siteMilestoneList(site)}
    <div class="op-section-head"><h3>Réserves et observations</h3><button class="btn secondary" data-op-action="new-reservation" data-site-id="${esc(site.id)}">＋ Réserve</button></div>${siteReservationList(site)}
    <div class="op-section-head"><h3>Contrôle de fin d’intervention</h3></div>${siteChecklist(site)}
    <div class="op-section-head"><h3>Activité liée</h3></div>
    <p class="form-hint">${appointments.length} intervention(s) · ${docs.length - photos.length} document(s) · ${photos.length} photo(s) · ${reports.length} compte rendu(s). Les fiches complètes sont disponibles dans les rubriques Planning, Documents et Rapports.</p>
    <button class="btn secondary full-btn" data-action="edit-site">Modifier le chantier</button>
  </div>`);
  $('#modal-content').querySelector('[data-action="edit-site"]').onclick = () => { closeModal(); openEditSite(id); };
}

function openOperationForm(type, siteId) {
  ensureOperationsData();
  const site = data.sites.find(item => item.id === siteId);
  if (!site) return notify('Choisissez d’abord un chantier existant.');
  const today = todayISO();
  if (type === 'task') {
    modal('Nouvelle tâche', `<form data-op-form="task" data-site-id="${esc(site.id)}">
      <p class="form-hint">${esc(site.name)}</p><label>Tâche à réaliser<input name="title" required maxlength="180" placeholder="Ex. Relever les références de l’automate"></label>
      <div class="form-row"><label>Échéance<input name="dueDate" type="date"></label><label>Responsable<input name="assignee" maxlength="120" value="Dirigeant"></label></div>
      <label>Note<input name="note" maxlength="500" placeholder="Détail utile à l’intervention"></label>
      <div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la tâche</button></div>
    </form>`);
  } else if (type === 'time') {
    modal('Saisir du temps travaillé', `<form data-op-form="time" data-site-id="${esc(site.id)}">
      <p class="form-hint">${esc(site.name)} · un pointage peut être ajouté après l’intervention.</p>
      <div class="form-row"><label>Date<input name="date" type="date" value="${today}" required></label><label>Durée (heures)<input name="hours" type="number" min="0.01" max="24" step="0.01" required placeholder="Ex. 2,5"></label></div>
      <label>Intervenant<input name="assignee" required maxlength="120" value="Dirigeant"></label>
      <label>Coût horaire interne HT (€) <span class="muted-inline">(facultatif)</span><input name="hourlyCost" type="number" min="0" step="0.01" placeholder="Saisir uniquement un coût connu"></label>
      <label>Travail réalisé / note<input name="note" maxlength="500" placeholder="Ex. Diagnostic et essais GTB"></label>
      <p class="form-hint">Le coût horaire manquant rend la marge sur coûts saisis indisponible dès qu’un pointage n’est pas chiffré.</p>
      <div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer le pointage</button></div>
    </form>`);
  } else if (type === 'milestone') {
    modal('Nouveau jalon', `<form data-op-form="milestone" data-site-id="${esc(site.id)}"><p class="form-hint">${esc(site.name)} · une phase ou un jalon indicatif avec échéance facultative.</p><label>Jalon<input name="title" required maxlength="180" placeholder="Ex. Mise en service du tableau"></label><label>Date prévue<input name="dueDate" type="date"></label><label>Note de suivi<input name="note" maxlength="500" placeholder="Critère de passage ou précision"></label><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer le jalon</button></div></form>`);
  } else {
    modal('Nouvelle réserve ou observation', `<form data-op-form="reservation" data-site-id="${esc(site.id)}"><p class="form-hint">${esc(site.name)} · le suivi ne vaut pas réception contractuelle ni validation technique.</p><label>Réserve / observation<input name="title" required maxlength="180" placeholder="Ex. Étiquetage du circuit à compléter"></label><div class="form-row"><label>Importance<select name="severity"><option>Normale</option><option>Importante</option></select></label><label>Échéance<input name="dueDate" type="date"></label></div><label>Responsable<input name="assignee" maxlength="120" value="Dirigeant"></label><label>Précision<input name="note" maxlength="500"></label><div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la réserve</button></div></form>`);
  }
  $('.cancel').onclick = closeModal;
}

const previousSimplePage = simplePage;
const previousPurchasesPage = purchasesPage;
purchasesPage = function () {
  ensureOperationsData();
  return `${previousPurchasesPage()}${stockSection()}`;
};

simplePage = function () {
  if (page === 'achats') return `${previousPurchasesPage()}${stockSection()}`;
  if (page !== 'finances') return previousSimplePage();
  ensureOperationsData();
  const cards = data.sites.map(site => {
    const result = siteEconomics(site);
    return `<article class="op-profit-card"><div><h3>${esc(site.name)}</h3><p>${esc(site.client || 'Client non renseigné')}</p></div>
      <dl><div><dt>Budget</dt><dd>${site.budget == null || site.budget === '' ? 'Non renseigné' : money(site.budget)}</dd></div>
      <div><dt>Commandes engagées</dt><dd>${money((result?.purchaseCommitmentsCents || 0) / 100)}</dd></div>
      <div><dt>Dépenses payées saisies</dt><dd>${money((result?.paidExpensesCents || 0) / 100)}</dd></div>
      <div><dt>Matériel consommé</dt><dd>${money((result?.stockConsumedCents || 0) / 100)}</dd></div>
      <div><dt>Marge sur coûts saisis</dt><dd>${result?.estimatedMarginCents == null ? 'Non calculable' : money(result.estimatedMarginCents / 100)}</dd></div></dl>
      <button class="btn secondary" data-site="${esc(site.id)}">Détail du chantier</button>
    </article>`;
  }).join('');
  return `${heading('PILOTAGE FINANCIER', 'Finances', 'Consultez séparément les commandes, les dépenses payées, les heures et les ventes acceptées.')}${localNotice}
    <div class="notice"><span class="notice-icon">ⓘ</span><span>Les chiffres ci-dessous viennent des saisies locales. Une commande est un engagement, pas un paiement. Une même matière saisie comme sortie de stock et dépense peut être comptée deux fois. La marge reste partielle et ne remplace pas la comptabilité.</span></div>
    <section class="op-profit-grid">${cards || '<div class="panel">Créez un chantier pour commencer le suivi.</div>'}</section>`;
};

const previousRender = render;
render = function () {
  ensureOperationsData();
  return previousRender();
};

document.addEventListener('click', event => {
  const stockAction = event.target.closest('[data-stock-action]');
  if (stockAction?.dataset.stockAction === 'movement') {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    return openStockForm('stock-movement', stockAction.dataset.id);
  }
  const moduleAction = event.target.closest('[data-module-action="stock-item"], [data-module-action="stock-movement"]');
  if (moduleAction) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    return openStockForm(moduleAction.dataset.moduleAction);
  }
  const action = event.target.closest('[data-op-action]');
  if (action) {
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    const kind = action.dataset.opAction;
    if (kind === 'new-photo') return openSitePhotoForm(action.dataset.siteId);
    if (kind === 'view-photo') return openSitePhotoDetail(action.dataset.id);
    if (kind === 'new-milestone') return openOperationForm('milestone', action.dataset.siteId);
    if (kind === 'new-reservation') return openOperationForm('reservation', action.dataset.siteId);
    if (kind === 'new-task') return openOperationForm('task', action.dataset.siteId);
    if (kind === 'new-time') return openOperationForm('time', action.dataset.siteId);
    if (kind === 'toggle-milestone' || kind === 'delete-milestone') {
      const milestone = data.siteMilestones.find(item => item.id === action.dataset.id);
      if (!milestone) return;
      if (kind === 'toggle-milestone') milestone.status = milestone.status === 'Terminé' ? 'À faire' : 'Terminé';
      else if (!confirm(`Supprimer le jalon « ${milestone.title} » ?`)) return;
      if (kind === 'delete-milestone') data.siteMilestones = data.siteMilestones.filter(item => item.id !== milestone.id);
      if (!save()) return;
      return showSite(milestone.siteId || data.sites.find(site => site.name === milestone.site)?.id);
    }
    if (kind === 'advance-reservation' || kind === 'delete-reservation') {
      const reservation = data.siteReservations.find(item => item.id === action.dataset.id);
      if (!reservation) return;
      if (kind === 'advance-reservation') reservation.status = reservation.status === 'À traiter' ? 'En cours' : reservation.status === 'En cours' ? 'Levée' : 'À traiter';
      else if (!confirm(`Supprimer la réserve « ${reservation.title} » ?`)) return;
      if (kind === 'delete-reservation') data.siteReservations = data.siteReservations.filter(item => item.id !== reservation.id);
      if (!save()) return;
      return showSite(reservation.siteId || data.sites.find(site => site.name === reservation.site)?.id);
    }
    if (kind === 'toggle-task' || kind === 'delete-task') {
      const task = data.tasks.find(item => item.id === action.dataset.id);
      if (!task) return;
      if (kind === 'toggle-task') task.status = task.status === 'Terminée' ? 'À faire' : 'Terminée';
      else if (!confirm(`Supprimer la tâche « ${task.title} » ?`)) return;
      if (kind === 'delete-task') data.tasks = data.tasks.filter(item => item.id !== task.id);
      if (!save()) return;
      return showSite(task.siteId || data.sites.find(site => site.name === task.site)?.id);
    }
    if (kind === 'delete-time') {
      const entry = data.timeEntries.find(item => item.id === action.dataset.id);
      if (!entry || !confirm('Supprimer ce pointage local ?')) return;
      data.timeEntries = data.timeEntries.filter(item => item.id !== entry.id);
      if (!save()) return;
      return showSite(entry.siteId || data.sites.find(site => site.name === entry.site)?.id);
    }
  }
}, true);

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-site-photo-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ensureOperationsData();
  const site = data.sites.find(item => item.id === form.dataset.siteId);
  const file = form.querySelector('[name="photo"]')?.files?.[0];
  if (!site || !file) return notify('Choisissez une photo et vérifiez le chantier associé.');
  const submitButton = form.querySelector('button[type="submit"], button:not([type])');
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Préparation de la photo…'; }
  try {
    const image = await compressSitePhoto(file);
    const caption = form.querySelector('[name="caption"]')?.value.trim() || '';
    const phase = form.querySelector('[name="phase"]')?.value || 'Pendant travaux';
    const safeBase = (caption || file.name.replace(/\.[^.]+$/, '') || 'photo-chantier').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 70) || 'photo-chantier';
    const actor = window.SSPAuth?.getCurrentAccount?.();
    const photo = { id: newId(), kind: 'photo', name: caption || file.name, caption, phase, siteId: site.id, site: site.name, date: todayISO(), fileName: `${safeBase}.jpg`, mime: 'image/jpeg', size: image.size, width: image.width, height: image.height, dataUrl: image.dataUrl, createdAt: new Date().toISOString(), createdBy: actor?.displayName || 'Compte local non identifié', createdById: actor?.id || '', createdByUsername: actor?.username || '' };
    data.documents.unshift(photo);
    window.recordDocumentAudit?.('documents', photo, 'Ajouté');
    if (!save()) { data.documents = data.documents.filter(item => item.id !== photo.id); return; }
    clearFormDraft(form); closeModal(); showSite(site.id); notify('Photo enregistrée sur cet appareil.');
  } catch (error) {
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Enregistrer la photo'; }
    notify(error.message || 'Impossible de préparer cette photo.');
  }
}, true);

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-stock-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ensureOperationsData();
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.stockForm === 'item') {
    const name = values.name.trim();
    const reference = values.reference.trim();
    if (!name) return notify('Saisissez la désignation de l’article.');
    if (reference && data.stockItems.some(item => item.reference.toLowerCase() === reference.toLowerCase())) return notify('Cette référence existe déjà dans le catalogue local.');
    const openingQuantity = Number(values.openingQuantity);
    const openingUnitCostHT = values.openingUnitCostHT === '' ? null : Number(values.openingUnitCostHT);
    const reorderAt = Number(values.reorderAt);
    if (![openingQuantity, reorderAt].every(Number.isFinite) || openingQuantity < 0 || (openingUnitCostHT !== null && (!Number.isFinite(openingUnitCostHT) || openingUnitCostHT < 0)) || reorderAt < 0) return notify('Vérifiez la quantité, le coût et le seuil.');
    if (openingQuantity > 0 && openingUnitCostHT === null) return notify('Saisissez le coût du stock initial, même si vous indiquez 0 €.');
    data.stockItems.unshift({ id: newId(), name, reference, unit: values.unit.trim(), openingQuantity, openingUnitCostHT: Math.round((openingUnitCostHT || 0) * 100) / 100, reorderAt, createdAt: new Date().toISOString() });
  }
  if (form.dataset.stockForm === 'movement') {
    const item = data.stockItems.find(row => row.id === values.itemId);
    const quantity = Number(values.quantity);
    if (!item || !Number.isFinite(quantity) || quantity <= 0) return notify('Choisissez un article et une quantité valides.');
    const balance = stockBalance(item);
    if (values.kind === 'sortie' && quantity > balance.quantity) return notify(`Stock insuffisant : ${balance.quantity.toLocaleString('fr-FR')} ${item.unit} disponible(s).`);
    if (values.kind === 'entrée' && values.unitCostHT === '') return notify('Saisissez le coût unitaire connu, ou 0 si le coût est réellement nul.');
    const unitCostHT = values.kind === 'entrée' ? Number(values.unitCostHT) : balance.averageUnitCostHT;
    if (!Number.isFinite(unitCostHT) || unitCostHT < 0) return notify('Vérifiez le coût unitaire.');
    const totalCostHT = Math.round(quantity * unitCostHT * 100) / 100;
    const linkedSite = values.kind === 'sortie' ? siteFromValue(values.site) : null;
    data.stockMovements.unshift({ id: newId(), itemId: item.id, kind: values.kind, quantity, unit: item.unit, unitCostHT: Math.round(unitCostHT * 100) / 100, totalCostHT, siteId: linkedSite?.id || '', site: linkedSite?.name || '', date: values.date, note: values.note.trim(), createdAt: new Date().toISOString() });
  }
  if (!save()) return;
  closeModal(); render(); notify('Mouvement enregistré sur cet appareil.');
}, true);

document.addEventListener('change', event => {
  const checkbox = event.target.closest('[data-op-check]');
  if (!checkbox) return;
  ensureOperationsData();
  const siteId = checkbox.dataset.siteId;
  data.siteChecklists[siteId] ||= {};
  data.siteChecklists[siteId][checkbox.dataset.opCheck] = checkbox.checked;
  if (!save()) return;
  const site = data.sites.find(item => item.id === siteId);
  if (site) showSite(site.id);
});

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-op-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ensureOperationsData();
  const site = data.sites.find(item => item.id === form.dataset.siteId);
  if (!site) return notify('Le chantier associé est introuvable.');
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.opForm === 'task') {
    const title = values.title.trim();
    if (!title) return notify('Saisissez le nom de la tâche.');
    data.tasks.unshift({ id: newId(), siteId: site.id, site: site.name, title, dueDate: values.dueDate, assignee: values.assignee.trim(), note: values.note.trim(), status: 'À faire', createdAt: new Date().toISOString() });
  }
  if (form.dataset.opForm === 'time') {
    const hours = Number(values.hours);
    const hourlyCost = values.hourlyCost === '' ? null : Number(values.hourlyCost);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 || (hourlyCost !== null && (!Number.isFinite(hourlyCost) || hourlyCost < 0))) return notify('Vérifiez la durée et le coût horaire.');
    data.timeEntries.unshift({ id: newId(), siteId: site.id, site: site.name, date: values.date, hours, assignee: values.assignee.trim(), hourlyCost, note: values.note.trim(), createdAt: new Date().toISOString() });
  }
  if (form.dataset.opForm === 'milestone') {
    const title = values.title.trim();
    if (!title) return notify('Saisissez le nom du jalon.');
    data.siteMilestones.unshift({ id: newId(), siteId: site.id, site: site.name, title, dueDate: values.dueDate || '', note: values.note.trim(), status: 'À faire', createdAt: new Date().toISOString() });
  }
  if (form.dataset.opForm === 'reservation') {
    const title = values.title.trim();
    if (!title) return notify('Saisissez la réserve ou l’observation.');
    data.siteReservations.unshift({ id: newId(), siteId: site.id, site: site.name, title, severity: values.severity === 'Importante' ? 'Importante' : 'Normale', dueDate: values.dueDate || '', assignee: values.assignee.trim(), note: values.note.trim(), status: 'À traiter', createdAt: new Date().toISOString() });
  }
  if (!save()) return;
  closeModal(); showSite(site.id); notify('Enregistré sur cet appareil.');
}, true);

route(page);

// Accueil calculé depuis les saisies locales, sans convertir les estimations en résultats réels.
let dashboardFilters = { period: 'month', siteId: '', client: '', activity: 'Tous', assignee: '' };
const dashboardMonthNumbers = { janv: 1, janvier: 1, févr: 2, fevr: 2, février: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, août: 8, aout: 8, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, déc: 12, dec: 12, décembre: 12, decembre: 12 };

function dashboardISODate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const french = text.match(/^(\d{1,2})\s+([a-zà-ÿ.]+)\s+(\d{4})$/i);
  if (french) {
    const monthName = french[2].toLocaleLowerCase('fr').replace(/\.$/, '');
    const month = dashboardMonthNumbers[monthName] || dashboardMonthNumbers[monthName.slice(0, 4)];
    if (month) return `${french[3]}-${String(month).padStart(2, '0')}-${String(Number(french[1])).padStart(2, '0')}`;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? dashboardISODate(new Date(timestamp)) : '';
}

function dashboardRange(period) {
  const today = dashboardISODate(new Date());
  if (period === 'all') return { start: '', end: '9999-12-31' };
  const start = new Date(`${today}T12:00:00`);
  if (period === 'month') start.setDate(1);
  else start.setDate(start.getDate() - (period === '90days' ? 89 : 29));
  return { start: dashboardISODate(start), end: today };
}

function dashboardRecordSite(record) {
  if (record.siteId) return data.sites.find(site => site.id === record.siteId) || null;
  if (record.site) return data.sites.find(site => site.name === record.site) || null;
  if (record.client) {
    const matches = data.sites.filter(site => site.client === record.client);
    return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function dashboardRecordClient(record) {
  return record.client || dashboardRecordSite(record)?.client || '';
}

function dashboardMatches(record, filters = dashboardFilters) {
  if (filters.siteId) {
    const linked = dashboardRecordSite(record);
    if (!linked || linked.id !== filters.siteId) return false;
  }
  if (filters.client && dashboardRecordClient(record) !== filters.client) return false;
  const range = dashboardRange(filters.period);
  if (range.start) {
    const date = dashboardISODate(record.date || record.createdAt);
    if (!date || date < range.start || date > range.end) return false;
  }
  return true;
}

function dashboardAmountHT(quote) {
  if (quote.totals?.totalHTCents !== undefined) return Number(quote.totals.totalHTCents) / 100;
  return Number(quote.amountHT ?? quote.amount ?? 0) || 0;
}

function dashboardEvents() {
  const today = todayISO();
  const throughDate = new Date(`${today}T12:00:00`); throughDate.setDate(throughDate.getDate() + 7);
  const through = dashboardISODate(throughDate);
  const events = [];
  for (const task of data.tasks || []) {
    if (task.status === 'Terminée' || !task.dueDate || task.dueDate > through) continue;
    const site = dashboardRecordSite(task);
    events.push({ date: task.dueDate, kind: 'Tâche', title: task.title || 'Tâche chantier', detail: `${site?.name || siteLabel(task)}${task.assignee ? ` · ${task.assignee}` : ''}`, siteId: site?.id || '', client: site?.client || '', assignee: task.assignee || '', overdue: task.dueDate < today, page: 'chantiers' });
  }
  for (const followup of data.followups || []) {
    if (followup.status === 'Terminée' || !followup.dueDate || followup.dueDate > through) continue;
    const prospect = data.prospects.find(item => item.id === followup.entityId);
    events.push({ date: followup.dueDate, kind: 'Relance', title: followup.title || `Relancer ${prospect?.name || 'un prospect'}`, detail: followup.note || prospect?.name || 'Prospect', siteId: '', client: prospect?.name || '', assignee: followup.assignee || '', overdue: followup.dueDate < today, page: 'clients' });
  }
  for (const appointment of data.appointments || []) {
    if (['Terminée', 'Annulée'].includes(appointment.status) || !appointment.date || appointment.date < today || appointment.date > through) continue;
    const site = dashboardRecordSite(appointment);
    events.push({ date: appointment.date, kind: 'Intervention', title: appointment.title || 'Intervention', detail: `${appointment.time || 'Heure à préciser'} · ${site?.name || siteLabel(appointment)}${appointment.assignee ? ` · ${appointment.assignee}` : ''}`, siteId: site?.id || '', client: site?.client || '', assignee: appointment.assignee || '', overdue: false, page: 'planning' });
  }
  for (const purchase of data.purchases || []) {
    if (!purchase.delivery || purchase.delivery > through || ['Reçue', 'Annulée'].includes(purchase.status)) continue;
    const site = dashboardRecordSite(purchase);
    events.push({ date: purchase.delivery, kind: 'Livraison', title: purchase.reference || `Commande ${purchase.supplier}`, detail: `${purchase.supplier} · ${site?.name || siteLabel(purchase)}`, siteId: site?.id || '', client: site?.client || '', assignee: '', overdue: purchase.delivery < today, page: 'achats' });
  }
  return events.filter(event => {
    if (dashboardFilters.siteId && event.siteId !== dashboardFilters.siteId) return false;
    if (dashboardFilters.client && event.client !== dashboardFilters.client) return false;
    if (dashboardFilters.activity !== 'Tous' && event.kind !== dashboardFilters.activity) return false;
    if (dashboardFilters.assignee && event.assignee !== dashboardFilters.assignee) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'));
}

dashboard = function () {
  ensureOperationsData();
  const quotes = (data.quotes || []).filter(quote => dashboardMatches(quote));
  const followQuotes = quotes.filter(quote => ['À envoyer', 'Envoyé'].includes(quote.status));
  const acceptedQuotes = quotes.filter(quote => quote.status === 'Accepté');
  const payments = (data.payments || []).filter(payment => {
    const invoice = data.invoices.find(item => item.id === payment.invoiceId) || {};
    return dashboardMatches({ ...payment, client: invoice.client, siteId: invoice.siteId, site: invoice.site });
  });
  const purchases = (data.purchases || []).filter(purchase => purchase.status !== 'Annulée' && dashboardMatches(purchase));
  const expenses = (data.expenses || []).filter(expense => String(expense.status || '').startsWith('Payée') && dashboardMatches(expense));
  const hours = (data.timeEntries || []).filter(entry => dashboardMatches(entry) && (!dashboardFilters.assignee || entry.assignee === dashboardFilters.assignee));
  const sites = (data.sites || []).filter(site => (!dashboardFilters.siteId || site.id === dashboardFilters.siteId) && (!dashboardFilters.client || site.client === dashboardFilters.client));
  const activeSites = sites.filter(site => !['Terminé', 'Terminée', 'Archivé', 'Annulé', 'Annulée'].includes(site.status));
  const blockedSites = activeSites.filter(site => ['Bloqué', 'En attente de matériel', 'En attente du client'].includes(site.status));
  const followAmount = followQuotes.reduce((sum, quote) => sum + dashboardAmountHT(quote), 0);
  const acceptedAmount = acceptedQuotes.reduce((sum, quote) => sum + dashboardAmountHT(quote), 0);
  const paymentAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const purchaseAmount = purchases.reduce((sum, purchase) => sum + Number(purchase.amountHT || 0), 0);
  const paidExpenseAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const hourCount = hours.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const undatedPurchases = (data.purchases || []).filter(purchase => purchase.status !== 'Annulée' && !dashboardISODate(purchase.date || purchase.createdAt)).length;
  const activity = dashboardEvents();
  const events = activity.slice(0, 8).map(item => `<a class="dashboard-event ${item.overdue ? 'is-overdue' : ''}" href="#${item.page}" data-page="${item.page}"><span class="dashboard-event-date">${esc(dashboardDisplayDate(item.date))}${item.overdue ? '<small>En retard</small>' : ''}</span><span class="dashboard-event-main"><b>${esc(item.title)}</b><small>${esc(item.kind)} · ${esc(item.detail)}</small></span><span class="row-arrow">→</span></a>`).join('');
  const today = dashboardISODate(new Date());
  const todayItems = activity.filter(item => item.date === today || item.overdue).sort((a, b) => Number(a.overdue) - Number(b.overdue) || (a.overdue ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.title.localeCompare(b.title, 'fr')).slice(0, 5);
  const todayRows = todayItems.map(item => `<a class="dashboard-day-item ${item.overdue ? 'is-overdue' : ''}" href="#${item.page}" data-page="${item.page}"><span class="dashboard-day-kind">${item.overdue ? 'En retard' : esc(item.kind)}</span><span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><span aria-hidden="true">→</span></a>`).join('');
  const todayPanel = `<section class="panel dashboard-today" aria-labelledby="dashboard-today-title"><div class="panel-head"><div><p class="eyebrow">AUJOURD’HUI · ${esc(dashboardDisplayDate(today))}</p><h2 id="dashboard-today-title">Ma journée</h2><p>${todayItems.length ? `${todayItems.length} priorité(s) du jour ou en retard` : 'Rien d’urgent à afficher.'}</p></div><button class="btn secondary" data-module-action="appointment">＋ Intervention</button></div><div class="dashboard-day-list">${todayRows || '<div class="empty-state">Aucune intervention ou tâche pour aujourd’hui.</div>'}</div><div class="dashboard-day-actions"><button class="btn secondary" data-action="quick-task">＋ Tâche</button><button class="btn secondary" data-action="quick-document">＋ Document</button><button class="btn secondary" data-action="quick-report">＋ Rapport</button></div></section>`;
  const siteRows = activeSites.slice().sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0)).slice(0, 5).map(siteRow).join('');
  const recentQuotes = quotes.slice().sort((a, b) => dashboardISODate(b.date).localeCompare(dashboardISODate(a.date))).slice(0, 4);
  const quoteRows = recentQuotes.map(quote => `<div class="quote-line"><span class="doc-icon">▤</span><span class="quote-name"><b>${esc(quote.title)}</b><small>${esc(quote.client)} · ${esc(quote.id)}</small></span><span class="quote-status ${statusClass(quote.status)}">${esc(quote.status)}</span><strong>${money(dashboardAmountHT(quote))} HT</strong></div>`).join('');
  const people = [...new Set([...(data.appointments || []), ...(data.tasks || []), ...(data.timeEntries || [])].map(item => String(item.assignee || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const periodOptions = [['month', 'Mois en cours'], ['30days', '30 derniers jours'], ['90days', '90 derniers jours'], ['all', 'Toute période']].map(([value, label]) => `<option value="${value}" ${dashboardFilters.period === value ? 'selected' : ''}>${label}</option>`).join('');
  const siteOptionsHtml = `<option value="">Tous les chantiers</option>${(data.sites || []).map(site => `<option value="${esc(site.id)}" ${dashboardFilters.siteId === site.id ? 'selected' : ''}>${esc(site.name)}</option>`).join('')}`;
  const clientOptionsHtml = `<option value="">Tous les clients</option>${(data.clients || []).map(client => `<option value="${esc(client.name)}" ${dashboardFilters.client === client.name ? 'selected' : ''}>${esc(client.name)}</option>`).join('')}`;
  const personOptions = `<option value="">Toutes les personnes</option>${people.map(person => `<option value="${esc(person)}" ${dashboardFilters.assignee === person ? 'selected' : ''}>${esc(person)}</option>`).join('')}`;
  const activityOptions = ['Tous', 'Intervention', 'Tâche', 'Livraison', 'Relance'].map(value => `<option ${dashboardFilters.activity === value ? 'selected' : ''}>${value}</option>`).join('');
  const periodLabel = { month: 'mois en cours', '30days': '30 derniers jours', '90days': '90 derniers jours', all: 'toute période' }[dashboardFilters.period];
  const card = (label, value, note, pageName, icon, tone) => `<article class="metric-card"><div class="metric-label">${label}<span class="metric-symbol ${tone}">${iconSvg(icon)}</span></div><strong>${value}</strong><div class="metric-note">${note}</div><a href="#${pageName}" data-page="${pageName}">Voir le détail <span>→</span></a></article>`;
  return `${heading('PILOTAGE DE L’ENTREPRISE', `Bonjour, ${esc(data.settings?.companyName || 'dirigeant')} <span class="wave">✦</span>`, `Synthèse issue des saisies locales · ${esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()))}`, `<button class="btn primary" data-action="quick-add"><span>＋</span> Nouvelle action</button>`)}
    <div class="notice"><span class="notice-icon">ⓘ</span><span><b>Les montants reflètent uniquement les données présentes sur cet appareil.</b> Les paiements sont saisis manuellement ; les achats engagés ne sont pas des règlements. Les exemples de départ sont fictifs.</span></div>
    <section class="dashboard-filter-panel" aria-label="Filtres du tableau de bord"><label>Période<select data-dashboard-filter="period">${periodOptions}</select></label><label>Chantier<select data-dashboard-filter="siteId">${siteOptionsHtml}</select></label><label>Client<select data-dashboard-filter="client">${clientOptionsHtml}</select></label><label>Personne<select data-dashboard-filter="assignee">${personOptions}</select></label><label>Rappels<select data-dashboard-filter="activity">${activityOptions}</select></label><p class="dashboard-filter-note">Personne et Rappels filtrent les heures affectées et les échéances. Période, chantier et client filtrent les autres indicateurs selon les liens disponibles.</p></section>
    ${todayPanel}
    <div class="section-title"><div><h2>Vue d’ensemble</h2><p>Indicateurs filtrés · ${periodLabel}</p></div><span class="pill neutral">${activeSites.length} chantier(s) actif(s)${blockedSites.length ? ` · ${blockedSites.length} à surveiller` : ''}</span></div>
    <div class="metric-grid dashboard-metrics">${card('Devis à suivre', String(followQuotes.length), `${money(followAmount)} HT indicatifs`, 'devis', '▤', 'purple')}${card('Devis acceptés', String(acceptedQuotes.length), `${money(acceptedAmount)} HT · ne signifie ni facturé ni encaissé`, 'devis', '✓', 'green')}${card('Règlements saisis', money(paymentAmount), 'Saisies manuelles · pas de connexion bancaire', 'finances', '€', 'cyan')}${card('Achats engagés', money(purchaseAmount), `HT · non assimilés à un paiement${dashboardFilters.period === 'all' && undatedPurchases ? ` · ${undatedPurchases} commande(s) sans date` : dashboardFilters.period !== 'all' && undatedPurchases ? ` · ${undatedPurchases} commande(s) sans date exclue(s)` : ''}`, 'achats', '▧', 'orange')}${card('Dépenses payées', money(paidExpenseAmount), 'Selon le statut renseigné · justificatifs à contrôler', 'finances', '◒', 'orange')}${card('Heures saisies', `${hourCount.toLocaleString('fr-FR')} h`, `${hours.length} pointage(s) avec filtres de période et d’intervenant`, 'chantiers', '◷', 'green')}</div>
    <div class="content-grid dashboard-content-grid"><section class="panel"><div class="panel-head"><div><h2>Échéances à surveiller</h2><p>Retards et événements prévus dans les 7 jours · filtre Rappels</p></div><button class="text-link" data-module-action="notifications">Centre de rappels →</button></div><div class="dashboard-event-list">${events || '<div class="empty-state">Aucune échéance correspondante.</div>'}</div></section><section class="panel"><div class="panel-head"><div><h2>Chantiers actifs</h2><p>État actuel · non limité par la période</p></div><a href="#chantiers" data-page="chantiers" class="text-link">Tout voir →</a></div><div class="site-list">${siteRows || '<div class="empty-state">Aucun chantier actif pour ces filtres.</div>'}</div></section></div>
    <section class="panel dashboard-quotes-panel"><div class="panel-head"><div><h2>Activité devis</h2><p>Montants HT calculés à partir des devis affichés ; aucune somme ne constitue un encaissement.</p></div><a href="#devis" data-page="devis" class="text-link">Devis & factures →</a></div><div class="quote-preview">${quoteRows || '<div class="empty-state">Aucun devis dans cette période et ces filtres.</div>'}</div></section>`;
};

function dashboardDisplayDate(value) {
  const date = dashboardISODate(value);
  return date ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`)).replace(/\.$/, '') : 'Date inconnue';
}

document.addEventListener('change', event => {
  const select = event.target.closest('[data-dashboard-filter]');
  if (!select || page !== 'accueil') return;
  dashboardFilters[select.dataset.dashboardFilter] = select.value;
  render();
}, true);

render();
