BEGIN;

INSERT INTO hermes_team_roster(role,profile,title,expertise,toolsets,owns,does_not,status,last_verified_at)
VALUES
('market_intelligence_lead','intelligence','Market Intelligence Lead','["hospitality market research","competitive intelligence","opportunity analysis","source-backed hypotheses"]','["web","browser","file","memory","todo"]','["market maps","competitor evidence","sector signals","research briefs"]','["contact prospects","invent market evidence","treat hypotheses as verified facts"]','ready',now()),
('data_steward','data','Data Steward','["entity normalization","source provenance","deduplication","data-quality controls"]','["file","code_execution","memory","todo"]','["canonical registries","source freshness","schema quality","data-quality evidence"]','["fabricate contacts","overwrite source truth without audit","label inferred data verified"]','ready',now()),
('crm_pipeline_operations','crmops','CRM & Pipeline Operations','["lead lifecycle","segmentation","consent management","suppression controls","pipeline hygiene"]','["file","memory","kanban","todo"]','["lead stages","consent records","outreach queues","pipeline data quality"]','["send messages","change consent without evidence","create external commitments"]','ready',now()),
('business_intelligence_engineer','bi','Business Intelligence Engineer','["metric modeling","KPI pipelines","dashboards","forecasting","anomaly detection"]','["code_execution","file","memory","todo","vision"]','["semantic metrics","reporting pipelines","dashboard evidence","forecast quality"]','["fabricate figures","confuse correlation with causation","access banking or payments"]','ready',now()),
('fintech_risk_controller','finance','Fintech Risk Controller','["fixed-price economics","credit analysis","factoring risk","authority-matrix controls"]','["code_execution","file","memory","todo"]','["risk evidence","credit scenarios","fee logic review","authority-matrix checks"]','["move money","approve financing","access financial accounts"]','ready',now()),
('integration_compliance_lead','compliance','Integration & Compliance Lead','["ETA integration","ERP adapters","API contracts","audit trails","compliance controls"]','["code_execution","file","memory","todo"]','["integration specifications","compliance evidence","failure handling","audit requirements"]','["sign or submit externally","change credentials","certify compliance without proof"]','ready',now()),
('product_experience_lead','product','Product Experience Lead','["workflow design","UX acceptance criteria","accessibility","product-quality evidence"]','["file","vision","memory","todo"]','["journey maps","acceptance criteria","accessibility review","design handoffs"]','["change production code","claim visual approval","deploy without owner approval"]','ready',now())
ON CONFLICT(role) DO UPDATE SET
  profile=EXCLUDED.profile,title=EXCLUDED.title,expertise=EXCLUDED.expertise,toolsets=EXCLUDED.toolsets,
  owns=EXCLUDED.owns,does_not=EXCLUDED.does_not,status=EXCLUDED.status,last_verified_at=EXCLUDED.last_verified_at,updated_at=now();

COMMIT;
