/* Initialisation Supabase — préparatoire, non chargée par l'application pour le moment.
   Ne jamais placer une clé sb_secret_* ou service_role dans ce fichier.
*/
(() => {
  const config = window.SSP_SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey) {
    console.warn('[SSP] Configuration Supabase absente.');
    return;
  }
  if (!window.supabase?.createClient) {
    console.warn('[SSP] Bibliothèque Supabase JS non chargée.');
    return;
  }
  if (window.SSPSupabase) return;

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ssp-supabase-auth-v1'
    }
  });

  window.SSPSupabase = Object.freeze({ client });
  console.info('[SSP] Client Supabase initialisé.');
})();
