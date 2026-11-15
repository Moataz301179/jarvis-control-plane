import { loadBusinessProfile } from './business-profile.js';
import { agentRingConfigured } from './agent-ring.js';
import { query } from './db.js';

const TOOL_HINTS = [
  { match: ['find', 'search', 'discover', 'lead', 'prospect', 'supplier', 'hotel', 'contact'], tools: ['apollo_search', 'web_search', 'hermes:browser'] },
  { match: ['email', 'outreach', 'send', 'draft', 'followup', 'follow-up'], tools: ['apollo_send', 'gmail_send', 'hermes:files'] },
  { match: ['campaign', 'ad', 'ads', 'marketing', 'promotion'], tools: ['ads_manager_create', 'ads_manager_insights', 'apollo_send'] },
  { match: ['revenue', 'performance', 'report', 'analyse', 'analyze', 'kpi', 'profit'], tools: ['profit_ledger_read', 'stripe_reports', 'ads_manager_insights'] },
  { match: ['onboard', 'supplier_onboarding', 'hotel_onboarding', 'register', 'sign_up'], tools: ['hermes:files', 'hermes:code_execution', 'database_write'] },
  { match: ['deploy', 'release', 'publish', 'build'], tools: ['hermes:code_execution', 'github_repo', 'deployment_adapters'] },
  { match: ['phone', 'call', 'ring', 'escalate', 'urgent'], tools: ['agent_ring_call'] },
  { match: ['remember', 'memory', 'note'], tools: ['memory_write'] },
  { match: ['image', 'picture', 'photo', 'render', 'illustration', 'logo', 'design asset'], tools: ['hermes:image_gen', 'hermes:vision'] },
  { match: ['video', 'reel', 'clip', 'animation', 'film'], tools: ['hermes:video_gen', 'hermes:video'] },
  { match: ['install skill', 'install a skill', 'new skill', 'github skill', 'skills add'], tools: ['skill_installer', 'github_repo'] },
  { match: ['voice', 'speak', 'tts', 'narration'], tools: ['hermes:tts', 'elevenlabs_tts'] },
  { match: ['research', 'deep dive', 'competitor', 'market'], tools: ['web_search', 'hermes:web', 'hermes:x_search'] },
];

function normalizeText(value) {
  return String(value ?? '').toLowerCase();
}

export async function resolveTask({ task, project_code = 'STUDIO', budget_usd = null, deadline = null }) {
  const taskText = normalizeText(task);
  const profile = await loadBusinessProfile();
  const ring = await agentRingConfigured().catch(() => ({ configured: false }));
  const matched = [];
  for (const entry of TOOL_HINTS) {
    if (entry.match.some((word) => taskText.includes(word))) matched.push(...entry.tools);
  }
  const uniqueTools = [...new Set(matched)];
  const requiredToolsets = uniqueTools.filter((t) => t.startsWith('hermes:')).map((t) => t.replace('hermes:', ''));
  const toolStatus = [];
  for (const tool of uniqueTools) {
    if (tool === 'agent_ring_call') {
      toolStatus.push({ tool, status: ring.configured ? 'ready' : 'blocked', reason: ring.configured ? 'agent-ring bridge configured' : 'AGENT_RING_URL not set' });
      continue;
    }
    if (!tool.startsWith('hermes:')) {
      const known = ['apollo_search','apollo_send','gmail_send','ads_manager_create','ads_manager_insights','profit_ledger_read','stripe_reports','database_write','github_repo','deployment_adapters','memory_write','skill_installer','elevenlabs_tts'];
      toolStatus.push({ tool, status: known.includes(tool) ? 'declared' : 'blocked', reason: known.includes(tool) ? 'declared connector; verify credentials at execution time' : 'no connector registered for this capability' });
      continue;
    }
    const key = tool.replace('hermes:', '');
    let found = null;
    try {
      const rows = await query(
        `SELECT status FROM agent_capability_registry WHERE capability_type=$1 AND capability_key=$2 AND status <> 'stale' ORDER BY (status='verified') DESC, updated_at DESC LIMIT 1`,
        ['toolset', key],
      );
      found = rows.rows[0] || null;
    } catch { found = null; }
    toolStatus.push({ tool, status: found?.status || 'unknown', reason: found ? 'found in Hermes registry' : `toolset ${key} not present in registry` });
  }
  const blockers = toolStatus.filter((t) => t.status === 'blocked').map((t) => ({ tool: t.tool, reason: t.reason }));
  return {
    task: String(task || '').slice(0, 2000),
    project_code,
    budget_usd: budget_usd ? Number(budget_usd) : null,
    deadline: deadline || null,
    owner_context_available: Boolean(profile?.profile),
    owner_context_gaps: profile ? null : 'business profile has not been captured; run the interview at /v1/business-profile',
    resolved_tools: uniqueTools,
    tool_status: toolStatus,
    blockers,
    ready: blockers.length === 0 && Boolean(profile?.profile),
    profile_version: profile?.version || null,
  };
}
