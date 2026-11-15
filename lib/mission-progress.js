export function nextMissionState(run, job) {
  if (!job) return { status: 'blocked', reason: 'Dispatched job is missing; automatic redispatch is unsafe.' };
  if (['failed','cancelled'].includes(job.status)) return { status: 'blocked', reason: job.error || job.status };
  if (job.status !== 'succeeded') return { status: 'waiting' };
  return run.step >= run.plan.delegations.length
    ? { status: 'awaiting_verification' }
    : { status: 'ready' };
}
