import { query, transaction, audit } from './db.js';

export const INTERVIEW_QUESTIONS = [
  { id: 'ventures', question: 'Which ventures do you own or operate? Name each one and what it does.' },
  { id: 'revenue_model', question: 'For each venture, how do you make money? Describe the revenue streams and pricing.' },
  { id: 'customers', question: 'Who are your customers or buyers for each venture? Give examples if you can.' },
  { id: 'suppliers_partners', question: 'Who are your key suppliers, partners, or vendors? How do you work with them?' },
  { id: 'priority_metrics', question: 'What five numbers matter most to you right now across the business?' },
  { id: 'tools_in_use', question: 'Which tools do you use to run the business? Email, ads, payments, CRM, anything you log into.' },
  { id: 'budget_limits', question: 'How much can JARVIS spend per task and per month without asking? Currency and hard number per task.' },
  { id: 'growth_goals', question: 'What are the three biggest growth goals for the next 90 days?' },
  { id: 'no_go_rules', question: 'What must JARVIS never do or touch? Any禁区, no-go accounts, channels or actions.' },
  { id: 'owner_availability', question: 'When are you reachable for phone or Telegram escalation, and which number or handle should JARVIS use?' },
];

function text(value, max = 8000) {
  return String(value ?? '').trim().slice(0, max);
}

export async function loadBusinessProfile() {
  let row = null;
  try {
    const result = await query('SELECT * FROM business_profile ORDER BY updated_at DESC LIMIT 1');
    row = result.rows[0];
  } catch {
    row = null;
  }
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    profile: row.profile,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };
}

export async function saveBusinessProfile(body, actor = 'owner') {
  const profile = body && typeof body.profile === 'object' && !Array.isArray(body.profile) ? body.profile : null;
  if (!profile) throw Object.assign(new Error('profile object is required'), { statusCode: 400 });
  const existing = await loadBusinessProfile();
  const version = existing ? existing.version + 1 : 1;
  return transaction(async (client) => {
    await client.query('DELETE FROM business_profile');
    const result = await client.query(
      `INSERT INTO business_profile (version, profile, completed_at) VALUES ($1,$2,$3) RETURNING *`,
      [version, JSON.stringify(profile), profile.completed ? new Date() : null],
    );
    await audit(client, actor, 'business_profile.saved', 'business_profile', String(result.rows[0].id), { version, keys: Object.keys(profile) });
    return { id: result.rows[0].id, version, profile: result.rows[0].profile, completed_at: result.rows[0].completed_at, updated_at: result.rows[0].updated_at };
  });
}

export async function missingProfileSections() {
  try {
    const existing = await loadBusinessProfile();
    if (!existing) return INTERVIEW_QUESTIONS.map((q) => q.id);
    const present = existing.profile || {};
    return INTERVIEW_QUESTIONS.filter((q) => !present[q.id] || String(present[q.id]).trim() === '').map((q) => q.id);
  } catch {
    return INTERVIEW_QUESTIONS.map((q) => q.id);
  }
}
