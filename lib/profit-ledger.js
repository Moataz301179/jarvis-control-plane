import { query, transaction, audit } from './db.js';

export async function recordProfitEntry({ job_id, venture, action, revenue_usd = 0, cost_usd = 0, currency = 'USD', source = '', evidence_url = '', notes = '' }, actor = 'jarvis') {
  const rows = await query(
    `INSERT INTO profit_ledger (job_id,venture,action,revenue_amount,cost_amount,currency,source,evidence_url,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [String(job_id || ''), String(venture || ''), String(action || ''), Number(revenue_usd) || 0, Number(cost_usd) || 0,
      String(currency || 'USD'), String(source || ''), String(evidence_url || ''), String(notes || '').slice(0, 2000)],
  );
  const row = rows.rows[0];
  await transaction(async (client) => {
    await audit(client, actor, 'profit.entry', 'profit_ledger', String(row.id), { venture: row.venture, action: row.action, revenue: row.revenue_amount, cost: row.cost_amount });
  });
  return row;
}

export async function profitSummary() {
  const [byVenture, byJob, totals] = await Promise.all([
    query('SELECT venture, count(*)::int AS entries, sum(revenue_amount) AS revenue, sum(cost_amount) AS cost FROM profit_ledger GROUP BY venture ORDER BY venture'),
    query('SELECT job_id, venture, action, revenue_amount, cost_amount, currency, created_at FROM profit_ledger ORDER BY id DESC LIMIT 100'),
    query('SELECT sum(revenue_amount) AS revenue, sum(cost_amount) AS cost, sum(revenue_amount - cost_amount) AS net FROM profit_ledger'),
  ]);
  const t = totals.rows[0] || {};
  return {
    by_venture: byVenture.rows,
    recent: byJob.rows,
    totals: {
      revenue: Number(t.revenue) || 0,
      cost: Number(t.cost) || 0,
      net: Number(t.net) || 0,
    },
  };
}
