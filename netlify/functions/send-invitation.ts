import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ROLE_LABELS: Record<string, string> = {
  pharmacy:   'apotheekassistent',
  admin:      'beheerder',
  supervisor: 'supervisor',
  courier:    'koerier',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[send-invitation] Supabase service role key niet geconfigureerd');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server niet geconfigureerd' }) };
  }

  try {
    const { email, role, pharmacyId, token } = JSON.parse(event.body ?? '{}');

    if (!email || !role || !token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Verplichte velden ontbreken' }) };
    }

    // Service-role client (heeft admin rechten)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Uitnodigings-URL
    const baseUrl   = process.env.URL ?? 'https://greenspeed.netlify.app';
    const inviteUrl = `${baseUrl}?invite=${token}`;
    const roleLabel = ROLE_LABELS[role] ?? role;

    // Gebruik Supabase admin invite — stuurt automatisch een e-mail
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
      data: {
        role,
        pharmacyId,
        inviteToken: token,
      },
    });

    if (error) {
      console.error('[send-invitation] Supabase invite error:', error.message);
      // Niet fataal: uitnodiging staat al in de database
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          warning: `Mail kon niet worden verstuurd: ${error.message}. Deel de link handmatig: ${inviteUrl}`,
          inviteUrl,
        }),
      };
    }

    console.log(`[send-invitation] Uitnodiging verstuurd naar ${email} als ${roleLabel}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, inviteUrl }),
    };

  } catch (err: any) {
    console.error('[send-invitation] Onverwachte fout:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Interne serverfout' }) };
  }
};
