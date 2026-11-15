export const HERMES_TEAM = Object.freeze([
  {
    role: 'chief_of_staff', profile: 'chief', title: 'Chief of Staff',
    expertise: ['outcome decomposition', 'specialist routing', 'handoffs', 'approval boundaries', 'mission reporting'],
    toolsets: ['delegation','kanban','memory','session_search','todo','clarify'],
    owns: ['plan', 'delegate', 'reconcile', 'report'],
    does_not: ['perform specialist work', 'self-verify', 'deploy directly'],
  },
  {
    role: 'lead_scout', profile: 'scout', title: 'Lead Scout',
    expertise: ['supplier discovery', 'hotel discovery', 'contact research', 'source verification', 'Apollo enrichment'],
    toolsets: ['web','browser','computer_use','file','memory','todo'],
    owns: ['candidate discovery', 'deduplication', 'source evidence', 'qualification readiness'],
    does_not: ['send outreach', 'invent contacts', 'claim unverified supply'],
  },
  {
    role: 'market_intelligence_lead', profile: 'intelligence', title: 'Market Intelligence Lead',
    expertise: ['hospitality market research', 'competitive intelligence', 'opportunity analysis', 'source-backed hypotheses'],
    toolsets: ['web','browser','file','memory','todo'],
    owns: ['market maps', 'competitor evidence', 'sector signals', 'research briefs'],
    does_not: ['contact prospects', 'invent market evidence', 'treat hypotheses as verified facts'],
  },
  {
    role: 'data_steward', profile: 'data', title: 'Data Steward',
    expertise: ['entity normalization', 'source provenance', 'deduplication', 'data-quality controls'],
    toolsets: ['file','code_execution','memory','todo','clarify'],
    owns: ['canonical registries', 'source freshness', 'schema quality', 'data-quality evidence'],
    does_not: ['fabricate contacts', 'overwrite source truth without audit', 'label inferred data verified'],
  },
  {
    role: 'outreach_lead', profile: 'outreach', title: 'Outreach Lead',
    expertise: ['email sequences', 'LinkedIn sequences', 'personalization', 'reply triage', 'suppression controls'],
    toolsets: ['web','browser','connections','file','memory','todo'],
    owns: ['sequence design', 'qualification questions', 'reply classification', 'follow-up planning'],
    does_not: ['mass-send without approval', 'guess recipient addresses', 'misrepresent identity'],
  },
  {
    role: 'crm_pipeline_operations', profile: 'crmops', title: 'CRM & Pipeline Operations',
    expertise: ['lead lifecycle', 'segmentation', 'consent management', 'suppression controls', 'pipeline hygiene'],
    toolsets: ['file','memory','kanban','todo','clarify'],
    owns: ['lead stages', 'consent records', 'outreach queues', 'pipeline data quality'],
    does_not: ['send messages', 'change consent without evidence', 'create external commitments'],
  },
  {
    role: 'campaign_director', profile: 'campaign', title: 'Campaign Director',
    expertise: ['positioning', 'campaign strategy', 'landing pages', 'ad copy', 'launch experiments', 'optimization'],
    toolsets: ['web','browser','file','image_gen','video_gen','tts','vision','memory','todo'],
    owns: ['campaign package', 'creative plan', 'channel plan', 'KPI design', 'optimization plan'],
    does_not: ['spend budget', 'publish externally', 'invent performance data'],
  },
  {
    role: 'implementation_lead', profile: 'builder', title: 'Implementation Lead',
    expertise: ['code changes', 'debugging', 'testing', 'migration safety', 'reviewable repository evidence'],
    toolsets: ['terminal','file','code_execution','browser','memory','todo'],
    owns: ['implementation', 'tests', 'diff evidence', 'technical blockers'],
    does_not: ['deploy production', 'self-certify release', 'expose secrets'],
  },
  {
    role: 'revenue_analyst', profile: 'analyst', title: 'Revenue Analyst',
    expertise: ['revenue reporting', 'funnel analysis', 'unit economics', 'anomaly diagnosis', 'data quality'],
    toolsets: ['code_execution','file','web','browser','memory','todo','vision'],
    owns: ['metric extraction', 'calculation', 'diagnosis', 'prioritized fixes', 'measurement plan'],
    does_not: ['fabricate metrics', 'call correlation causation', 'hide missing sources'],
  },
  {
    role: 'business_intelligence_engineer', profile: 'bi', title: 'Business Intelligence Engineer',
    expertise: ['metric modeling', 'KPI pipelines', 'dashboards', 'forecasting', 'anomaly detection'],
    toolsets: ['code_execution','file','memory','todo','vision'],
    owns: ['semantic metrics', 'reporting pipelines', 'dashboard evidence', 'forecast quality'],
    does_not: ['fabricate figures', 'confuse correlation with causation', 'access banking or payments'],
  },
  {
    role: 'fintech_risk_controller', profile: 'finance', title: 'Fintech Risk Controller',
    expertise: ['fixed-price economics', 'credit analysis', 'factoring risk', 'authority-matrix controls'],
    toolsets: ['code_execution','file','memory','todo','clarify'],
    owns: ['risk evidence', 'credit scenarios', 'fee logic review', 'authority-matrix checks'],
    does_not: ['move money', 'approve financing', 'access financial accounts'],
  },
  {
    role: 'integration_compliance_lead', profile: 'compliance', title: 'Integration & Compliance Lead',
    expertise: ['ETA integration', 'ERP adapters', 'API contracts', 'audit trails', 'compliance controls'],
    toolsets: ['code_execution','file','memory','todo','clarify'],
    owns: ['integration specifications', 'compliance evidence', 'failure handling', 'audit requirements'],
    does_not: ['sign or submit externally', 'change credentials', 'certify compliance without proof'],
  },
  {
    role: 'product_experience_lead', profile: 'product', title: 'Product Experience Lead',
    expertise: ['workflow design', 'UX acceptance criteria', 'accessibility', 'product-quality evidence'],
    toolsets: ['file','vision','memory','todo','clarify'],
    owns: ['journey maps', 'acceptance criteria', 'accessibility review', 'design handoffs'],
    does_not: ['change production code', 'claim visual approval', 'deploy without owner approval'],
  },
  {
    role: 'quality_sentinel', profile: 'sentinel', title: 'Quality Sentinel',
    expertise: ['acceptance verification', 'adversarial review', 'evidence audit', 'security review', 'completeness checks'],
    toolsets: ['web','browser','file','code_execution','terminal','memory','todo'],
    owns: ['independent review', 'acceptance gate', 'failure evidence', 'release recommendation'],
    does_not: ['perform the original work', 'accept self-reported proof', 'certify without evidence'],
  },
  {
    role: 'deployment_operator', profile: 'release', title: 'Deployment Operator',
    expertise: ['release preflight', 'deployment dispatch', 'health verification', 'rollback', 'release identity'],
    toolsets: ['terminal','file','code_execution','browser','memory','todo'],
    owns: ['approved deployment', 'health proof', 'rollback execution', 'release report'],
    does_not: ['deploy without approval', 'ignore source mismatch', 'leave an unrecoverable release'],
  },
  {
    role: 'recovery_operator', profile: 'recovery', title: 'Recovery Operator',
    expertise: ['uptime monitoring', 'incident isolation', 'service recovery', 'backup verification', 'alert delivery'],
    toolsets: ['web','browser','terminal','code_execution','computer_use','memory','todo','cronjob'],
    owns: ['outage diagnosis', 'bounded recovery', 'independent recovery proof', 'incident timeline'],
    does_not: ['run destructive recovery without approval', 'guess root cause', 'stop at one failed probe'],
  },
]);

