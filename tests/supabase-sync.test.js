const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('supabase-sync.js', 'utf8');

function harness({ initialData = { clients: [] }, remote = [] } = {}) {
  const local = new Map();
  let rows = structuredClone(remote);
  let nextVersion = 1;
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
  const window = {
    SSPSupabase: { client },
    addEventListener() {},
    dispatchEvent() {}
  };
  const context = {
    window, navigator: { onLine: true }, data: structuredClone(initialData),
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

test('imports remote records into local company data', async () => {
  const h = harness({ remote: [{ company_id: 'co-a', collection: 'clients', record_id: 'c-1', payload: { id: 'c-1', name: 'Client distant' }, version: 1, deleted_at: null }] });
  const result = await h.api.initialize('co-a');
  assert.equal(result.remoteCount, 1);
  assert.equal(h.context.data.clients[0].name, 'Client distant');
  assert.ok(h.local.has('ssp-sync-state-v1:co-a'));
});

test('uploads local records when remote collection is empty', async () => {
  const h = harness({ initialData: { clients: [{ id: 'c-1', name: 'Client local' }] } });
  await h.api.initialize('co-a');
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].payload.name, 'Client local');
  assert.equal(h.calls[0].args.p_expected_version, 0);
});

test('refuses to overwrite a record changed remotely and locally', async () => {
  const record = { company_id: 'co-a', collection: 'clients', record_id: 'c-1', payload: { id: 'c-1', name: 'Version 1' }, version: 1, deleted_at: null };
  const h = harness({ initialData: { clients: [{ id: 'c-1', name: 'Version 1' }] }, remote: [record] });
  await h.api.initialize('co-a');
  h.context.data.clients[0].name = 'Modification locale';
  h.rows = [{ ...record, payload: { id: 'c-1', name: 'Modification distante' }, version: 2 }];
  await assert.rejects(() => h.api.flush(), /SSP_CONFLICT/);
});

test('keeps company sync metadata isolated', async () => {
  const h = harness();
  await h.api.initialize('company-one');
  assert.ok(h.local.has('ssp-sync-state-v1:company-one'));
});
