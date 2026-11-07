const QUOTE_VAT_RATES_FR = [20, 10, 5.5, 0];

function quoteLineHtml(line = {}, index = 0) {
  const moneyValue = key => line[key] === null || line[key] === undefined ? '' : String(line[key]);
  return `<article class="quote-editor-line" data-quote-line>
    <div class="quote-line-head"><b>Lot / ligne ${index + 1}</b><button type="button" class="btn danger" data-quote-action="remove-line">Retirer</button></div>
    <label class="quote-description">Description<input data-field="description" required maxlength="180" value="${esc(line.description || '')}" placeholder="Ex. Fourniture et pose d’un disjoncteur"></label>
    <div class="quote-input-grid">
      <label>Quantité<input data-field="quantity" type="number" min="0.01" step="0.01" required value="${esc(line.quantity ?? '1')}"></label>
      <label>Unité<select data-field="unit">${['unité','heure','forfait','m','m²','jour','lot'].map(unit => `<option ${line.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select></label>
      <label>Vente unitaire HT (€)<input data-field="unitPriceHT" type="number" min="0" step="0.01" required value="${esc(moneyValue('unitPriceHT'))}" placeholder="0,00"></label>
      <label>Coût matériel / unité HT (€)<input data-field="materialUnitCostHT" type="number" min="0" step="0.01" required value="${esc(moneyValue('materialUnitCostHT'))}" placeholder="0 si aucun"></label>
      <label>Heures / unité<input data-field="hoursPerUnit" type="number" min="0" step="0.01" required value="${esc(moneyValue('hoursPerUnit'))}" placeholder="0 si aucune"></label>
      <label>Coût horaire direct HT (€)<input data-field="hourlyCostHT" type="number" min="0" step="0.01" required value="${esc(moneyValue('hourlyCostHT'))}" placeholder="0 si aucun"></label>
      <label>Autres coûts directs / unité HT (€)<input data-field="otherUnitCostHT" type="number" min="0" step="0.01" value="${esc(line.otherUnitCostHT ?? '0')}" placeholder="0"></label>
      <label>Remise sur ligne (%)<input data-field="discountPercent" type="number" min="0" max="100" step="0.01" value="${esc(line.discountPercent ?? '0')}"></label>
      <label>TVA de la ligne<select data-field="vatRate">${QUOTE_VAT_RATES_FR.map(rate => `<option value="${rate}" ${Number(line.vatRate ?? 20) === rate ? 'selected' : ''}>${String(rate).replace('.', ',')} %${rate === 0 ? ' — à vérifier' : ''}</option>`).join('')}</select></label>
    </div>
  </article>`;
}

function quoteRows(form) {
  return [...form.querySelectorAll('[data-quote-line]')].map(row => {
    const value = key => row.querySelector(`[data-field="${key}"]`)?.value ?? '';
    const optionalNumber = key => value(key) === '' ? null : Number(value(key));
    return {
      description: value('description'), quantity: optionalNumber('quantity'), unit: value('unit'),
      unitPriceHT: optionalNumber('unitPriceHT'), materialUnitCostHT: optionalNumber('materialUnitCostHT'),
      hoursPerUnit: optionalNumber('hoursPerUnit'), hourlyCostHT: optionalNumber('hourlyCostHT'),
      otherUnitCostHT: optionalNumber('otherUnitCostHT'), discountPercent: optionalNumber('discountPercent'),
      vatRate: optionalNumber('vatRate')
    };
  });
}

function renderQuoteCalculation(form) {
  const target = form.querySelector('[data-quote-summary]');
  if (!target) return;
  try {
    const result = SSPDomain.calculateQuote(quoteRows(form));
    const vatRows = Object.entries(result.vatByRateCents).map(([rate, cents]) => `<div class="quote-total-row"><span>TVA ${esc(rate.replace('.', ','))} %</span><b>${money(cents / 100)}</b></div>`).join('');
    const marginMarkup = result.costsComplete
      ? `<div class="quote-total-row"><span>Coûts directs estimés</span><b>${money(result.directCostsCents / 100)}</b></div><div class="quote-total-row"><span>Marge brute estimée</span><b>${money(result.marginCents / 100)}</b></div><div class="quote-total-row"><span>Taux de marge (marge / coûts)</span><b>${result.marginRateOnCostPct === null ? 'Non calculable' : `${result.marginRateOnCostPct.toLocaleString('fr-FR')} %`}</b></div><div class="quote-total-row"><span>Taux de marque (marge / vente HT)</span><b>${result.marginRateOnSalePct === null ? 'Non calculable' : `${result.marginRateOnSalePct.toLocaleString('fr-FR')} %`}</b></div><div class="quote-total-row"><span>Coefficient vente / coût</span><b>${result.markupCoefficient === null ? 'Non calculable' : result.markupCoefficient.toLocaleString('fr-FR')}</b></div>`
      : `<p class="form-hint">Marge non calculée : renseignez le coût matériel, les heures et le coût horaire de chaque ligne. Un coût nul doit être saisi explicitement.</p>`;
    target.innerHTML = `<div class="quote-totals"><div class="quote-total-row"><span>Total HT</span><b>${money(result.totalHTCents / 100)}</b></div>${vatRows}<div class="quote-total-row quote-total-strong"><span>Total TTC indicatif</span><b>${money(result.totalTTCCents / 100)}</b></div>${marginMarkup}</div>`;
    target.dataset.result = JSON.stringify(result);
  } catch (error) {
    target.innerHTML = `<p class="form-hint">Complétez la description, la quantité et le prix de vente HT pour afficher le total. ${esc(error.message)}</p>`;
    delete target.dataset.result;
  }
}

function openQuoteForm(sourceId = '') {
  if (data.settings.country !== 'FR') {
    return modal('TVA non configurée', `<div class="detail-card"><p>Le calcul de TVA suisse n’est pas configuré dans cette version. Les taux français ne seront pas appliqués à un dossier suisse.</p><p>Revenez au réglage France pour créer un devis de démonstration, ou attendez la configuration fiscale validée pour la Suisse.</p></div>`);
  }
  const source = data.quotes.find(q => q.id === sourceId);
  const sourceLines = source?.lines?.length ? source.lines.map(line => ({
    description: line.description, quantity: line.quantity, unit: line.unit,
    unitPriceHT: line.unitPriceHTCents !== undefined ? line.unitPriceHTCents / 100 : line.unitPriceHT,
    materialUnitCostHT: line.materialUnitCostHTCents !== undefined ? line.materialUnitCostHTCents / 100 : line.materialUnitCostHT,
    hoursPerUnit: line.hoursPerUnit,
    hourlyCostHT: line.hourlyCostHTCents !== undefined ? line.hourlyCostHTCents / 100 : line.hourlyCostHT,
    otherUnitCostHT: line.otherUnitCostHTCents !== undefined ? line.otherUnitCostHTCents / 100 : line.otherUnitCostHT,
    discountPercent: line.discountPercent, vatRate: line.vatRate
  })) : source ? [{
    description: source.title, quantity: 1, unit: 'forfait', unitPriceHT: source.amountHT ?? source.amount,
    materialUnitCostHT: '', hoursPerUnit: '', hourlyCostHT: '', otherUnitCostHT: 0,
    discountPercent: 0, vatRate: source.vat ?? 20
  }] : [{ description: '', quantity: 1, unit: 'unité', unitPriceHT: '', materialUnitCostHT: '', hoursPerUnit: '', hourlyCostHT: '', otherUnitCostHT: 0, discountPercent: 0, vatRate: 20 }];
  const formTitle = source ? `Nouvelle version du devis ${source.reference || source.id}` : 'Nouveau devis détaillé';
  modal(formTitle, `<form data-quote-form data-source-id="${esc(sourceId)}">
    <label>Objet du devis<input name="title" required maxlength="180" value="${esc(source ? source.title : '')}" placeholder="Ex. Rénovation électrique d’un local"></label>
    <label>Client<select name="client" required>${clientOptions(source?.client)}</select></label>
    <label>Chantier associé <span class="muted-inline">(facultatif)</span><select name="site"><option value="">À rattacher plus tard</option>${siteOptions(source?.siteId || source?.site || '')}</select></label>
    <div class="form-row"><label>Date du devis<input name="quoteDate" type="date" required value="${todayISO()}"></label><label>Validité (jours)<input name="validityDays" type="number" min="1" max="365" value="30" required></label></div>
    <p class="form-hint">Les taux français proposés sont à confirmer selon le logement, la nature des travaux et les justificatifs. Le calcul ne valide pas l’éligibilité fiscale.</p>
    <div class="pricebook-picker"><label>Ajouter depuis la bibliothèque<select id="pricebook-picker"><option value="">Choisir une prestation enregistrée</option>${(data.pricebook || []).map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${item.unitPriceHT === null || item.unitPriceHT === '' ? 'prix à configurer' : `${money(item.unitPriceHT)} HT`}</option>`).join('')}</select></label><button type="button" class="btn secondary" data-quote-action="add-pricebook-line">Ajouter la prestation</button></div>
    <div class="quote-editor-heading"><h3>Lignes et coûts estimés</h3><button type="button" class="btn secondary" data-quote-action="add-line">＋ Ajouter une ligne</button></div>
    <div class="quote-editor-lines" data-quote-lines>${sourceLines.map((line, index) => quoteLineHtml(line, index)).join('')}</div>
    <div class="quote-summary" data-quote-summary></div>
    <p class="form-hint">Formules utilisées : marge brute = vente HT − coûts directs estimés ; taux de marge = marge / coût ; taux de marque = marge / vente HT. Les frais généraux et coûts non saisis ne sont pas inclus.</p>
    <div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer le brouillon</button></div>
  </form>`);
  const form = document.querySelector('[data-quote-form]');
  form.addEventListener('input', () => renderQuoteCalculation(form));
  form.addEventListener('change', () => renderQuoteCalculation(form));
  $('.cancel').onclick = closeModal;
  renderQuoteCalculation(form);
}

function quoteListAmount(quote, key) {
  const cents = quote.totals?.[key === 'HT' ? 'totalHTCents' : 'totalTTCCents'];
  return cents === undefined ? Number(key === 'HT' ? quote.amountHT ?? quote.amount : quote.amountTTC ?? quote.amount) : cents / 100;
}

function openQuotePrint(id) {
  const quote = data.quotes.find(item => item.id === id);
  if (!quote) return;
  const rows = (quote.lines || []).map(line => `<tr>
    <td>${esc(line.description)}</td><td class="number">${Number(line.quantity).toLocaleString('fr-FR')}</td>
    <td>${esc(line.unit || 'unité')}</td><td class="number">${money((line.unitPriceHTCents ?? 0) / 100)}</td>
    <td class="number">${Number(line.discountPercent || 0).toLocaleString('fr-FR')} %</td>
    <td class="number">${Number(line.vatRate || 0).toLocaleString('fr-FR')} %</td>
    <td class="number">${money((line.totalHTCents ?? 0) / 100)}</td></tr>`).join('');
  const vatRows = Object.entries(quote.totals?.vatByRateCents || {}).map(([rate, cents]) => `<div><span>TVA ${esc(rate.replace('.', ','))} %</span><b>${money(cents / 100)}</b></div>`).join('');
  const signature = quote.signatureDataUrl ? `<section class="quote-print-signature"><h2>Accord enregistré localement</h2><p>Signature tracée de ${esc(quote.signatureName || 'signataire')} · ${esc(quote.signatureAt ? new Date(quote.signatureAt).toLocaleString('fr-FR') : '')}</p><img src="${esc(quote.signatureDataUrl)}" alt="Signature tracée"></section>` : '';
  const company = esc(data.settings?.companyName || 'Mon entreprise');
  modal(`Aperçu du devis · ${quote.reference || quote.id}`, `<div id="quote-print-document" class="quote-print-document">
    <header><div><div class="brand">${company}</div><h1>Devis brouillon</h1><div class="muted">${esc(quote.title)}</div></div><div class="muted"><b>Référence locale</b><br>${esc(quote.reference || quote.id)} · version ${Number(quote.version) || 1}<br><b>Date</b> · ${esc(quote.quoteDate || quote.date || '')}<br><b>Valable jusqu’au</b> · ${esc(quote.validUntil || 'non précisée')}</div></header>
    <div class="draft">BROUILLON DE DÉMONSTRATION — ne pas envoyer comme document contractuel ou facture conforme</div>
    <h2>Destinataire et chantier</h2><div class="muted"><b>Client :</b> ${esc(quote.client)}<br><b>Chantier :</b> ${esc(quote.siteId ? siteLabel(quote) : quote.site || 'Non précisé')}</div>
    <table><thead><tr><th>Désignation</th><th class="number">Qté</th><th>Unité</th><th class="number">PU HT</th><th class="number">Remise</th><th class="number">TVA</th><th class="number">Total HT</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals"><div><span>Total HT</span><b>${money(quoteListAmount(quote, 'HT'))}</b></div>${vatRows}<div class="grand"><span>Total TTC indicatif</span><b>${money(quoteListAmount(quote, 'TTC'))}</b></div></div>
    ${signature}<footer>Document généré localement pour prévisualisation. Les coordonnées complètes de l’entreprise et du client, les mentions légales, les conditions de vente et la validation du taux de TVA restent à vérifier. La référence n’est pas une numérotation définitive. ${quote.signatureDataUrl ? 'La signature est une trace locale non vérifiée et ne constitue pas une signature électronique certifiée.' : 'Aucune signature ni transmission n’est réalisée.'}</footer>
  </div><p class="form-hint print-help">Utilisez l’action d’impression pour enregistrer ce brouillon en PDF. Les coûts et la marge internes ne sont pas inclus dans le document.</p><div class="form-actions print-controls"><button class="btn secondary" data-quote-action="print-back" data-id="${esc(quote.id)}">Retour au devis</button><button class="btn primary" data-quote-action="print-now">Imprimer / enregistrer en PDF</button></div>`);
}

function openPricebookManager() {
  const rows = (data.pricebook || []).map(item => `<div class="pricebook-row"><span><b>${esc(item.name)}</b><small>${esc(item.category)} · ${esc(item.unit)} · ${item.unitPriceHT === null || item.unitPriceHT === '' ? 'Prix HT à configurer' : `${money(item.unitPriceHT)} HT`}</small></span><button class="btn secondary" data-quote-action="pricebook-edit" data-id="${esc(item.id)}">Modifier</button><button class="btn danger" data-quote-action="pricebook-delete" data-id="${esc(item.id)}" aria-label="Supprimer ${esc(item.name)}">×</button></div>`).join('');
  modal('Bibliothèque de prestations', `<div class="detail-card"><p class="form-hint">Les prix sont à renseigner et à vérifier par votre entreprise. Aucun tarif de marché n’a été inventé. Les modifications n’altèrent pas les devis déjà enregistrés.</p><div class="pricebook-list">${rows || '<p>Aucune prestation enregistrée.</p>'}</div><button class="btn primary full-btn" data-quote-action="pricebook-new">＋ Ajouter une prestation</button></div>`);
}

function openPricebookForm(id = '') {
  const item = (data.pricebook || []).find(row => row.id === id);
  modal(item ? 'Modifier la prestation' : 'Nouvelle prestation', `<form data-pricebook-form data-id="${esc(item?.id || '')}">
    <label>Nom de la prestation<input name="name" required maxlength="180" value="${esc(item?.name || '')}"></label>
    <label>Catégorie<input name="category" maxlength="80" value="${esc(item?.category || '')}" placeholder="Ex. Dépannage, GTB/GTC"></label>
    <div class="form-row"><label>Unité<select name="unit">${['unité','heure','forfait','m','m²','jour','lot'].map(unit => `<option ${item?.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select></label><label>TVA proposée (%)<select name="vatRate">${QUOTE_VAT_RATES_FR.map(rate => `<option value="${rate}" ${Number(item?.vatRate ?? 20) === rate ? 'selected' : ''}>${String(rate).replace('.', ',')} %</option>`).join('')}</select></label></div>
    <div class="form-row"><label>Prix de vente HT<input name="unitPriceHT" type="number" min="0" step="0.01" value="${esc(item?.unitPriceHT ?? '')}" placeholder="À renseigner"></label><label>Coût matériel HT<input name="materialUnitCostHT" type="number" min="0" step="0.01" value="${esc(item?.materialUnitCostHT ?? '')}" placeholder="À renseigner"></label></div>
    <div class="form-row"><label>Heures de main-d’œuvre<input name="hoursPerUnit" type="number" min="0" step="0.01" value="${esc(item?.hoursPerUnit ?? '')}" placeholder="À renseigner"></label><label>Coût horaire HT<input name="hourlyCostHT" type="number" min="0" step="0.01" value="${esc(item?.hourlyCostHT ?? '')}" placeholder="À renseigner"></label></div>
    <label>Autres coûts directs HT<input name="otherUnitCostHT" type="number" min="0" step="0.01" value="${esc(item?.otherUnitCostHT ?? 0)}"></label>
    <p class="form-hint">Un coût laissé vide reste inconnu. Un coût nul doit être saisi explicitement. Vérifiez le taux de TVA avant de transmettre un devis.</p>
    <div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la prestation</button></div>
  </form>`);
  $('.cancel').onclick = openPricebookManager;
}

function quotesPage() {
  const drafts = data.quotes.filter(q => ['Brouillon', 'Brouillon local', 'À envoyer'].includes(q.status)).length;
  const actions = `<button class="btn secondary" data-quote-action="pricebook-manager">Bibliothèque de prestations</button> <button class="btn primary" data-quote-action="new">＋ Nouveau devis</button>`;
  return `${heading('GESTION COMMERCIALE', 'Devis & factures', 'Chiffrez chaque ligne et gardez les coûts estimés visibles.', actions)}<div class="notice"><span class="notice-icon">ⓘ</span><span>Un aperçu imprimable permet d’enregistrer un PDF de brouillon. Il ne constitue pas un devis conforme. Une signature tracée peut être recueillie localement, sans vérification ni certification. L’envoi et la numérotation définitive ne sont pas disponibles.</span></div><div class="metric-grid compact-metrics"><article class="metric-card"><div class="metric-label">Brouillons</div><strong>${drafts}</strong><div class="metric-note">À relire avant toute communication</div></article><article class="metric-card"><div class="metric-label">Acceptés · saisie manuelle ou signature locale</div><strong>${data.quotes.filter(q => q.status === 'Accepté').length}</strong><div class="metric-note">La signature tracée est conservée sur cet appareil</div></article><article class="metric-card"><div class="metric-label">Versions conservées</div><strong>${data.quotes.filter(q => q.version > 1).length}</strong><div class="metric-note">Versions précédentes non écrasées</div></article></div><section class="panel"><div class="panel-head"><div><h2>Historique des devis</h2><p>Montants d’exemples ou calculs de brouillon.</p></div><span class="pill neutral">${data.quotes.length} devis</span></div><div class="quote-preview">${data.quotes.map(q => `<div class="quote-line"><span class="doc-icon">▤</span><span class="quote-name"><b>${esc(q.title)}</b><small>${esc(q.client)} · ${esc(q.reference || q.id)} · V${q.version || 1} · ${esc(q.date || q.quoteDate || '')}</small></span><span class="quote-status ${statusClass(q.status)}">${esc(q.status)}</span><strong>${money(quoteListAmount(q, 'TTC'))}</strong><button class="more-button" data-quote="${esc(q.id)}" aria-label="Ouvrir le devis ${esc(q.title)}">···</button></div>`).join('') || '<div class="empty-state">Aucun devis. Créez un brouillon détaillé.</div>'}</div></section>`;
}

function openQuoteDetails(id) {
  const q = data.quotes.find(x => x.id === id); if (!q) return;
  const linkedSite = siteFromValue(q.siteId || q.site);
  const totals = q.totals;
  const lines = q.lines?.length ? q.lines.map(line => `<div class="detail-line"><b>${esc(line.description)}</b><span>${esc(String(line.quantity))} ${esc(line.unit)} × ${money((line.unitPriceHTCents ?? Math.round((line.unitPriceHT || 0) * 100)) / 100)} HT · TVA ${esc(String(line.vatRate).replace('.', ','))} %</span><strong>${money((line.totalHTCents ?? 0) / 100)} HT</strong></div>`).join('') : `<p class="form-hint">Devis d’exemple ancien : le détail des lignes et coûts n’est pas disponible.</p>`;
  const vatRows = totals ? Object.entries(totals.vatByRateCents).map(([rate, cents]) => `<div class="quote-total-row"><span>TVA ${esc(rate.replace('.', ','))} %</span><b>${money(cents / 100)}</b></div>`).join('') : '';
  const margin = totals?.costsComplete ? `<div class="quote-total-row"><span>Coûts directs estimés</span><b>${money(totals.directCostsCents / 100)}</b></div><div class="quote-total-row"><span>Marge brute estimée</span><b>${money(totals.marginCents / 100)}</b></div><div class="quote-total-row"><span>Taux de marge (marge / coût)</span><b>${totals.marginRateOnCostPct === null ? 'Non calculable' : `${totals.marginRateOnCostPct.toLocaleString('fr-FR')} %`}</b></div><div class="quote-total-row"><span>Taux de marque (marge / vente HT)</span><b>${totals.marginRateOnSalePct === null ? 'Non calculable' : `${totals.marginRateOnSalePct.toLocaleString('fr-FR')} %`}</b></div><div class="quote-total-row"><span>Coefficient vente / coût</span><b>${totals.markupCoefficient === null ? 'Non calculable' : totals.markupCoefficient.toLocaleString('fr-FR')}</b></div>` : '<p class="form-hint">Marge indisponible : les coûts directs de ce devis ne sont pas complets.</p>';
  const stateNote = q.signatureDataUrl ? 'Une signature tracée est conservée localement ; l’identité n’est pas vérifiée et la signature n’est pas certifiée.' : 'L’état « Accepté » est une saisie manuelle ; aucune signature du client n’est enregistrée.';
  modal(q.title, `<div class="detail-card"><span class="pill neutral">${esc(q.status)} · V${q.version || 1}</span><p><b>Référence locale</b><br>${esc(q.reference || q.id)}</p><p><b>Client / chantier</b><br>${esc(q.client)} · ${esc(q.siteId ? siteLabel(q) : q.site || 'À rattacher')}</p><p><b>Validité</b><br>${esc(q.quoteDate || q.date || 'Date d’exemple')} · ${q.validityDays ? `${esc(String(q.validityDays))} jours` : 'non précisée'}</p><div class="quote-detail-lines">${lines}</div><div class="quote-totals"><div class="quote-total-row"><span>Total HT</span><b>${money(quoteListAmount(q, 'HT'))}</b></div>${vatRows}<div class="quote-total-row quote-total-strong"><span>Total TTC indicatif</span><b>${money(quoteListAmount(q, 'TTC'))}</b></div>${margin}</div><p class="form-hint">${stateNote}</p><button class="btn secondary full-btn" data-quote-action="print" data-id="${esc(q.id)}">Imprimer / enregistrer en PDF brouillon</button><label>État reçu<select id="quote-status-select">${['Brouillon','Accepté','Refusé','Expiré'].map(status => `<option ${q.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label><button class="btn secondary full-btn" data-quote-action="save-status" data-id="${esc(q.id)}">Enregistrer l’état reçu</button><button class="btn secondary full-btn" data-quote-action="version" data-id="${esc(q.id)}">Créer une nouvelle version</button>${!data.invoices.some(i => i.quoteId === q.id) ? `<button class="btn danger full-btn" data-quote-action="delete" data-id="${esc(q.id)}">Supprimer le brouillon</button>` : ''}</div>`);
  if (q.status === 'Accepté') {
    const siteAction = document.createElement('button');
    siteAction.className = 'btn primary full-btn';
    siteAction.dataset.quoteAction = linkedSite ? 'open-site' : 'create-site';
    siteAction.dataset.id = q.id;
    siteAction.textContent = linkedSite ? 'Ouvrir le chantier associé' : 'Créer un chantier depuis ce devis';
    $('#modal-content').querySelector('.detail-card').append(siteAction);
  }
  const signatureSection = document.createElement('section');
  signatureSection.className = 'quote-signature-summary';
  if (q.signatureDataUrl) {
    const label = document.createElement('p'); label.textContent = `Signature locale reçue de ${q.signatureName || 'signataire'} · ${q.signatureAt ? new Date(q.signatureAt).toLocaleString('fr-FR') : 'date non renseignée'}`;
    const image = document.createElement('img'); image.src = q.signatureDataUrl; image.alt = 'Signature tracée du client';
    signatureSection.append(label, image);
  } else {
    const signButton = document.createElement('button'); signButton.className = 'btn secondary full-btn'; signButton.dataset.quoteAction = 'signature'; signButton.dataset.id = q.id; signButton.textContent = 'Faire signer le client sur cet appareil';
    signatureSection.append(signButton);
  }
  $('#modal-content').querySelector('.detail-card').append(signatureSection);
}

function openQuoteSignature(id) {
  const quote = data.quotes.find(item => item.id === id); if (!quote) return;
  modal('Signature du client', `<form data-quote-signature-form data-quote-id="${esc(quote.id)}"><p class="form-hint">Demandez au client d’utiliser directement l’écran pour tracer sa signature. La signature et le nom saisis resteront dans les données locales de cet appareil. Cette fonction ne vérifie pas l’identité et ne fournit pas de signature électronique certifiée.</p><p><b>${esc(quote.title)}</b><br>${esc(quote.client)} · ${money(quoteListAmount(quote, 'TTC'))} TTC indicatif</p><label>Nom du signataire<input name="signerName" required maxlength="160" autocomplete="name"></label><label class="signature-consent"><input type="checkbox" name="agreement" required> Je confirme l’accord du client sur ce devis et son montant indicatif.</label><canvas id="quote-signature-pad" class="quote-signature-pad" width="720" height="240" aria-label="Zone où le client dessine sa signature"></canvas><div class="form-actions"><button type="button" class="btn secondary" data-quote-action="clear-signature">Effacer la signature</button><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Enregistrer la signature</button></div></form>`);
  const canvas = $('#quote-signature-pad'); const context = canvas.getContext('2d');
  context.strokeStyle = '#102b36'; context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round';
  let drawing = false; let hasInk = false;
  const point = event => { const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height]; };
  canvas.addEventListener('pointerdown', event => { event.preventDefault(); drawing = true; canvas.setPointerCapture(event.pointerId); const [x,y] = point(event); context.beginPath(); context.moveTo(x,y); });
  canvas.addEventListener('pointermove', event => { if (!drawing) return; event.preventDefault(); const [x,y] = point(event); context.lineTo(x,y); context.stroke(); hasInk = true; canvas.dataset.hasInk = 'true'; });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type, () => { drawing = false; });
  canvas.dataset.hasInk = 'false'; $('.cancel').onclick = closeModal;
}

function openQuoteSiteForm(id) {
  const quote = data.quotes.find(item => item.id === id);
  if (!quote || quote.status !== 'Accepté') return notify('Acceptez d’abord le devis enregistré pour créer un chantier.');
  const linkedSite = siteFromValue(quote.siteId || quote.site);
  if (linkedSite) { route('chantiers'); return showSite(linkedSite.id); }
  modal('Créer le chantier depuis le devis', `<form data-quote-site-form data-quote-id="${esc(quote.id)}">
    <p class="form-hint">Le client et le budget HT seront repris du devis accepté. Vous pourrez compléter les informations du chantier ensuite.</p>
    <label>Nom du chantier<input name="name" required maxlength="180" value="${esc(quote.title)}"></label>
    <label>Client<input value="${esc(quote.client)}" disabled></label>
    <label>Adresse du chantier<input name="address" maxlength="240" placeholder="Adresse à compléter"></label>
    <label>Date prévue<input name="plannedDate" type="date"></label>
    <p class="form-hint">Budget prévisionnel repris du devis : <b>${money(quoteListAmount(quote, 'HT'))} HT</b>.</p>
    <div class="form-actions"><button type="button" class="btn secondary cancel">Annuler</button><button class="btn primary">Créer et ouvrir le chantier</button></div>
  </form>`);
  $('.cancel').onclick = closeModal;
}

function createQuoteVersion(sourceId) {
  const source = data.quotes.find(q => q.id === sourceId); if (!source) return;
  closeModal(); openQuoteForm(sourceId);
}

function saveQuoteForm(form) {
  const values = Object.fromEntries(new FormData(form));
  const source = data.quotes.find(q => q.id === form.dataset.sourceId);
  let totals;
  try { totals = SSPDomain.calculateQuote(quoteRows(form)); }
  catch (error) { return notify(error.message); }
  const date = values.quoteDate;
  const validUntil = new Date(`${date}T12:00:00`); validUntil.setDate(validUntil.getDate() + Number(values.validityDays));
  const reference = `DEVIS-LOCAL-${date.replaceAll('-', '')}-${newId().slice(-6).toUpperCase()}`;
  const linkedSite = siteFromValue(values.site);
  if (linkedSite && linkedSite.client !== values.client) return notify('Le chantier choisi est associé à un autre client. Corrigez le client ou le chantier.');
  const quote = {
    id: newId(), reference, sourceQuoteId: source?.id || null, version: source ? (Number(source.version) || 1) + 1 : 1,
    client: values.client, siteId: linkedSite?.id || '', site: linkedSite?.name || '', title: values.title.trim(), quoteDate: date,
    validityDays: Number(values.validityDays), validUntil: SSPDomain.localDateISO(validUntil),
    status: 'Brouillon', lines: totals.lines, totals,
    amountHT: centsToEuros(totals.totalHTCents), amountTTC: centsToEuros(totals.totalTTCCents),
    vat: Object.keys(totals.vatByRateCents).join(' / '), date: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())
  };
  data.quotes.unshift(quote);
  if (!save()) return;
  clearFormDraft(form); closeModal(); render(); notify('Brouillon détaillé enregistré sur cet appareil.');
}

function render() {
  const view = page === 'accueil' ? dashboard() : page === 'chantiers' ? sitesPage() : page === 'clients' ? clientsPage() : page === 'devis' ? quotesPage() : simplePage();
  $('#page-content').innerHTML = view;
  wire();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-quote-action], [data-action="add-quote"], [data-quote]');
  if (!button) return;
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
  const action = button.dataset.quoteAction;
  if (action === 'new') return openQuoteForm();
  if (action === 'signature') return openQuoteSignature(button.dataset.id);
  if (action === 'clear-signature') { const canvas = $('#quote-signature-pad'); if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); canvas.dataset.hasInk = 'false'; } return; }
  if (action === 'pricebook-manager') return openPricebookManager();
  if (action === 'pricebook-new') return openPricebookForm();
  if (action === 'pricebook-edit') return openPricebookForm(button.dataset.id);
  if (action === 'pricebook-delete') {
    const item = (data.pricebook || []).find(row => row.id === button.dataset.id);
    if (item && confirm(`Supprimer « ${item.name} » de la bibliothèque locale ? Les devis existants ne seront pas modifiés.`)) {
      data.pricebook = data.pricebook.filter(row => row.id !== item.id); if (save()) { openPricebookManager(); notify('Prestation supprimée de la bibliothèque.'); }
    }
    return;
  }
  if (action === 'add-pricebook-line') {
    const item = (data.pricebook || []).find(row => row.id === $('#pricebook-picker')?.value);
    if (!item) return notify('Choisissez une prestation dans la bibliothèque.');
    const list = document.querySelector('[data-quote-lines]');
    list.insertAdjacentHTML('beforeend', quoteLineHtml({ ...item, description: item.name, quantity: 1, discountPercent: 0 }, list.querySelectorAll('[data-quote-line]').length));
    $('#pricebook-picker').value = ''; renderQuoteCalculation(document.querySelector('[data-quote-form]')); return;
  }
  if (action === 'create-site') return openQuoteSiteForm(button.dataset.id);
  if (action === 'open-site') { const quote = data.quotes.find(item => item.id === button.dataset.id); const site = quote && siteFromValue(quote.siteId || quote.site); if (site) { route('chantiers'); return showSite(site.id); } return notify('Le chantier associé est introuvable.'); }
  if (action === 'print') return openQuotePrint(button.dataset.id);
  if (action === 'print-now') return window.print();
  if (action === 'print-back') return openQuoteDetails(button.dataset.id);
  if (button.dataset.action === 'add-quote') return openQuoteForm();
  if (button.hasAttribute('data-quote')) return openQuoteDetails(button.dataset.quote);
  if (action === 'add-line') {
    const list = document.querySelector('[data-quote-lines]');
    list.insertAdjacentHTML('beforeend', quoteLineHtml({}, list.querySelectorAll('[data-quote-line]').length));
    renderQuoteCalculation(document.querySelector('[data-quote-form]')); return;
  }
  if (action === 'remove-line') {
    const list = document.querySelector('[data-quote-lines]');
    if (list.querySelectorAll('[data-quote-line]').length <= 1) return notify('Un devis doit garder au moins une ligne.');
    button.closest('[data-quote-line]').remove();
    [...list.querySelectorAll('[data-quote-line]')].forEach((line, index) => line.querySelector('.quote-line-head b').textContent = `Lot / ligne ${index + 1}`);
    renderQuoteCalculation(document.querySelector('[data-quote-form]')); return;
  }
  const id = button.dataset.id;
  const quote = data.quotes.find(q => q.id === id); if (!quote) return;
  if (action === 'save-status') {
    const status = $('#quote-status-select').value;
    if (status === 'Accepté' && !confirm('Confirmez-vous avoir reçu l’accord du client ? Cette saisie locale n’est pas une signature électronique.')) return;
    quote.status = status; quote.statusRecordedAt = new Date().toISOString();
    if (!save()) return; closeModal(); render(); notify('État enregistré localement.'); return;
  }
  if (action === 'version') return createQuoteVersion(id);
  if (action === 'delete') {
    if (data.quotes.some(q => q.sourceQuoteId === id)) return notify('Ce devis possède une version liée. Conservez son historique.');
    if (confirm('Supprimer définitivement ce brouillon local ?')) { const previous = data.quotes; data.quotes = previous.filter(q => q.id !== id); if (save()) { closeModal(); render(); } else data.quotes = previous; }
  }
}, true);

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-quote-signature-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const quote = data.quotes.find(item => item.id === form.dataset.quoteId);
  const canvas = $('#quote-signature-pad');
  const signerName = String(new FormData(form).get('signerName') || '').trim();
  if (!quote || !signerName || canvas?.dataset.hasInk !== 'true') return notify('Saisissez le nom et demandez au client de tracer sa signature.');
  const previous = { status: quote.status, statusRecordedAt: quote.statusRecordedAt, signatureName: quote.signatureName, signatureAt: quote.signatureAt, signatureDataUrl: quote.signatureDataUrl };
  quote.status = 'Accepté'; quote.statusRecordedAt = new Date().toISOString(); quote.signatureName = signerName;
  quote.signatureAt = quote.statusRecordedAt; quote.signatureDataUrl = canvas.toDataURL('image/png');
  if (!save()) { Object.assign(quote, previous); return; }
  closeModal(); render(); openQuoteDetails(quote.id); notify('Signature tracée enregistrée localement.');
}, true);

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-pricebook-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const values = Object.fromEntries(new FormData(form));
  const optional = name => values[name] === '' || values[name] === undefined ? null : Number(values[name]);
  const item = {
    id: form.dataset.id || newId(), name: String(values.name || '').trim(), category: String(values.category || '').trim(), unit: values.unit,
    unitPriceHT: optional('unitPriceHT'), materialUnitCostHT: optional('materialUnitCostHT'), hoursPerUnit: optional('hoursPerUnit'),
    hourlyCostHT: optional('hourlyCostHT'), otherUnitCostHT: optional('otherUnitCostHT') ?? 0, vatRate: Number(values.vatRate)
  };
  if (!item.name || !Number.isFinite(item.vatRate) || Object.values(item).some(value => typeof value === 'number' && !Number.isFinite(value))) return notify('Vérifiez le nom, la TVA et les montants de la prestation.');
  const existing = (data.pricebook || []).findIndex(row => row.id === item.id);
  if (existing >= 0) data.pricebook[existing] = item; else data.pricebook.unshift(item);
  if (!save()) return;
  openPricebookManager(); notify('Prestation et tarifs enregistrés sur cet appareil.');
}, true);