const BY_ROLE = new Map(HERMES_TEAM.map((member) => [member.role, member]));
const BY_PROFILE = new Map(HERMES_TEAM.map((member) => [member.profile, member]));

export function teamMember(roleOrProfile) {
  const key = String(roleOrProfile || '').trim().toLowerCase();
  return BY_ROLE.get(key) || BY_PROFILE.get(key) || null;
}

export function routeHermesTask({ title = '', instruction = '', requestedRole = null } = {}) {
  if (requestedRole) {
    const explicit = teamMember(requestedRole);
    if (!explicit) throw Object.assign(new Error(`Unknown Hermes team role: ${requestedRole}`), { statusCode: 400 });
    return explicit;
  }
  const text = `${title}\n${instruction}`.toLowerCase();
  const rules = [
    ['recovery_operator', /outage|offline|incident|downtime|unreachable|restore service|uptime|health failure|backup recovery/],
    ['deployment_operator', /deploy|release to production|rollback|production release|promote release/],
    ['integration_compliance_lead', /eta|e-invoic|erp|integration|webhook|api contract|compliance|audit trail/],
    ['fintech_risk_controller', /factoring|credit risk|payment guarantee|authority matrix|fee calculation|financial risk/],
    ['business_intelligence_engineer', /business intelligence|bi dashboard|metric pipeline|semantic metric|forecast|anomaly detection/],
    ['data_steward', /deduplicat|normaliz|provenance|data quality|master registry|canonical data/],
    ['crm_pipeline_operations', /crm|pipeline|lead stage|segmentation|consent|suppression/],
    ['product_experience_lead', /ux|user journey|accessibility|product experience|design acceptance/],
    ['market_intelligence_lead', /competitor|market intelligence|market research|market map|sector analysis/],
    ['quality_sentinel', /independently verify|independent review|audit|review|quality gate|security review|acceptance criterion|adversarial|self-review|evidence validation/],
    ['revenue_analyst', /revenue|profit|performance|kpi|analytics|metric|diagnose|conversion|churn|roas|cac/],
    ['implementation_lead', /implement|code|debug|fix|test suite|repository|pull request|refactor|migration/],
    ['campaign_director', /campaign|marketing|landing page|ad copy|positioning|launch plan|creative|promotion/],
    ['outreach_lead', /email|outreach|linkedin|follow-up|follow up|reply|sequence|prospect/],
    ['lead_scout', /find|discover|search|supplier|hotel|contact|lead|market research|source/],
    ['chief_of_staff', /plan|orchestrate|assign|coordinate|delegate|business outcome/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ? BY_ROLE.get(rules.find(([, pattern]) => pattern.test(text))[0]) : BY_ROLE.get('chief_of_staff');
}

export function hermesTeamState() {
  return HERMES_TEAM.map((member) => ({ ...member, project_scope: ['STUDIO','HV'] }));
}
