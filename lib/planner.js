function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
}

export function deterministicPlan(title, objective) {
  const text = `${title} ${objective}`.toLowerCase();
  if (/backup|restore|recovery proof/.test(text)) {
    return {
      source: 'deterministic:backup-verification',
      tasks: [{ title: 'Verify the newest restore-tested database backup', tool: 'backup_verify', input: {} }],
    };
  }
  if (/database|release inventory|runtime status|service state|deployment inventory/.test(text)) {
    return {
      source: 'deterministic:runtime-inventory',
      tasks: [
        { title: 'Verify JARVIS database structure and workflow counts', tool: 'database_health', input: {} },
        { title: 'Verify the active release and migration inventory', tool: 'release_inventory', input: {} },
        { title: 'Verify authenticated JARVIS service state', tool: 'service_status', input: { services: ['jarvis-api','jarvis-worker','jarvis-verifier','jarvis-operations','jarvis-telegram'] } },
      ],
    };
  }
  if (/health|status|availability|reachable/.test(text)) {
    return {
      source: 'deterministic:service-health',
      tasks: [
        { title: 'Probe JARVIS health endpoint', tool: 'http_probe', input: { target: 'jarvis' } },
        { title: 'Probe HotelsVendors public health endpoint', tool: 'http_probe', input: { target: 'hotelsvendors' } },
      ],
    };
  }
  return {
    source: 'deterministic:safe-baseline',
    tasks: [{ title: 'Verify JARVIS database health', tool: 'database_health', input: {} }],
  };
}

function parseModelPlan(content) {
  const clean = String(content || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(clean);
  if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length < 1 || parsed.tasks.length > 8) throw new Error('invalid plan');
  const allowed = new Set(['http_probe','database_health','service_status','release_inventory','workspace_inventory','backup_verify']);
  const tasks = parsed.tasks.map((task) => ({
    title: String(task.title || 'Unnamed task').slice(0, 200),
    tool: String(task.tool || ''),
    input: task.input && typeof task.input === 'object' ? task.input : {},
  }));
  if (tasks.some((task) => !allowed.has(task.tool))) throw new Error('unsupported tool in plan');
  return { source: 'ollama', tasks };
}

export async function createPlan({ title, objective, constraints, acceptanceCriteria, provider = 'ollama', ollamaUrl, openRouterUrl, openRouterKey, model }) {
  const text = `${title} ${objective}`.toLowerCase();
  if (/health|status|availability|reachable|backup|restore|recovery proof|database|release inventory|runtime status|service state|deployment inventory/.test(text)) return deterministicPlan(title, objective);

  try {
    const prompt = `Create a concise execution plan. Return JSON only: {"tasks":[{"title":"...","tool":"database_health","input":{}}]}. Allowed safe read-only tools: http_probe (targets jarvis or hotelsvendors), database_health, service_status (allowlisted JARVIS services), release_inventory, workspace_inventory (allowlisted scopes current_release/services/studio_workspaces/hv_workspaces/backups), backup_verify. Maximum 5 tasks. Never invent credentials, execute mutations, or use other hosts. Objective: ${objective}. Constraints: ${strings(constraints).join('; ')}. Acceptance: ${strings(acceptanceCriteria).join('; ')}`;
    if (provider === 'openrouter') {
      if (!openRouterKey) throw new Error('OpenRouter is not configured');
      const response = await fetch(`${openRouterUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${openRouterKey}`, 'content-type': 'application/json', 'x-title': 'JARVIS Control Plane' },
        body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
      const body = await response.json();
      return parseModelPlan(body.choices?.[0]?.message?.content);
    }
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: 'json', prompt }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const body = await response.json();
    return parseModelPlan(body.response);
  } catch {
    return deterministicPlan(title, objective);
  }
}
