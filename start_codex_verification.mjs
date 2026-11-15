import { config } from '/srv/jarvis/current/lib/config.js';

const response = await fetch('http://127.0.0.1:3100/v1/agents/codex/jobs', {
  method: 'POST',
  headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    project_code: 'STUDIO',
    workspace: '/Users/Moatazi/Documents/ChatGPT/jarvis-codex-smoke',
    task_class: 'build',
    prompt: `Work only in the current workspace. Create a dependency-free Node.js module named health-summary.mjs that exports summarizeHealth(value), validating that value.ok is boolean and value.database is "ready", and returning {healthy:true,label:"JARVIS healthy"} when valid, otherwise {healthy:false,label:"JARVIS unhealthy"}. Add health-summary.test.js using node:test with passing and failing cases. Add package.json with a test script that runs node --test. Run npm test. Commit the finished change to git. Return the exact commit SHA, changed files, and test result. Do not deploy, push, or contact anyone.`,
  }),
});
const body = await response.json();
if (!response.ok) throw new Error(JSON.stringify(body));
console.log(JSON.stringify({ id: body.id, status: body.status, route: body.modelRoute, preflight: body.preflight }));
