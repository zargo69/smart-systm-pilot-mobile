/* Règles métier sans dépendance UI, réutilisables dans le navigateur et les tests Node. */
(function (root) {
  'use strict';

  function finiteNumber(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new RangeError(`${label} doit être compris entre ${min} et ${max}.`);
    }
    return number;
  }

  function localDateISO(value = new Date()) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const dateOnly = new Date(year, month - 1, day);
      if (dateOnly.getFullYear() !== year || dateOnly.getMonth() !== month - 1 || dateOnly.getDate() !== day) throw new RangeError('Date invalide.');
      return value;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new RangeError('Date invalide.');
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function validateStoredData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, reason: 'La racine doit être un objet JSON.' };
    const required = { clients: 'name', sites: 'name', quotes: 'title' };
    for (const [collection, labelField] of Object.entries(required)) {
      if (!Array.isArray(value[collection])) return { valid: false, reason: `La rubrique « ${collection} » est absente ou invalide.` };
      const rows = value[collection];
      if (rows.some(record => !record || typeof record !== 'object' || Array.isArray(record) || typeof record.id !== 'string' || !record.id.trim() || typeof record[labelField] !== 'string' || !record[labelField].trim())) {
        return { valid: false, reason: `Une fiche de la rubrique « ${collection} » est incomplète.` };
      }
      if (new Set(rows.map(record => record.id)).size !== rows.length) return { valid: false, reason: `La rubrique « ${collection} » contient des identifiants en double.` };
    }
    if (value.settings !== undefined && (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings))) return { valid: false, reason: 'Les paramètres sont invalides.' };
    return { valid: true, reason: '' };
  }

  function isLocalSessionActive(session, account, now = Date.now(), idleLimitMs = 15 * 60 * 1000) {
    return !!session && typeof session.accountId === 'string' && !!account && session.accountId === account.id && account.active !== false && Number.isFinite(session.lastActivity) && session.lastActivity <= now && now - session.lastActivity < idleLimitMs;
  }

  function toCents(value, label = 'Montant') {
    const number = finiteNumber(value, label);
    if (number === null) return null;
    return Math.round(number * 100);
  }

  function requiredCents(value, label) {
    const cents = toCents(value, label);
    if (cents === null) throw new RangeError(`${label} est obligatoire.`);
    return cents;
  }

  function ratioPercent(numeratorCents, denominatorCents) {
    if (denominatorCents <= 0) return null;
    return Math.round((numeratorCents / denominatorCents) * 10000) / 100;
  }

  function calculateQuote(lines) {
    if (!Array.isArray(lines) || lines.length === 0) throw new RangeError('Ajoutez au moins une ligne au devis.');

    let totalHtCents = 0;
    let directCostsCents = 0;
    let costsComplete = true;
    const vatByRate = new Map();

    const calculatedLines = lines.map((line, index) => {
      const label = `Ligne ${index + 1}`;
      const quantity = finiteNumber(line.quantity, `${label} · quantité`, { min: Number.EPSILON, max: 1_000_000 });
      const unitPriceCents = requiredCents(line.unitPriceHT, `${label} · prix unitaire`);
      const discountPercent = finiteNumber(line.discountPercent ?? 0, `${label} · remise`, { max: 100 });
      const vatRate = finiteNumber(line.vatRate, `${label} · TVA`, { max: 100 });
      if (vatRate === null) throw new RangeError(`${label} · TVA obligatoire.`);
      if (quantity === null) throw new RangeError(`${label} · quantité obligatoire.`);
      if (!String(line.description || '').trim()) throw new RangeError(`${label} · description obligatoire.`);

      const grossSaleCents = Math.round(quantity * unitPriceCents);
      const discountCents = Math.round(grossSaleCents * discountPercent / 100);
      const netSaleCents = grossSaleCents - discountCents;
      const vatCents = Math.round(netSaleCents * vatRate / 100);
      totalHtCents += netSaleCents;
      vatByRate.set(vatRate, (vatByRate.get(vatRate) || 0) + vatCents);

      const materialUnitCents = toCents(line.materialUnitCostHT, `${label} · coût matériel`);
      const hoursPerUnit = finiteNumber(line.hoursPerUnit, `${label} · heures`, { max: 100_000 });
      const hourlyCostCents = toCents(line.hourlyCostHT, `${label} · coût horaire`);
      const otherUnitCents = toCents(line.otherUnitCostHT ?? 0, `${label} · autres coûts`);
      const lineCostsKnown = materialUnitCents !== null && hoursPerUnit !== null && hourlyCostCents !== null && otherUnitCents !== null;
      let lineDirectCostsCents = null;
      if (lineCostsKnown) {
        lineDirectCostsCents = Math.round(quantity * materialUnitCents)
          + Math.round(quantity * hoursPerUnit * hourlyCostCents)
          + Math.round(quantity * otherUnitCents);
        directCostsCents += lineDirectCostsCents;
      } else {
        costsComplete = false;
      }

      return {
        description: String(line.description).trim(),
        quantity,
        unit: String(line.unit || 'unité'),
        unitPriceHTCents: unitPriceCents,
        discountPercent,
        vatRate,
        totalHTCents: netSaleCents,
        vatCents,
        directCostsCents: lineDirectCostsCents,
        materialUnitCostHTCents: materialUnitCents,
        hoursPerUnit,
        hourlyCostHTCents: hourlyCostCents,
        otherUnitCostHTCents: otherUnitCents
      };
    });

    const totalVatCents = [...vatByRate.values()].reduce((sum, value) => sum + value, 0);
    const marginCents = costsComplete ? totalHtCents - directCostsCents : null;
    return {
      lines: calculatedLines,
      totalHTCents: totalHtCents,
      vatByRateCents: Object.fromEntries([...vatByRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, amount]) => [String(rate), amount])),
      totalVatCents,
      totalTTCCents: totalHtCents + totalVatCents,
      directCostsCents: costsComplete ? directCostsCents : null,
      marginCents,
      marginRateOnCostPct: marginCents === null ? null : ratioPercent(marginCents, directCostsCents),
      marginRateOnSalePct: marginCents === null ? null : ratioPercent(marginCents, totalHtCents),
      markupCoefficient: marginCents === null || directCostsCents <= 0 ? null : Math.round((totalHtCents / directCostsCents) * 100) / 100,
      costsComplete
    };
  }

  function calculateInvoiceBalance(totalTTCCents, payments) {
    if (!Number.isSafeInteger(totalTTCCents) || totalTTCCents < 0) throw new RangeError('Le total TTC doit être un montant en centimes valide.');
    if (!Array.isArray(payments)) throw new TypeError('Les paiements doivent être fournis sous forme de liste.');
    const paidCents = payments.reduce((sum, payment, index) => {
      if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) throw new RangeError(`Règlement ${index + 1} invalide.`);
      return sum + payment.amountCents;
    }, 0);
    if (paidCents > totalTTCCents) throw new RangeError('Les règlements dépassent le total de la facture.');
    return { totalTTCCents, paidCents, remainingCents: totalTTCCents - paidCents, status: paidCents === totalTTCCents ? 'paid' : paidCents ? 'partially_paid' : 'unpaid' };
  }

  function calculateSiteEconomics({ acceptedSalesCents = [], purchaseCommitmentsCents = [], paidExpensesCents = [], stockConsumedCents = 0, timeEntries = [] } = {}) {
    const sumCents = (values, label) => {
      if (!Array.isArray(values)) throw new TypeError(`${label} doit être une liste de montants en centimes.`);
      return values.reduce((sum, cents, index) => {
        if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`${label} ${index + 1} invalide.`);
        return sum + cents;
      }, 0);
    };
    const contractCents = sumCents(acceptedSalesCents, 'Vente acceptée');
    const commitmentsCents = sumCents(purchaseCommitmentsCents, 'Commande engagée');
    const expensesCents = sumCents(paidExpensesCents, 'Dépense payée');
    const stockCents = sumCents([stockConsumedCents], 'Matériel consommé');
    if (!Array.isArray(timeEntries)) throw new TypeError('Les heures doivent être fournies sous forme de liste.');
    let laborCents = 0;
    // No logged hours means labor is unknown, not zero.
    let laborCostComplete = timeEntries.length > 0;
    for (const [index, entry] of timeEntries.entries()) {
      if (!Number.isSafeInteger(entry.minutes) || entry.minutes <= 0) throw new RangeError(`Pointage ${index + 1} invalide.`);
      if (entry.hourlyCostCents === null || entry.hourlyCostCents === undefined) {
        laborCostComplete = false;
        continue;
      }
      if (!Number.isSafeInteger(entry.hourlyCostCents) || entry.hourlyCostCents < 0) throw new RangeError(`Coût horaire ${index + 1} invalide.`);
      laborCents += Math.round(entry.minutes * entry.hourlyCostCents / 60);
    }
    const knownCostsCents = expensesCents + stockCents + laborCents;
    const salesComplete = acceptedSalesCents.length > 0;
    return {
      acceptedSalesCents: contractCents,
      salesComplete,
      purchaseCommitmentsCents: commitmentsCents,
      paidExpensesCents: expensesCents,
      stockConsumedCents: stockCents,
      laborCostsCents: laborCostComplete ? laborCents : null,
      knownCostsCents: laborCostComplete ? knownCostsCents : null,
      estimatedMarginCents: laborCostComplete && salesComplete ? contractCents - knownCostsCents : null,
      laborCostComplete
    };
  }

  function calculateStockBalance({ openingQuantityMilliunits = 0, openingUnitCostCents = 0, movements = [] } = {}) {
    if (!Number.isSafeInteger(openingQuantityMilliunits) || openingQuantityMilliunits < 0) throw new RangeError('La quantité initiale est invalide.');
    if (!Number.isSafeInteger(openingUnitCostCents) || openingUnitCostCents < 0) throw new RangeError('Le coût initial est invalide.');
    if (!Array.isArray(movements)) throw new TypeError('Les mouvements doivent être fournis sous forme de liste.');
    let quantityMilliunits = openingQuantityMilliunits;
    let inventoryValueCents = Math.round(openingQuantityMilliunits * openingUnitCostCents / 1000);
    const calculatedMovements = [];
    for (const [index, movement] of movements.entries()) {
      if (!Number.isSafeInteger(movement.quantityMilliunits) || movement.quantityMilliunits <= 0) throw new RangeError(`Mouvement ${index + 1} : quantité invalide.`);
      if (!['entrée', 'sortie'].includes(movement.kind)) throw new RangeError(`Mouvement ${index + 1} : type invalide.`);
      if (!Number.isSafeInteger(movement.totalCostCents) || movement.totalCostCents < 0) throw new RangeError(`Mouvement ${index + 1} : coût invalide.`);
      if (movement.kind === 'entrée') {
        quantityMilliunits += movement.quantityMilliunits;
        inventoryValueCents += movement.totalCostCents;
      } else {
        if (movement.quantityMilliunits > quantityMilliunits) throw new RangeError(`Mouvement ${index + 1} : stock insuffisant.`);
        const averageUnitCostCents = quantityMilliunits > 0 ? inventoryValueCents * 1000 / quantityMilliunits : 0;
        const issueCostCents = Math.min(inventoryValueCents, Math.round(movement.quantityMilliunits * averageUnitCostCents / 1000));
        quantityMilliunits -= movement.quantityMilliunits;
        inventoryValueCents -= issueCostCents;
        calculatedMovements.push({ costCents: issueCostCents });
        continue;
      }
      calculatedMovements.push({ costCents: movement.totalCostCents });
    }
    return {
      quantityMilliunits,
      inventoryValueCents,
      averageUnitCostCents: quantityMilliunits > 0 ? inventoryValueCents * 1000 / quantityMilliunits : 0,
      calculatedMovements
    };
  }

  function recordBelongsToSite(record, site, sites) {
    if (!record || !site || !Array.isArray(sites)) return false;
    if (record.siteId) return record.siteId === site.id;
    if (!record.site) return false;
    const matches = sites.filter(candidate => candidate.name === record.site);
    return matches.length === 1 && matches[0].id === site.id;
  }

  function migrateLegacySiteId(record, sites) {
    if (!record || record.siteId || !record.site || !Array.isArray(sites)) return false;
    const matches = sites.filter(site => site.name === record.site);
    if (matches.length !== 1) return false;
    record.siteId = matches[0].id;
    return true;
  }

  function normalizeContactValue(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function normalizeContactPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('0033')) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith('33') && digits.length === 11) digits = `0${digits.slice(2)}`;
    return digits;
  }

  function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = previous[0]; previous[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const above = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return previous[right.length];
  }

  function findPotentialContactDuplicates(candidate, records) {
    if (!candidate || !Array.isArray(records)) return [];
    const name = normalizeContactValue(candidate.name);
    const city = normalizeContactValue(candidate.city);
    const email = String(candidate.email || '').trim().toLocaleLowerCase('fr');
    const phone = normalizeContactPhone(candidate.phone);
    return records.flatMap(record => {
      const reasons = [];
      const recordEmail = String(record.email || '').trim().toLocaleLowerCase('fr');
      const recordPhone = normalizeContactPhone(record.phone);
      const recordName = normalizeContactValue(record.name);
      const recordCity = normalizeContactValue(record.city);
      if (email && recordEmail && email === recordEmail) reasons.push('e-mail identique');
      if (phone.length >= 7 && recordPhone.length >= 7 && phone === recordPhone) reasons.push('téléphone identique');
      if (name && recordName && name === recordName) reasons.push('nom identique');
      else if (name.length >= 7 && recordName.length >= 7 && city && city === recordCity && editDistance(name, recordName) <= 1) reasons.push('nom proche dans la même ville');
      return reasons.length ? [{ record, reasons }] : [];
    });
  }

  function mergeContactDetails(existing, incoming, mergedAt = new Date().toISOString()) {
    if (!existing || typeof existing !== 'object' || !incoming || typeof incoming !== 'object') throw new TypeError('Les deux fiches de contact sont obligatoires.');
    const merged = { ...existing };
    const alternateValues = Object.fromEntries(Object.entries(existing.alternateValues || {}).map(([field, values]) => [field, [...values]]));
    const mergedFields = [];
    const conflictFields = [];
    for (const field of ['name', 'type', 'city', 'email', 'phone', 'origin', 'notes']) {
      const nextValue = String(incoming[field] || '').trim();
      const currentValue = String(existing[field] || '').trim();
      if (!nextValue) continue;
      if (!currentValue) {
        merged[field] = nextValue;
        mergedFields.push(field);
        continue;
      }
      const normalizedCurrent = field === 'email' ? currentValue.toLocaleLowerCase('fr') : field === 'phone' ? normalizeContactPhone(currentValue) : normalizeContactValue(currentValue);
      const normalizedNext = field === 'email' ? nextValue.toLocaleLowerCase('fr') : field === 'phone' ? normalizeContactPhone(nextValue) : normalizeContactValue(nextValue);
      if (normalizedCurrent !== normalizedNext) {
        const values = alternateValues[field] || [];
        if (!values.some(value => (field === 'email' ? value.toLocaleLowerCase('fr') : field === 'phone' ? normalizeContactPhone(value) : normalizeContactValue(value)) === normalizedNext)) values.push(nextValue);
        alternateValues[field] = values;
        conflictFields.push(field);
      }
    }
    const hasAlternatives = Object.keys(alternateValues).some(field => alternateValues[field].length);
    if (hasAlternatives) merged.alternateValues = alternateValues;
    merged.mergeHistory = [...(existing.mergeHistory || []), { mergedAt, incomingName: String(incoming.name || '').trim(), mergedFields, conflictFields }];
    return merged;
  }

  function createSiteFromAcceptedQuote(quote, { id, name, address = '', plannedDate = '' } = {}) {
    if (!quote || typeof quote !== 'object') throw new TypeError('Le devis est obligatoire.');
    if (quote.status !== 'Accepté') throw new RangeError('Seul un devis accepté peut créer un chantier.');
    if (quote.siteId) throw new RangeError('Ce devis est déjà rattaché à un chantier.');
    const siteName = String(name || quote.title || '').trim();
    const client = String(quote.client || '').trim();
    if (!siteName || !client || !id) throw new TypeError('Le chantier doit avoir un identifiant, un nom et un client.');
    const budget = quote.totals?.totalHTCents !== undefined
      ? quote.totals.totalHTCents / 100
      : Number(quote.amountHT ?? quote.amount);
    if (!Number.isFinite(budget) || budget < 0) throw new RangeError('Le budget HT du devis est invalide.');
    return {
      id, name: siteName, client, address: String(address || '').trim(), status: 'À préparer',
      progress: 0, budget, spent: 0, date: plannedDate || 'À planifier', color: 'teal',
      quoteId: quote.id || null, createdAt: new Date().toISOString()
    };
  }

  const api = { finiteNumber, toCents, requiredCents, localDateISO, validateStoredData, isLocalSessionActive, calculateQuote, calculateInvoiceBalance, calculateSiteEconomics, calculateStockBalance, recordBelongsToSite, migrateLegacySiteId, findPotentialContactDuplicates, mergeContactDetails, createSiteFromAcceptedQuote };
  root.SSPDomain = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
