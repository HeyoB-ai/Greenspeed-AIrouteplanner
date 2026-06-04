import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';

// Werkt het uurloon van een koerier bij via de service-role client (omzeilt RLS).
// Alleen toegankelijk voor superuser/supervisor/admin met een echte sessie.
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  }

  let courierId: string;
  let hourlyWage: number;
  try {
    const parsed = JSON.parse(event.body || '{}');
    courierId  = parsed.courierId;
    hourlyWage = parseFloat(parsed.hourlyWage);
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Ongeldige body' }) };
  }

  if (!courierId || Number.isNaN(hourlyWage) || hourlyWage < 0) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'courierId en geldig hourlyWage vereist' }) };
  }

  const { error } = await auth.admin!
    .from('user_profiles')
    .update({ hourlyWage })
    .eq('id', courierId);

  return {
    statusCode: error ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: !error, error: error?.message }),
  };
};
