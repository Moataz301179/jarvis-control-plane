const base = (process.env.JARVIS_HERMES_BRIDGE_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) process.exit(0);
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error(`JARVIS API did not become healthy at ${base}/health within 60 seconds`);
process.exit(1);
