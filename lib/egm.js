export const EGM_SOURCE = 'google/elephant-goldfish-model';

export const EGM_MODES = Object.freeze({
  off: null,
  brainstorm: '/egm:egm-brainstorm',
  draft: '/egm:egm-draft',
  review: '/egm:egm-review',
  resolve: '/egm:egm-resolve',
  'review-loop': '/egm:egm-review-loop',
  bootstrap: '/egm:egm-bootstrap',
  'drift-report': '/egm:egm-drift-report',
});

export function normalizeEgmMode(value) {
  const mode = String(value || 'off').trim().toLowerCase();
  return Object.hasOwn(EGM_MODES, mode) ? mode : 'off';
}

export function egmPrompt(mode, prompt) {
  const normalized = normalizeEgmMode(mode);
  const command = EGM_MODES[normalized];
  if (!command) return String(prompt || '');
  return `${command}\n\n${String(prompt || '').trim()}\n\nEGM execution contract: use the installed Elephant-Goldfish Model plugin as the workflow and evidence system. Keep drafting and orchestration in the main thread. Persist briefs, drafts and reports in the approved workspace. Do not claim completion without concrete test, runtime or artifact evidence.`;
}