document.addEventListener('submit', event => {
  const form = event.target.closest('[data-quote-site-form]');
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const quote = data.quotes.find(item => item.id === form.dataset.quoteId);
  if (!quote || quote.status !== 'Accepté' || quote.siteId || siteFromValue(quote.site)) return notify('Le devis a changé ou est déjà rattaché à un chantier. Rouvrez sa fiche.');
  const values = Object.fromEntries(new FormData(form));
  let site;
  try { site = SSPDomain.createSiteFromAcceptedQuote(quote, { id: newId(), name: values.name, address: values.address, plannedDate: values.plannedDate }); }
  catch (error) { return notify(error.message); }
  data.sites.unshift(site);
  quote.siteId = site.id; quote.site = site.name;
  if (!save()) { data.sites.shift(); delete quote.siteId; delete quote.site; return; }
  closeModal(); route('chantiers'); showSite(site.id); notify('Chantier créé et relié au devis accepté.');
}, true);

document.addEventListener('input', event => {
  const form = event.target.closest('[data-quote-form]'); if (form) renderQuoteCalculation(form);
});
document.addEventListener('change', event => {
  const form = event.target.closest('[data-quote-form]'); if (form) renderQuoteCalculation(form);
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-quote-form]'); if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation(); saveQuoteForm(form);
}, true);

route(page);
