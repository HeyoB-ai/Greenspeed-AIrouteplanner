import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const SUPABASE_URL     = process.env.VITE_SUPABASE_URL ?? '';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase niet geconfigureerd' }),
    };
  }

  // Admin client met service role key
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload: { email?: string; pharmacyIds?: string[]; pharmacyNames?: string[]; role?: string };
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ongeldige body' }) };
  }

  const { email, pharmacyIds, role } = payload;

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email verplicht' }) };
  }

  try {
    // Stuur uitnodiging via Supabase Auth — Supabase stuurt zelf de mail.
    // De ontvanger krijgt een link om een wachtwoord in te stellen.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        role:        role ?? 'SUPERVISOR',
        pharmacyIds: pharmacyIds ?? [],
        invited:     true,
      },
      redirectTo: `${process.env.URL ?? 'https://greenspeed.netlify.app'}/login`,
    });

    if (error) {
      console.error('[Invite] Supabase fout:', error.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.log('[Invite] Uitnodiging verstuurd naar:', email);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, userId: data.user?.id }),
    };

  } catch (err) {
    console.error('[Invite] Fout:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
