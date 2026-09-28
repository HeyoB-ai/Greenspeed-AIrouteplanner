import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const token = authHeader.slice(7);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const privilegedRoles = ['superuser', 'supervisor', 'admin'];
  if (!callerProfile || !privilegedRoles.includes((callerProfile.role ?? '').toLowerCase())) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Insufficient permissions' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const { userId, role, isPlanner } = body as { userId?: string; role?: string; isPlanner?: boolean };

  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) };
  }

  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (isPlanner !== undefined) updates.is_planner = isPlanner;

  if (Object.keys(updates).length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No updates provided' }) };
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, role, is_planner')
    .single();

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  };
};
