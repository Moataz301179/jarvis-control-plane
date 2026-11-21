export function buildTranscript(messages, maxChars = 6000) {
  const lines = (messages || [])
    .map((message) => `${message.role}: ${String(message.content || '').replace(/\s+/g, ' ').trim()}`)
    .filter((line) => line.length > 6);
  let text = '';
  for (const line of lines) {
    if (text.length + line.length > maxChars) break;
    text += `${line}\n`;
  }
  return text.trim();
}

export function extractiveSummary(messages) {
  const list = messages || [];
  const user = list.filter((message) => message.role === 'user').map((message) => String(message.content || '').trim()).filter(Boolean);
  const assistant = list.filter((message) => message.role === 'assistant').map((message) => String(message.content || '').trim()).filter(Boolean);
  const first = user[0] ? `Owner asked: ${user[0].slice(0, 240)}` : '';
  const recent = assistant.slice(-2).map((reply) => `JARVIS: ${reply.slice(0, 240)}`).join(' ');
  return [first, recent].filter(Boolean).join(' ').slice(0, 700);
}
