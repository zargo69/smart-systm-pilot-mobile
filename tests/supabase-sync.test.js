const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('supabase-sync.js', 'utf8');
const defaults = { clients: [], documents: [], settings: { companyName: 'Entreprise', currency: 'EUR' } };

function harness({ initialData = defaults, remote = [] } = {}) {
  const local = new Map();
  let rows = structuredClone(remote);
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, 'ssp_app_records');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return Promise.resolve({ data: structuredClone(rows), error: null }); }
      };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'ssp_save_record') {
        const index = rows.findIndex(r => r.company_id === args.p_company_id && r.collection === args.p_collection && r.record_id === args.p_record_id);
        const version = index < 0 ? 1 : Number(rows[index].version) + 1;
        const record = { company_id: args.p_company_id, collection: args.p_collection, record_id: args.p_record_id, payload: args.p_payload, version, deleted_at: null, updated_at: new Date().toISOString() };
        if (index < 0) rows.push(record); else rows[index] = record;
        return { data: version, error: null };
      }
      if (name === 'ssp_soft_delete_record') {
        const row = rows.find(r => r.company_id === args.p_company_id && r.collection === args.p_collection && r.record_id === args.p_record_id);
        if (!row || row.version !== args.p_expected_version) return { data: null, error: new Error('SSP_CONFLICT') };
        row.version++;
        row.deleted_at = new Date().toISOString();
        return { data: row.version, error: null };
      }
      throw new Error('Unexpected RPC ' + name);
    }
  };
  const window = { SSPSupabase: { client }, addEventListener() {}, dispatchEvent() {} };
  const data = structuredClone(initialData);
  const context = {
    window, navigator: { onLine: true }, data,
    localModulesDefault: structuredClone(defaults),
    localStorage: {
      getItem: key => local.has(key) ? local.get(key) : null,
      setItem: (key, value) => local.set(key, String(value))
    },
    setTimeout: () => 1, clearTimeout() {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
    console, JSON, Map, Number, String, Array, Error, Date
  };
  context.save = () => true;
  vm.runInNewContext(source, context, { filename: 'supabase-sync.js' });
  return { api: window.SSPSync, context, calls, get rows() { return rows; }, set rows(v) { rows = v; }, local };
}

test('imports remote records into a first-time member device', async () => {
  const h = harness({ remote: [{ company_id: 'co-a', collection: 'clients', record_id: 'c-1', payload: { id: 'c-1', name: 'Client distant' }, version: 1, deleted_at: null }] });
  const result = await h.api.initialize('co-a', 'member');
  assert.equal(result.remoteCount, 1);
  assert.equal(h.context.data.clients[0].name, 'Client distant');
  assert.ok(h.local.has('ssp-sync-state-v1:co-a'));
});

test('syncs sales opportunities as shared business records', async () => {
  const opportunity = { id: 'opp-1', title: 'Maintenance GTB', stage: 'Devis envoyé', amountHT: 2500 };
  const h = harness({ initialData: { ...structuredClone(defaults), opportunities: [opportunity] } });
  await h.api.initialize('co-a', 'admin');
  const row = h.rows.find(item => item.collection === 'opportunities' && item.record_id === 'opp-1');
  assert.equal(row.payload.stage, 'Devis envoyé');
  assert.equal(row.payload.amountHT, 2500);
});

test('owner on a new device adopts existing shared records and settings', async () => {
  const remote = [
    { company_id: 'co-a', collection: 'clients', record_id: 'c-1', payload: { id: 'c-1', name: 'Client partagé' }, version: 1, deleted_at: null },
    { company_id: 'co-a', collection: 'settings', record_id: 'company-settings', payload: { companyName: 'Smart Syst’m', currency: 'EUR' }, version: 1, deleted_at: null }
  ];
  const h = harness({ remote });
  await h.api.initialize('co-a', 'admin');
  assert.equal(h.context.data.clients[0].name, 'Client partagé');
  assert.equal(h.context.data.settings.companyName, 'Smart Syst’m');
  assert.equal(h.rows.length, 2);
  assert.ok(h.local.has('ssp-pre-owner-sync-backup-v1:co-a'));
});

test('uploads local records when the owner initializes an empty company', async () => {
  const h = harness({ initialData: { ...structuredClone(defaults), clients: [{ id: 'c-1', name: 'Client local' }] } });
  await h.api.initialize('co-a', 'admin');
  assert.equal(h.rows.length, 2);
  assert.equal(h.rows.find(row => row.collection === 'clients').payload.name, 'Client local');
  assert.equal(h.calls[0].args.p_expected_version, 0);
});

test('preserves a first-time member local backup without uploading it', async () => {
  const remote = [{ company_id: 'co-a', collection: 'clients', record_id: 'remote', payload: { id: 'remote', name: 'Dossier partagé' }, version: 1, deleted_at: null }];
  const h = harness({ initialData: { ...structuredClone(defaults), clients: [{ id: 'local', name: 'Dossier privé appareil' }] }, remote });
  await h.api.initialize('co-a', 'member');
  assert.deepEqual(h.context.data.clients.map(row => row.id), ['remote']);
  assert.equal(h.rows.length, 1);
  assert.ok(h.local.has('ssp-pre-team-sync-backup-v1:co-a'));
});

test('shares settings as an owner-controlled company record', async () => {
  const h = harness({ initialData: { ...structuredClone(defaults), settings: { ...defaults.settings, companyName: 'Smart Syst’m' } } });
  await h.api.initialize('co-a', 'admin');
  const settings = h.rows.find(row => row.collection === 'settings');
  assert.equal(settings.payload.companyName, 'Smart Syst’m');
  const member = harness({ remote: [settings] });
  await member.api.initialize('co-a', 'member');
  assert.equal(member.context.data.settings.companyName, 'Smart Syst’m');
});

test('refuses to overwrite a record changed remotely and locally', async () => {
  const record = { company_id: 'co-a', collection: 'clients', record_id: 'c-1', payload: { id: 'c-1', name: 'Version 1' }, version: 1, deleted_at: null };
  const h = harness({ initialData: { ...structuredClone(defaults), clients: [{ id: 'c-1', name: 'Version 1' }] }, remote: [record] });
  await h.api.initialize('co-a', 'admin');
  h.context.data.clients[0].name = 'Modification locale';
  h.rows = [{ ...record, payload: { id: 'c-1', name: 'Modification distante' }, version: 2 }];
  await assert.rejects(() => h.api.flush(), /SSP_CONFLICT/);
});

test('keeps company sync metadata isolated', async () => {
  const h = harness();
  await h.api.initialize('company-one', 'admin');
  assert.ok(h.local.has('ssp-sync-state-v1:company-one'));
});
