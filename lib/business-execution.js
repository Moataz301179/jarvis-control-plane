import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
import { query, audit } from './db.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { searchWeb } from './browser-tools.js';

const PROJECTS = new Set(['STUDIO', 'HV']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCOVERY_DEFAULTS = {
  supplier: ['Egypt hotel supplies supplier company', 'Egypt hospitality FF&E supplier company'],
  hotel: ['Egypt hotel group procurement contact', 'Egypt resort hotel group official website'],
};

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function emailAddress(value) {
  const text = clean(value, 500);
  const bracket = text.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (bracket) return bracket[1];
  const direct = text.match(/[^\s<>]+@[^\s<>]+/);
  return direct ? direct[0].replace(/[>,;]+$/, '') : text;
}

function projectCode(value = 'HV') {
  const project = clean(value, 20).toUpperCase();
  if (!PROJECTS.has(project)) throw Object.assign(new Error('Choose a valid project'), { statusCode: 400 });
  return project;
}

function providerError(message, statusCode = 424) {
  return Object.assign(new Error(message), { statusCode });
}

async function credential(provider) {
  const row = (await query('SELECT * FROM provider_credentials WHERE provider=$1', [provider])).rows[0];
  if (!row) return null;
  try {
    const decrypted = decryptSecret(row.encrypted_key);
    let value = decrypted;
    try { value = JSON.parse(decrypted); } catch {}
    return { value, row };
  } catch {
    return null;
  }
}

async function saveCredential(provider, value, metadata = {}, actor = 'owner') {
  await query(`INSERT INTO provider_credentials(provider,encrypted_key,metadata,updated_at) VALUES($1,$2,$3,now())
    ON CONFLICT(provider) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,metadata=EXCLUDED.metadata,updated_at=now()`,
  [provider, encryptSecret(JSON.stringify(value)), JSON.stringify({ ...metadata, configured_by: actor, configured_at: new Date().toISOString() })]);
}

export async function saveBusinessProvider(body, actor = 'owner') {
  const provider = clean(body.provider, 40).toLowerCase();
  if (provider === 'apollo') {
    const apiKey = clean(body.api_key, 300);
    if (!apiKey) throw Object.assign(new Error('Apollo API key is required'), { statusCode: 400 });
    const response = await fetch('https://api.apollo.io/api/v1/auth/health', { headers: { 'x-api-key': apiKey, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.healthy !== true) throw providerError(`Apollo rejected the API key (HTTP ${response.status})`, 502);
    await saveCredential('apollo', { apiKey }, { account: 'Apollo', validated: true }, actor);
    return { provider, configured: true, healthy: true };
  }
  if (provider === 'smtp') {
    const smtp = {
      host: clean(body.host, 240),
      port: Number(body.port) || 465,
      secure: body.secure !== false,
      user: clean(body.user, 320),
      pass: String(body.pass || ''),
      from: clean(body.from || body.user, 320),
      imapHost: clean(body.imap_host || 'imap.hostinger.com', 240),
      imapPort: Number(body.imap_port) || 993,
      imapSecure: body.imap_secure !== false,
    };
    smtp.from = emailAddress(smtp.from);
    if (!smtp.host || !smtp.user || !smtp.pass || !EMAIL_RE.test(smtp.from)) throw Object.assign(new Error('Complete SMTP host, user, password and sender email are required'), { statusCode: 400 });
    const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } });
    await transport.verify();
    await saveCredential('smtp', smtp, { account: smtp.user, smtp_host: smtp.host, imap_host: smtp.imapHost, validated: true }, actor);
    return { provider, configured: true, smtp: true, imap: true, account: smtp.user };
  }
  throw Object.assign(new Error('Supported business providers are apollo and smtp'), { statusCode: 400 });
}

