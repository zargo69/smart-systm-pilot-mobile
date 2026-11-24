// Supabase Edge Function: invitations et gestion des membres SMART SYST'M PILOT.
// SUPABASE_SERVICE_ROLE_KEY reste uniquement dans les secrets de l'environnement serveur.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || request.headers.get('apikey');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Configuration serveur incomplète.' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Connexion requise.' }, 401);

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Session invalide.' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await admin
    .from('ssp_company_members')
    .select('company_id,role')
    .eq('user_id', authData.user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) return json({ error: 'Accès réservé au responsable de l’entreprise.' }, 403);

  let body: { action?: string; email?: string; userId?: string };
  try { body = await request.json(); }
  catch { return json({ error: 'Demande invalide.' }, 400); }

  if (body.action === 'list') {
    const { data: members, error } = await admin.from('ssp_company_members')
      .select('user_id,role,created_at')
      .eq('company_id', membership.company_id)
      .order('created_at', { ascending: true });
    if (error) return json({ error: 'Impossible de charger les membres.' }, 500);
    const result = await Promise.all((members || []).map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      return { userId: member.user_id, email: data.user?.email || '', role: member.role, createdAt: member.created_at };
    }));
    return json({ members: result });
  }

  if (body.action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const configuredRedirect = Deno.env.get('SSP_INVITE_REDIRECT_URL');
    if (!configuredRedirect) return json({ error: 'URL de retour des invitations non configurée.' }, 500);
    let inviteRedirect: string;
    try {
      const target = new URL(configuredRedirect);
      if (target.protocol !== 'https:') throw new Error('https');
      target.searchParams.set('invite', '1');
      inviteRedirect = target.toString();
    } catch { return json({ error: 'URL de retour des invitations invalide.' }, 500); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Adresse e-mail invalide.' }, 400);
    }
    let existingUser = null;
    for (let pageNumber = 1; pageNumber <= 100; pageNumber += 1) {
      const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: pageNumber, perPage: 1000 });
      if (listError) return json({ error: 'Impossible de vérifier cette adresse.' }, 500);
      existingUser = page.users.find((candidate) => candidate.email?.toLowerCase() === email) || null;
      if (existingUser || page.users.length < 1000) break;
    }
    let user = existingUser;
    let invitationSent = false;
    if (!user) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: inviteRedirect });
      if (inviteError || !invited.user) return json({ error: 'Invitation impossible. Vérifiez la configuration des e-mails.' }, 400);
      user = invited.user;
      invitationSent = true;
    }
    const { data: currentMembership } = await admin.from('ssp_company_members')
      .select('role').eq('company_id', membership.company_id).eq('user_id', user.id).maybeSingle();
    if (currentMembership?.role === 'admin') return json({ error: 'Cette adresse est déjà responsable de l’entreprise.' }, 400);
    const { error: addError } = await admin.from('ssp_company_members').upsert({
      company_id: membership.company_id,
      user_id: user.id,
      role: 'member',
    }, { onConflict: 'company_id,user_id' });
    if (addError) return json({ error: 'Le compte a été trouvé, mais son accès n’a pas pu être ajouté. Réessayez ou contactez le support.' }, 500);
    return json({ ok: true, email, invitationSent });
  }

  if (body.action === 'remove') {
    const userId = String(body.userId || '');
    if (!userId || userId === authData.user.id) return json({ error: 'Vous ne pouvez pas retirer votre propre accès.' }, 400);
    const { data: target, error: targetError } = await admin.from('ssp_company_members')
      .select('role').eq('company_id', membership.company_id).eq('user_id', userId).maybeSingle();
    if (targetError || !target) return json({ error: 'Membre introuvable.' }, 404);
    if (target.role === 'admin') return json({ error: 'Le responsable ne peut pas être retiré de cette façon.' }, 400);
    const { error } = await admin.from('ssp_company_members')
      .delete().eq('company_id', membership.company_id).eq('user_id', userId);
    if (error) return json({ error: 'Impossible de retirer cet accès.' }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Action inconnue.' }, 400);
});
