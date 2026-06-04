import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';

// Haalt alle koeriers op via de service-role client (omzeilt RLS).
// Alleen toegankelijk voor superuser/supervisor/admin met een echte sessie.
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  }

  const { data: couriers, error } = await auth.admin!
    .from('user_profiles')
    .select('id, name, role, hourlyWage, wageStartDate')
    .eq('role', 'courier')
    .order('name');

  if (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ couriers }),
  };
};
