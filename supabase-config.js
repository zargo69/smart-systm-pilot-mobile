/* Configuration publique Supabase de Smart syst'm Pilot.
   La publishable key est conçue pour être utilisée côté navigateur.
   La sécurité repose sur les politiques RLS de la base, jamais sur cette clé.
*/
window.SSP_SUPABASE_CONFIG = Object.freeze({
  url: 'https://ueyamyqbsimmpourinmz.supabase.co',
  anonKey: 'sb_publishable_fye6EzGFZvpMYUyKVeEhpw_NiC5f5Np',
  // À activer uniquement après les migrations 001–003, le déploiement de la fonction Edge et la validation des droits avec plusieurs comptes.
  syncEnabled: false
});
