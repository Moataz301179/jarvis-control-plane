import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const apiKey = process.env.ELEVENLABS_API_KEY;
const ownerToken = process.env.JARVIS_OWNER_TOKEN;
const agentId = process.env.ELEVENLABS_AGENT_ID || 'agent_0001m6zv6f53f8etzfdge5rbnhw7';
const baseUrl = process.env.JARVIS_BASE_URL || 'http://127.0.0.1:13100';

if (!apiKey || !ownerToken) throw new Error('Required credentials are missing from the process environment');

const client = new ElevenLabsClient({ apiKey });
const agent = await client.conversationalAi.agents.get(agentId);
if (!agent || agent.agentId !== agentId) throw new Error('ElevenLabs agent verification failed');

const response = await fetch(`${baseUrl}/v1/providers/elevenlabs`, {
  method: 'POST',
  headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({ api_key: apiKey, agent_id: agentId }),
  signal: AbortSignal.timeout(20000),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(result.error || `Credential sync failed with HTTP ${response.status}`);

console.log(JSON.stringify({ agent_name: agent.name, agent_id: agent.agentId, configured: result.configured, ready: result.ready }, null, 2));