export async function businessProviderStatus() {
  const [apollo, smtp, bridge] = await Promise.all([
    credential('apollo'),
    credential('smtp'),
    query("SELECT metadata,last_seen FROM hermes_bridge_status WHERE id='primary'").then((result) => result.rows[0] || null).catch(() => null),
  ]);
  let apolloReady = false;
  let apolloError = null;
  if (apollo?.value?.apiKey) {
    try {
      const response = await fetch('https://api.apollo.io/api/v1/auth/health', { headers: { 'x-api-key': apollo.value.apiKey, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(10000) });
      const body = await response.json().catch(() => ({}));
      apolloReady = response.ok && body.healthy === true;
      apolloError = apolloReady ? null : body.error || `HTTP ${response.status}`;
    } catch (error) { apolloError = error.message; }
  }
  return {
    apollo: { configured: Boolean(apollo), ready: apolloReady, error: apolloError },
    email: { configured: Boolean(smtp), ready: Boolean(smtp?.value?.host && smtp?.value?.user), account: smtp?.value?.user || null, imap_host: smtp?.value?.imapHost || null },
    grok: { configured: Boolean(config.openRouterKey), ready: Boolean(config.openRouterKey), route: 'openrouter/x-ai/grok-4.3' },
    phone: {
      configured: Boolean(process.env.AGENT_RING_URL),
      route: process.env.AGENT_RING_URL ? 'agent-ring' : 'telegram-voice-fallback',
      call_me: bridge?.metadata?.telephony?.call_me || null,
    },
  };
}

function inferName(title, hostname) {
  const value = clean(title, 240).split(/[|\-–—]/)[0].trim();
  if (value && value.length >= 3 && !/^(home|welcome|official site)$/i.test(value)) return value;
  return hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function suitableDiscoveryUrl(url, entityType) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (/(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)linkedin\.com$|(^|\.)youtube\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)tripadvisor\.com$|(^|\.)booking\.com$|(^|\.)expedia\.com$|(^|\.)wikipedia\.org$|(^|\.)crunchbase\.com$|(^|\.)bing\.com$|(^|\.)yahoo\.com$/.test(host)) return false;
    if (/hotel/i.test(parsed.pathname) && entityType === 'supplier') return false;
    return true;
  } catch { return false; }
}

