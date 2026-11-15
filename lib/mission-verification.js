import crypto from 'node:crypto';
export const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function agentText(result) {
  if (typeof result === 'string') return result;
  const output = result?.output || '';
  try { const parsed = JSON.parse(output); if (typeof parsed.result === 'string') return parsed.result; } catch {}
  const messages = [];
  for (const line of output.split('\n')) {
    try { const event = JSON.parse(line); if (event.item?.type === 'agent_message') messages.push(event.item.text); } catch {}
  }
  return messages.join('\n') || output;
}

export function parseStructuredReview(result) {
  const text = agentText(result).trim();
  const candidates = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  candidates.push(text);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

export function verifyMission(run) {
  const reasons = [];
  const last = run.jobs.at(-1);
  const artifacts = run.jobs.slice(0,-1).map(j=>({id:j.id,runtime:j.runtime,profile:j.profile||null,role:j.role||null,text:agentText(j.result)}));
  const expectedDigest = digest(artifacts);
  const review = parseStructuredReview(last?.result);
  if (!review) reasons.push('Reviewer did not return structured findings');
  if (last?.phase !== 'review' || artifacts.some(a => last?.profile ? a.profile === last.profile : a.runtime === last?.runtime)) reasons.push('Independent reviewer is required');
  if (!artifacts.length || artifacts.some(a=>!a.text.trim())) reasons.push('Required work product is missing');
  if (review?.verdict !== 'pass') reasons.push('Review did not pass');
  const criteria = run.plan.acceptanceCriteria || [];
  if (!criteria.length || criteria.some((criterion,index)=>!review?.checks?.some(c=>c.index===index&&c.passed===true&&typeof c.evidence==='string'&&c.evidence.trim().length>=20))) reasons.push('Acceptance criteria are not fully evidenced');
  return {
    verified:reasons.length===0,
    reasons,
    scope:'prepared_work_product_only',
    artifact_digest:expectedDigest,
    reviewer_reported_digest:review?.artifact_digest||null,
    digest_owner:'jarvis-deterministic-verifier',
    digest_mismatch:Boolean(review?.artifact_digest && review.artifact_digest!==expectedDigest),
    artifacts,
    review:review||null,
    checkedAt:new Date().toISOString(),
  };
}
