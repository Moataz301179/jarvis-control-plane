BEGIN;

INSERT INTO jarvis_capability_sources
  (id,repository,source_url,source_kind,license,upstream_commit,skill_count,status,integration_notes,updated_at)
VALUES
  ('google-elephant-goldfish-model','google/elephant-goldfish-model','https://github.com/google/elephant-goldfish-model','agent_skill_plugin','Apache-2.0','964a4f1ecd333961375c35cb37ed09364dab5e4e',7,'installed','EGM 0.1.1 is installed and enabled for Claude Code. JARVIS routes substantial design, architecture and review work through explicit EGM slash-command workflows while keeping implementation and independent verification in Claude Code.',now())
ON CONFLICT (id) DO UPDATE SET
  repository=EXCLUDED.repository,
  source_url=EXCLUDED.source_url,
  source_kind=EXCLUDED.source_kind,
  license=EXCLUDED.license,
  upstream_commit=EXCLUDED.upstream_commit,
  skill_count=EXCLUDED.skill_count,
  status=EXCLUDED.status,
  integration_notes=EXCLUDED.integration_notes,
  updated_at=now();

INSERT INTO jarvis_skill_catalog
  (id,skill_name,description,repository,source_path,source_commit,source_blob_sha,category,license,status,dependency_notes,updated_at)
VALUES
  ('google/elephant-goldfish-model::skills/egm-bootstrap/SKILL.md','egm-bootstrap','Build a context tree for design and implementation work.','google/elephant-goldfish-model','skills/egm-bootstrap/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','e09ab29c45907a6cc3993a8cdf49f5672478f661f07241531ae907e39617a84f','design/bootstrap','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-bootstrap',now()),
  ('google/elephant-goldfish-model::skills/egm-brainstorm/SKILL.md','egm-brainstorm','Develop alternatives with context and explicit tradeoffs.','google/elephant-goldfish-model','skills/egm-brainstorm/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','a660b44e3cfdd23da8e8ecff2ff1aa01accb96ad2a823b67c90f89fc188ec7e8','design/brainstorm','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-brainstorm',now()),
  ('google/elephant-goldfish-model::skills/egm-draft/SKILL.md','egm-draft','Create a structured design draft with assumptions and open questions.','google/elephant-goldfish-model','skills/egm-draft/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','2c107ecd3751635df1eedef261c7e14a79e7bb9429d20753c3f0df5834e1dbec','design/draft','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-draft',now()),
  ('google/elephant-goldfish-model::skills/egm-review/SKILL.md','egm-review','Review a design or implementation artifact with fresh-eyes specialist agents.','google/elephant-goldfish-model','skills/egm-review/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','a17ee3b983bcd77000099bedf014db84a7a6e6f3245c712acd84a4f119b6b58c','design/review','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-review',now()),
  ('google/elephant-goldfish-model::skills/egm-resolve/SKILL.md','egm-resolve','Resolve review findings and close implementation gaps.','google/elephant-goldfish-model','skills/egm-resolve/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','fe12b8712f88b51780d817e6c8f0ac5e7a29961ee111d0fd19bfc2f738d2f531','design/resolve','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-resolve',now()),
  ('google/elephant-goldfish-model::skills/egm-review-loop/SKILL.md','egm-review-loop','Run review and remediation to convergence with evidence gates.','google/elephant-goldfish-model','skills/egm-review-loop/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','844b174055d32a7394f1096964a289987272109fff531a080fc9c3c9acef26fa','design/review-loop','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-review-loop',now()),
  ('google/elephant-goldfish-model::skills/egm-drift-report/SKILL.md','egm-drift-report','Report drift between approved design intent and current implementation.','google/elephant-goldfish-model','skills/egm-drift-report/SKILL.md','964a4f1ecd333961375c35cb37ed09364dab5e4e','c000ffe2e77a9fe74ee6915b314e1547337c95c79a19014c44fd976dc6511476','design/drift','Apache-2.0','installed','Claude Code plugin egm@egm 0.1.1; invoke /egm:egm-drift-report',now())
ON CONFLICT (id) DO UPDATE SET
  skill_name=EXCLUDED.skill_name,
  description=EXCLUDED.description,
  repository=EXCLUDED.repository,
  source_path=EXCLUDED.source_path,
  source_commit=EXCLUDED.source_commit,
  source_blob_sha=EXCLUDED.source_blob_sha,
  category=EXCLUDED.category,
  license=EXCLUDED.license,
  status=EXCLUDED.status,
  dependency_notes=EXCLUDED.dependency_notes,
  updated_at=now();

COMMIT;