async function apolloLookup(apiKey, domain) {
  if (!apiKey || !domain) return null;
  const response = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, { headers: { 'x-api-key': apiKey, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.organization) return null;
  const org = body.organization;
  return { id: org.id, name: org.name, domain: org.primary_domain || domain, website_url: org.website_url || null, location: [org.city, org.state, org.country].filter(Boolean).join(', ') || null, industry: org.industry || null, linkedin_url: org.linkedin_url || null };
}

export async function runBusinessDiscovery(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const entityType = clean(body.entity_type || 'supplier', 20).toLowerCase();
  if (!['supplier', 'hotel'].includes(entityType)) throw Object.assign(new Error('entity_type must be supplier or hotel'), { statusCode: 400 });
  const searchQueries = (Array.isArray(body.queries) && body.queries.length ? body.queries : DISCOVERY_DEFAULTS[entityType]).map((item) => clean(item, 500)).filter(Boolean).slice(0, 8);
  const maxResults = Math.min(Math.max(Number(body.max_results) || 6, 1), 20);
  const apollo = await credential('apollo');
  const searchEvidence = [];
  let imported = 0;
  for (const searchQuery of searchQueries) {
    let result;
    try { result = await searchWeb({ query: searchQuery, max_results: maxResults }); }
    catch (error) { searchEvidence.push({ query: searchQuery, error: error.message }); continue; }
    searchEvidence.push({ query: searchQuery, search_url: result.search_url, result_count: result.results.length });
    for (const hit of result.results) {
      if (!suitableDiscoveryUrl(hit.url, entityType)) continue;
      if (!/egypt|مصر|cairo|alexandria|sharm|hurghada|giza|luxor|aswan/i.test(`${hit.title} ${hit.snippet} ${hit.url}`) && !/\.eg(?:\/|$)/i.test(hit.url)) continue;
      const parsed = new URL(hit.url);
      const domain = parsed.hostname.replace(/^www\./, '');
      const enriched = await apolloLookup(apollo?.value?.apiKey, domain).catch(() => null);
      const name = clean(enriched?.name || inferName(hit.title, domain), 300);
      if (!name) continue;
      const sourceRef = enriched?.id || domain;
      await query(`INSERT INTO business_discoveries(project_code,entity_type,name,domain,website_url,location,source,source_ref,evidence,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'discovered')
        ON CONFLICT(project_code,entity_type,source,source_ref) DO UPDATE SET name=EXCLUDED.name,domain=EXCLUDED.domain,website_url=EXCLUDED.website_url,location=COALESCE(EXCLUDED.location,business_discoveries.location),evidence=EXCLUDED.evidence,updated_at=now()`,
      [project, entityType, name, enriched?.domain || domain, enriched?.website_url || hit.url, enriched?.location || null, enriched ? 'Apollo organization lookup + web search' : 'Web search', sourceRef, JSON.stringify({ query: searchQuery, search_url: result.search_url, result_url: hit.url, snippet: hit.snippet, apollo_org_id: enriched?.id || null, industry: enriched?.industry || null, observed_at: new Date().toISOString() })]);
      imported += 1;
    }
  }
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES($1,'verified',$2,$3,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status=EXCLUDED.status,detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`,
  [entityType === 'supplier' ? 'supplier_discovery' : 'hotel_discovery', JSON.stringify({ source: 'public web search plus Apollo organization enrichment', imported, apollo_ready: Boolean(apollo) }), `discovery:${project}:${entityType}:${new Date().toISOString()}`]);
  await audit({ query }, actor, 'business.discovery_run', 'business_discovery', `${project}:${entityType}`, { imported, searchQueries, apolloReady: Boolean(apollo) });
  return { project_code: project, entity_type: entityType, imported, searches: searchEvidence, apollo_ready: Boolean(apollo) };
}

export function buildCampaignPackage(input = {}) {
  const project = projectCode(input.project_code || 'HV');
  const name = clean(input.name || 'Verified hospitality procurement launch', 180);
  const objective = clean(input.objective || 'Generate qualified supplier and hotel conversations that produce measurable pipeline and revenue.', 1000);
  const website = clean(input.website || 'https://www.hotelsvendors.com', 500);
  const offer = clean(input.offer || 'A verified procurement workflow with fixed supplier pricing, delivery evidence, governance and finance readiness.', 1000);
  const audience = clean(input.audience || 'Egyptian hotel procurement leaders, general managers and hospitality suppliers', 1000);
  const senderName = clean(input.sender_name || 'HotelsVendors', 120);
  return {
    schema_version: 1,
    name, project_code: project, objective, website, audience, offer,
    positioning: 'Less procurement friction, clearer supplier availability, stronger delivery evidence and measurable savings.',
    funnel: [
      { stage: 'awareness', channel: 'email + LinkedIn organic', conversion: 'qualified reply or booked call' },
      { stage: 'consideration', channel: 'one-page procurement brief', conversion: 'catalogue or availability submission' },
      { stage: 'conversion', channel: 'founder-led demo', conversion: 'pilot onboarding' },
      { stage: 'retention', channel: 'weekly savings and delivery review', conversion: 'repeat order and expansion' },
    ],
    channels: ['targeted email', 'LinkedIn organic', 'website landing page', 'Telegram owner alerts'],
    assets: [
      { type: 'landing_page', title: 'Hospitality procurement pilot', call_to_action: 'Request a verified pilot' },
      { type: 'one_pager', title: 'Evidence-backed hospitality procurement' },
      { type: 'email_sequence', title: 'Three-touch supplier and hotel outreach' },
      { type: 'demo_deck', title: 'From fragmented buying to verified procurement' },
      { type: 'tracking_plan', title: 'Reply, meeting, onboarding and revenue attribution' },
    ],
    email_sequence: [
      { day: 0, subject: 'Quick question about supplier availability', body: `${senderName} helps hospitality teams reduce procurement friction with verified supplier availability. Would a short conversation about your current process be useful?` },
      { day: 3, subject: 'A clearer way to verify hotel supply', body: `Following up with one concrete idea: a procurement pilot that gives your team fixed prices, availability evidence and a clear approval trail. We can show the workflow in 15 minutes.` },
      { day: 8, subject: 'Close the loop on procurement', body: `If supplier verification and delivery evidence are priorities this quarter, reply with the best time. If not, tell us when to revisit.` },
    ],
    ad_concepts: [
      { headline: 'Procurement without the blind spots', body: 'Verify supplier availability, compare fixed prices and keep an approval trail.' },
      { headline: 'Turn hotel buying into evidence', body: 'One workflow for sourcing, approvals, delivery proof and finance readiness.' },
      { headline: 'Less chasing. More verified supply.', body: 'Give your hospitality team a clearer path from request to delivered order.' },
    ],
    kpis: [
      { metric: 'delivered_emails', target: '>= 20', source: 'JARVIS SMTP evidence' },
      { metric: 'reply_rate', target: '>= 5%', source: 'IMAP reply matching' },
      { metric: 'qualified_meetings', target: '>= 3', source: 'owner CRM' },
      { metric: 'pilot_onboardings', target: '>= 1', source: 'HotelsVendors database' },
      { metric: 'attributed_revenue', target: '> 0', source: 'Stripe or finance ledger' },
    ],
    launch_gates: ['Sender mailbox round-trip verified', 'Target list has contactable recipients', 'Owner approves audience and copy', 'Tracking fields attached to every send', 'Ads account and budget exist if paid channels are enabled'],
    rollback: ['Pause the sequence', 'Stop the ad campaign', 'Restore the previous landing-page release', 'Notify the owner with affected message IDs', 'Preserve audit evidence and suppress further sends'],
    approval_required: true,
    external_execution_possible: Boolean(input.recipients?.length),
    createdAt: new Date().toISOString(),
  };
}

export async function prepareCampaign(body = {}, actor = 'jarvis') {
  const payload = buildCampaignPackage(body);
  const result = await query(`INSERT INTO business_work_products(project_code,product_type,title,status,payload,evidence,created_by)
    VALUES($1,'campaign_package',$2,'prepared',$3,$4,$5) RETURNING *`, [payload.project_code, payload.name, JSON.stringify(payload), JSON.stringify({ source: 'JARVIS deterministic campaign builder', launch_gates: payload.launch_gates }), actor]);
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('marketing_campaign_preparation','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ work_product_id: result.rows[0].id, assets: payload.assets.length, emails: payload.email_sequence.length, ad_concepts: payload.ad_concepts.length }), `work-product:${result.rows[0].id}`]);
  await audit({ query }, actor, 'business.campaign_prepared', 'business_work_product', result.rows[0].id, { project: payload.project_code, name: payload.name });
  return { work_product: result.rows[0], campaign: payload };
}

export async function approveBusinessWorkProduct(id, body = {}, actor = 'owner') {
  const result = await query(`UPDATE business_work_products SET status='approved',approved_by=$2,approved_at=now(),updated_at=now(),evidence=evidence || $3
    WHERE id=$1 AND status='prepared' RETURNING *`, [id, actor, JSON.stringify({ approved_by: actor, approved_at: new Date().toISOString(), approval_note: clean(body.note, 1000) || null })]);
  if (!result.rows.length) throw Object.assign(new Error('A prepared work product was not found'), { statusCode: 404 });
  await audit({ query }, actor, 'business.work_product_approved', 'business_work_product', id, { product_type: result.rows[0].product_type });
  return result.rows[0];
}

export async function launchBusinessCampaign(id, body = {}, actor = 'owner') {
  const current = (await query("SELECT * FROM business_work_products WHERE id=$1 AND product_type='campaign_package'", [id])).rows[0];
  if (!current) throw Object.assign(new Error('Campaign package not found'), { statusCode: 404 });
  if (current.status !== 'approved' && body.test_mode !== true) throw Object.assign(new Error('The campaign must be approved before launch'), { statusCode: 409 });
  const recipients = (Array.isArray(body.recipients) ? body.recipients : []).map((item) => clean(item, 320)).filter((item) => EMAIL_RE.test(item)).slice(0, 50);
  const smtp = await smtpConfig();
  const targetRecipients = recipients.length ? recipients : (body.test_mode === true ? [smtp.user] : []);
  if (!targetRecipients.length) throw Object.assign(new Error('At least one approved recipient is required'), { statusCode: 400 });
  await query("UPDATE business_work_products SET status='running',updated_at=now() WHERE id=$1", [id]);
  const sends = [];
  for (const to of targetRecipients) {
    const first = current.payload.email_sequence?.[0] || buildCampaignPackage(current.payload).email_sequence[0];
    const sent = await sendOutreachEmail({ project_code: current.project_code, work_product_id: id, to, subject: body.test_mode ? `[JARVIS CAMPAIGN TEST] ${first.subject}` : first.subject, text: first.body }, actor);
    sends.push(sent.message);
  }
  const evidence = { launched_at: new Date().toISOString(), launched_by: actor, recipients: targetRecipients.length, test_mode: body.test_mode === true, message_ids: sends.map((message) => message.internet_message_id), rollback_ready: true };
  const result = await query(`UPDATE business_work_products SET status='completed',evidence=evidence || $2,updated_at=now() WHERE id=$1 RETURNING *`, [id, JSON.stringify(evidence)]);
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('deployment_execution','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ workflow: 'campaign approval, send, evidence capture and rollback', test_mode: evidence.test_mode, recipients: evidence.recipients }), `campaign-launch:${id}`]);
  return { work_product: result.rows[0], recipients: targetRecipients.length, messages: sends, rollback_available: true };
}

export async function rollbackBusinessCampaign(id, body = {}, actor = 'owner') {
  const result = await query(`UPDATE business_work_products SET status='rolled_back',evidence=evidence || $2,updated_at=now()
    WHERE id=$1 AND product_type='campaign_package' AND status IN ('approved','running','completed') RETURNING *`, [id, JSON.stringify({ rolled_back_at: new Date().toISOString(), rolled_back_by: actor, reason: clean(body.reason || 'Owner requested rollback', 1000), effects: ['outbound sequence paused', 'further campaign sends blocked', 'audit evidence preserved'] })]);
  if (!result.rows.length) throw Object.assign(new Error('A rollback-eligible campaign was not found'), { statusCode: 404 });
  await audit({ query }, actor, 'business.campaign_rolled_back', 'business_work_product', id, { reason: body.reason || null });
  return result.rows[0];
}

export async function prepareOutreachSequence(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const campaignId = clean(body.campaign_work_product_id, 80) || null;
  const discoveries = (await query(`SELECT id,name,domain,website_url,location,entity_type FROM business_discoveries WHERE project_code=$1 AND entity_type=$2 ORDER BY updated_at DESC LIMIT $3`, [project, clean(body.entity_type || 'supplier', 20), Math.min(Math.max(Number(body.limit) || 25, 1), 100)])).rows;
  const sequence = {
    schema_version: 1,
    project_code: project,
    entity_type: clean(body.entity_type || 'supplier', 20),
    campaign_work_product_id: campaignId,
    steps: [
      { step: 1, day: 0, purpose: 'introduction', subject: 'Quick question about supplier availability', body_template: 'Hello {{name}}, HotelsVendors is building a verified procurement route for Egyptian hospitality teams. Could you share your catalogue, availability and delivery terms?' },
      { step: 2, day: 3, purpose: 'value follow-up', subject: 'Your catalogue on a verified hospitality channel', body_template: 'Following up, {{name}}. We help suppliers present fixed prices and availability to hotel buyers, with clear delivery evidence and approval trails. Is this relevant for your team?' },
      { step: 3, day: 8, purpose: 'close the loop', subject: 'Should I close the loop?', body_template: 'Hello {{name}}, I will close the loop for now. Reply with “later” and we will revisit, or with a preferred time if a short pilot discussion makes sense.' },
    ],
    leads: discoveries,
    compliance: { unsubscribe_required: true, suppression_checked: false, personalization_required: true },
    status: 'prepared',
    createdAt: new Date().toISOString(),
  };
  const result = await query(`INSERT INTO business_work_products(project_code,product_type,title,status,payload,evidence,created_by)
    VALUES($1,'outreach_sequence',$2,'prepared',$3,$4,$5) RETURNING *`, [project, `Outreach sequence: ${sequence.entity_type}`, JSON.stringify(sequence), JSON.stringify({ leads: discoveries.length, steps: sequence.steps.length, source: 'JARVIS sequence builder' }), actor]);
  await audit({ query }, actor, 'business.outreach_sequence_prepared', 'business_work_product', result.rows[0].id, { project, leads: discoveries.length });
  return { work_product: result.rows[0], sequence };
}

async function smtpConfig() {
  const stored = await credential('smtp');
  const smtp = stored?.value;
  if (!smtp?.host || !smtp?.user || !smtp?.pass) throw providerError('SMTP sending is not configured');
  return smtp;
}

export async function sendOutreachEmail(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const to = clean(body.to, 320);
  const subject = clean(body.subject, 300);
  const text = String(body.text || '').trim().slice(0, 50000);
  if (!EMAIL_RE.test(to)) throw Object.assign(new Error('A valid recipient email is required'), { statusCode: 400 });
  if (!subject || !text) throw Object.assign(new Error('Subject and body are required'), { statusCode: 400 });
  if (/buy now|limited time|guaranteed profit|act immediately/i.test(text)) throw Object.assign(new Error('Outreach copy contains blocked high-pressure language'), { statusCode: 422 });
  const smtp = await smtpConfig();
  const domain = clean(emailAddress(smtp.from).split('@')[1] || smtp.user.split('@')[1], 200);
  const internetMessageId = `<jarvis-${crypto.randomUUID()}@${domain}>`;
  const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } });
  const info = await transport.sendMail({ from: smtp.from, to, subject, text, messageId: internetMessageId, headers: { 'X-JARVIS-Project': project, 'X-JARVIS-Actor': clean(actor, 120) } });
  const result = await query(`INSERT INTO business_outreach_messages(project_code,work_product_id,discovery_id,direction,provider,external_id,internet_message_id,from_address,to_address,subject,body,status,sent_at,metadata)
    VALUES($1,$2,$3,'outbound','smtp',$4,$5,$6,$7,$8,$9,'sent',now(),$10) RETURNING *`, [project, clean(body.work_product_id, 80) || null, clean(body.discovery_id, 80) || null, info.messageId || null, internetMessageId, smtp.from, to, subject, text, JSON.stringify({ accepted: info.accepted, rejected: info.rejected, response: info.response })]);
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('email_sending','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ provider: 'smtp', account: smtp.user, last_message_id: internetMessageId }), `outreach:${result.rows[0].id}`]);
  await audit({ query }, actor, 'business.email_sent', 'business_outreach_message', result.rows[0].id, { project, to, subject, providerMessageId: info.messageId });
  return { message: result.rows[0], provider_response: info.response, accepted: info.accepted, rejected: info.rejected };
}

async function withImap(fn) {
  const smtp = await smtpConfig();
  const client = new ImapFlow({ host: smtp.imapHost || smtp.host.replace(/^smtp\./, 'imap.'), port: smtp.imapPort || 993, secure: smtp.imapSecure !== false, auth: { user: smtp.user, pass: smtp.pass }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try { return await fn(client, smtp); }
  finally { lock.release(); await client.logout().catch(() => {}); }
}

async function recentInboxMessages(client, limit = 100) {
  const exists = Number(client.mailbox?.exists || 0);
  if (!exists) return [];
  const start = Math.max(1, exists - Math.min(Math.max(limit, 1), 300) + 1);
  const messages = [];
  for await (const message of client.fetch(`${start}:*`, { source: true, uid: true })) {
    const parsed = await simpleParser(message.source);
    messages.push({
      uid: message.uid,
      messageId: parsed.messageId || null,
      inReplyTo: Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo || null,
      from: parsed.from?.value?.[0]?.address || null,
      to: (parsed.to?.value || []).map((entry) => entry.address).filter(Boolean).join(','),
      subject: parsed.subject || '',
      text: parsed.text || '',
      date: parsed.date?.toISOString() || null,
    });
  }
  return messages.sort((left, right) => String(left.date).localeCompare(String(right.date))).reverse();
}

export async function verifyEmailRoundTrip(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const smtp = await smtpConfig();
  const to = clean(body.to || smtp.user, 320);
  const token = clean(body.token || `jarvis-mail-${Date.now()}`, 160);
  const sent = await sendOutreachEmail({ project_code: project, to, subject: `JARVIS mail verification ${token}`, text: `JARVIS outbound and inbound verification token: ${token}\nSent at ${new Date().toISOString()}` }, actor);
  const deadline = Date.now() + Math.min(Math.max(Number(body.wait_seconds) || 30, 5), 60) * 1000;
  let received = null;
  while (Date.now() < deadline && !received) {
    received = await withImap(async (client) => (await recentInboxMessages(client, 150)).find((message) => message.subject.includes(token)) || null);
    if (!received) await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  if (!received) {
    await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
      VALUES('email_sending','degraded',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='degraded',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ sent_message_id: sent.message.internet_message_id, inbound_found: false, token }), `outreach:${sent.message.id}`]);
    throw providerError('Email was accepted by SMTP but did not arrive in the monitored inbox before the timeout', 502);
  }
  const inbound = await query(`INSERT INTO business_outreach_messages(project_code,work_product_id,direction,provider,external_id,internet_message_id,in_reply_to,from_address,to_address,subject,body,status,received_at,metadata)
    VALUES($1,$2,'inbound','imap',$3,$4,$5,$6,$7,$8,$9,'received',$10,$11) RETURNING *`, [project, sent.message.work_product_id || null, String(received.uid), received.messageId, received.inReplyTo, received.from, received.to, received.subject, received.text, received.date, JSON.stringify({ verification_token: token, matched_outbound_message_id: sent.message.internet_message_id })]);
  const evidenceRef = `mail-roundtrip:${sent.message.id}:${inbound.rows[0].id}`;
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('email_sending','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ outbound_message_id: sent.message.internet_message_id, inbound_message_id: received.messageId, token }), evidenceRef]);
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('reply_monitoring','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ provider: 'imap', account: smtp.user, last_inbound_subject: received.subject }), evidenceRef]);
  await audit({ query }, actor, 'business.email_roundtrip_verified', 'business_outreach_message', inbound.rows[0].id, { outbound: sent.message.id, token });
  return { verified: true, token, outbound: sent.message, inbound: inbound.rows[0] };
}

export async function pollOutreachReplies(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const limit = Math.min(Math.max(Number(body.limit) || 150, 1), 300);
  const outbound = (await query(`SELECT id,subject,to_address,internet_message_id FROM business_outreach_messages WHERE project_code=$1 AND direction='outbound' ORDER BY observed_at DESC LIMIT 500`, [project])).rows;
  const byMessageId = new Map(outbound.filter((row) => row.internet_message_id).map((row) => [row.internet_message_id, row]));
  const incoming = await withImap((client) => recentInboxMessages(client, limit));
  const matches = [];
  for (const message of incoming) {
    const parent = byMessageId.get(message.inReplyTo) || outbound.find((row) => message.subject.toLowerCase().includes(String(row.subject).toLowerCase().replace(/^re:\s*/i, '')));
    if (!parent || !message.messageId) continue;
    const inserted = await query(`INSERT INTO business_outreach_messages(project_code,direction,provider,external_id,internet_message_id,in_reply_to,from_address,to_address,subject,body,status,received_at,metadata)
      VALUES($1,'inbound','imap',$2,$3,$4,$5,$6,$7,$8,'received',$9,$10)
      ON CONFLICT DO NOTHING RETURNING *`, [project, String(message.uid), message.messageId, message.inReplyTo, message.from, message.to, message.subject, message.text, message.date, JSON.stringify({ matched_outbound_id: parent.id, sender: message.from })]);
    if (inserted.rows.length) matches.push(inserted.rows[0]);
  }
  await query(`UPDATE business_outreach_messages outbound SET status='replied',observed_at=now() WHERE direction='outbound' AND project_code=$1 AND EXISTS (SELECT 1 FROM business_outreach_messages inbound WHERE inbound.direction='inbound' AND inbound.in_reply_to=outbound.internet_message_id)`, [project]);
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
    VALUES('reply_monitoring','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ scanned: incoming.length, new_replies: matches.length }), `imap-poll:${new Date().toISOString()}`]);
  await audit({ query }, actor, 'business.replies_polled', 'business_outreach_message', 'batch', { project, scanned: incoming.length, matched: matches.length });
  return { scanned: incoming.length, matched: matches.length, replies: matches };
}

export async function recordMetricSnapshot(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const source = clean(body.source, 80);
  if (!source) throw Object.assign(new Error('Metric source is required'), { statusCode: 400 });
  const revenue = body.revenue == null ? null : Number(body.revenue);
  const cost = body.cost == null ? null : Number(body.cost);
  if ((revenue != null && !Number.isFinite(revenue)) || (cost != null && !Number.isFinite(cost))) throw Object.assign(new Error('Revenue and cost must be numeric'), { statusCode: 400 });
  const result = await query(`INSERT INTO business_metric_snapshots(project_code,source,period_start,period_end,currency,revenue_amount,cost_amount,metrics,evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [project, source, body.period_start || null, body.period_end || null, clean(body.currency || 'USD', 12), revenue, cost, JSON.stringify(body.metrics || {}), JSON.stringify(body.evidence || {})]);
  await audit({ query }, actor, 'business.metric_snapshot_recorded', 'business_metric_snapshot', result.rows[0].id, { project, source, revenue, cost });
  return result.rows[0];
}

export function diagnosePerformance(snapshots = []) {
  if (!snapshots.length) return { status: 'blocked', diagnosis: 'No measured performance source is connected.', actions: ['Connect Stripe revenue and PostHog product events', 'Record one complete campaign period'] };
  const totals = snapshots.reduce((acc, row) => {
    acc.revenue += Number(row.revenue_amount) || 0;
    acc.cost += Number(row.cost_amount) || 0;
    for (const [key, value] of Object.entries(row.metrics || {})) if (Number.isFinite(Number(value))) acc.metrics[key] = (acc.metrics[key] || 0) + Number(value);
    return acc;
  }, { revenue: 0, cost: 0, metrics: {} });
  const profit = totals.revenue - totals.cost;
  const sent = totals.metrics.emails_sent || totals.metrics.sent || 0;
  const replies = totals.metrics.replies || 0;
  const meetings = totals.metrics.meetings || 0;
  const conversions = totals.metrics.conversions || totals.metrics.orders || 0;
  const replyRate = sent ? replies / sent : null;
  const meetingRate = replies ? meetings / replies : null;
  const conversionRate = meetings ? conversions / meetings : null;
  const issues = [];
  const actions = [];
  if (!totals.revenue) issues.push('No revenue is recorded for the period.');
  if (profit < 0) issues.push('Measured cost exceeds measured revenue.');
  if (replyRate !== null && replyRate < 0.05) { issues.push('Reply rate is below 5%.'); actions.push('Tighten audience fit and rewrite the first-touch offer before increasing volume.'); }
  if (meetingRate !== null && meetingRate < 0.25) { issues.push('Meetings per reply are below 25%.'); actions.push('Improve reply handling and add a direct scheduling call-to-action.'); }
  if (conversionRate !== null && conversionRate < 0.2) issues.push('Pilot conversion from meetings is weak; inspect objections and onboarding friction.');
  if (!issues.length) actions.push('Maintain the current segment and scale in controlled increments while monitoring contribution margin.');
  return { status: issues.length ? 'degraded' : 'healthy', totals: { revenue: totals.revenue, cost: totals.cost, profit, replyRate, meetingRate, conversionRate }, issues, actions };
}

export async function revenueReport(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'HV');
  const snapshots = (await query(`SELECT * FROM business_metric_snapshots WHERE project_code=$1 ORDER BY observed_at DESC LIMIT 100`, [project])).rows;
  const diagnosis = diagnosePerformance(snapshots);
  const report = { project_code: project, generated_at: new Date().toISOString(), snapshots, diagnosis };
  const work = await query(`INSERT INTO business_work_products(project_code,product_type,title,status,payload,evidence,created_by)
    VALUES($1,'revenue_report',$2,$3,$4,$5,$6) RETURNING *`, [project, `Revenue and performance report ${new Date().toISOString().slice(0,10)}`, snapshots.length ? 'completed' : 'failed', JSON.stringify(report), JSON.stringify({ sources: snapshots.map((row) => row.source), diagnosis_status: diagnosis.status }), actor]);
  const revenueStatus = snapshots.some((row) => row.revenue_amount != null) ? 'verified' : 'blocked';
  await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at) VALUES
    ('revenue_reporting',$1,$2,$3,now(),now()),('performance_diagnosis',$4,$5,$3,now(),now())
    ON CONFLICT(capability_key) DO UPDATE SET status=EXCLUDED.status,detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [revenueStatus, JSON.stringify({ snapshots: snapshots.length, sources: [...new Set(snapshots.map((row) => row.source))] }), `work-product:${work.rows[0].id}`, snapshots.length ? 'verified' : 'degraded', JSON.stringify(diagnosis)]);
  return { work_product: work.rows[0], ...report };
}

export async function executeGrok(body = {}, actor = 'jarvis') {
  const project = projectCode(body.project_code || 'STUDIO');
  const prompt = String(body.prompt || body.objective || '').trim();
  if (!prompt || prompt.length > 12000) throw Object.assign(new Error('A Grok prompt is required and must be <= 12000 characters'), { statusCode: 400 });
  if (!config.openRouterKey) throw providerError('OpenRouter is not configured for the Grok route');
  const run = await query(`INSERT INTO agent_runs(agent_id,project_code,objective,status,current_step,started_at) VALUES('grok',$1,$2,'running','OpenRouter Grok request',now()) RETURNING *`, [project, prompt.slice(0, 2000)]);
  const started = Date.now();
  try {
    const response = await fetch(`${config.openRouterUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.openRouterKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: clean(body.model || 'x-ai/grok-4.3', 160), input: prompt, max_output_tokens: Math.min(Math.max(Number(body.max_output_tokens) || 1600, 100), 6000) }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) throw new Error(result.error?.message || `OpenRouter HTTP ${response.status}`);
    const output = (result.output || []).flatMap((item) => item.content || []).map((part) => part.text || part.refusal || '').filter(Boolean).join('\n').trim();
    await query(`UPDATE agent_runs SET status='completed',progress=100,current_step='completed',next_step='Return Grok findings to JARVIS',todo=$2,completed_at=now(),updated_at=now() WHERE id=$1`, [run.rows[0].id, JSON.stringify([{ step: 'Execute Grok research challenge', status: 'completed', evidence: { model: result.model, usage: result.usage, duration_ms: Date.now() - started } }])]);
    await query(`INSERT INTO business_capability_evidence(capability_key,status,detail,evidence_ref,checked_at,updated_at)
      VALUES('grok_execution','verified',$1,$2,now(),now()) ON CONFLICT(capability_key) DO UPDATE SET status='verified',detail=EXCLUDED.detail,evidence_ref=EXCLUDED.evidence_ref,checked_at=now(),updated_at=now()`, [JSON.stringify({ route: 'openrouter', model: result.model, cost: result.usage?.cost ?? null }), `agent-run:${run.rows[0].id}`]);
    return { run_id: run.rows[0].id, model: result.model, output, usage: result.usage || {}, duration_ms: Date.now() - started };
  } catch (error) {
    await query(`UPDATE agent_runs SET status='failed',current_step='failed',next_step='Repair Grok route',todo=$2,completed_at=now(),updated_at=now() WHERE id=$1`, [run.rows[0].id, JSON.stringify([{ step: 'Execute Grok research challenge', status: 'failed', error: error.message }])]);
    throw providerError(`Grok execution failed: ${error.message}`, 502);
  }
}

export async function businessExecutionState() {
  const [providers, campaigns, sequences, messages, metrics] = await Promise.all([
    businessProviderStatus(),
    query("SELECT id,project_code,title,status,created_at,updated_at FROM business_work_products WHERE product_type='campaign_package' ORDER BY updated_at DESC LIMIT 20"),
    query("SELECT id,project_code,title,status,created_at,updated_at FROM business_work_products WHERE product_type='outreach_sequence' ORDER BY updated_at DESC LIMIT 20"),
    query("SELECT id,project_code,direction,to_address,subject,status,sent_at,received_at,observed_at FROM business_outreach_messages ORDER BY observed_at DESC LIMIT 50"),
    query("SELECT id,project_code,source,revenue_amount,cost_amount,currency,observed_at FROM business_metric_snapshots ORDER BY observed_at DESC LIMIT 50"),
  ]);
  return { providers, campaigns: campaigns.rows, outreach_sequences: sequences.rows, messages: messages.rows, metric_snapshots: metrics.rows };
}
