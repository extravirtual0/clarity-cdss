"use strict";

window.CLARITY_REGISTRY = Object.freeze({
  version: "3.2.0",
  modules: [
    { id: "acute", label: "Acute / Emergency", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["ACEP Clinical Policies", "https://www.acep.org/patient-care/clinical-policies"], fields: [], redFlags: [] },
    { id: "primary-care", label: "Primary Care / General Medicine", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["American College of Physicians Clinical Guidelines", "https://www.acponline.org/clinical-information/clinical-guidelines-recommendations"], fields: [
      ["duration", "Complaint duration / chronicity", "text"], ["prior-episodes", "Prior similar episodes", "textarea"],
      ["chronic-control", "Chronic disease control status", "textarea"], ["preventive-due", "Preventive care due dates", "textarea"]
    ], redFlags: ["Outpatient red-flag symptoms (clinician entered)"] },
    { id: "pediatrics", label: "Pediatrics", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["AAP Clinical Practice Guidelines", "https://www.aap.org/en/quality-improvement/clinical-practice-guidelines/"], fields: [
      ["age-months", "Age (months, under 2 years)", "number", 0, 23], ["birth-history", "Birth / neonatal history", "textarea"],
      ["immunizations", "Immunization status", "textarea"], ["feeding-growth", "Feeding / growth concerns", "textarea"],
      ["pediatric-weight", "Weight (required for pediatric module)", "number", 0.1, 200]
    ], redFlags: ["Bulging fontanelle", "Reduced wet nappies", "Grunting / nasal flaring", "Non-blanching rash"] },
    { id: "obgyn", label: "Obstetrics & Gynaecology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["ACOG Clinical Guidance", "https://www.acog.org/clinical"], fields: [
      ["gestation-weeks", "Gestational age (weeks)", "number", 0, 45], ["trimester", "Trimester", "select", ["Not recorded", "First", "Second", "Third", "Postpartum"]],
      ["gravida", "Gravida", "number", 0, 30], ["para", "Para", "number", 0, 30], ["pregnancy-complications", "Complications this pregnancy", "textarea"]
    ], redFlags: ["Severe headache with visual changes", "Epigastric pain in pregnancy", "Reduced fetal movement", "Antepartum bleeding", "Reduced urine output in pregnancy"] },
    { id: "psychiatry", label: "Psychiatry / Behavioral Health", status: "DOCUMENTATION ONLY · CLINICAL REVIEW REQUIRED", source: ["APA Clinical Practice Guidelines", "https://www.psychiatry.org/psychiatrists/practice/clinical-practice-guidelines"], fields: [
      ["mental-state", "Mental state examination", "textarea"], ["psychiatric-medications", "Current psychiatric medications", "textarea"],
      ["psychiatric-history", "Prior psychiatric history", "textarea"], ["risk-self", "Risk to self (clinician assessment)", "select", ["Not assessed", "Not identified", "Present — clinician review required"]],
      ["risk-others", "Risk to others (clinician assessment)", "select", ["Not assessed", "Not identified", "Present — clinician review required"]],
      ["capacity-insight", "Capacity / insight (clinician assessment)", "textarea"], ["safety-support", "Safety / support at home", "textarea"]
    ], redFlags: ["Mental health safety concern requiring direct clinician assessment"] },
    { id: "surgery", label: "Surgery / Pre-operative", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["NICE Preoperative Tests Guideline (NG45)", "https://www.nice.org.uk/guidance/ng45"], fields: [
      ["planned-procedure", "Planned procedure", "text"], ["anesthesia-type", "Anaesthesia under consideration", "text"],
      ["fasting-status", "Fasting status", "select", ["Not recorded", "Fasting", "Not fasting", "Unknown"]],
      ["anesthesia-history", "Prior surgical / anaesthetic complications", "textarea"]
    ], redFlags: ["Pre-operative safety concern (clinician entered)"] },
    { id: "musculoskeletal", label: "Musculoskeletal / Orthopaedics", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["AAOS Clinical Practice Guidelines", "https://www.aaos.org/quality/quality-programs/clinical-practice-guidelines/"], fields: [
      ["injury-mechanism", "Mechanism of injury", "textarea"], ["affected-site", "Affected site / laterality", "text"],
      ["weight-bearing", "Weight-bearing status", "select", ["Not recorded", "Full", "Limited", "Unable", "Not applicable"]],
      ["neurovascular", "Distal neurovascular status", "textarea"], ["prior-injury", "Prior injury at same site", "textarea"]
    ], redFlags: ["Acute neurovascular concern", "Open injury / exposed bone", "Compartment-syndrome concern"] },
    { id: "cardiology", label: "Cardiology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["ESC Clinical Practice Guidelines", "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines"], fields: [
      ["cardiac-risks", "Cardiac risk factors", "textarea"], ["cardiac-history", "Prior cardiac history / interventions", "textarea"],
      ["cardiac-medications", "Current cardiac medications", "textarea"], ["exertional-pattern", "Exertional symptom pattern", "textarea"],
      ["syncope-characterization", "Syncope characterisation", "textarea"]
    ], redFlags: ["Exertional syncope", "Chest pain radiating to jaw / arm", "Tearing chest / back pain"] },
    { id: "respiratory", label: "Respiratory / Pulmonology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["British Thoracic Society Guidelines", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/"], fields: [
      ["smoking", "Smoking history", "text"], ["pack-years", "Smoking exposure (pack-years)", "number", 0, 300],
      ["respiratory-diagnoses", "Prior respiratory diagnoses", "textarea"], ["exacerbations", "Exacerbation frequency", "text"],
      ["home-oxygen", "Home oxygen use", "select", ["Not recorded", "No", "Yes"]],
      ["peak-flow", "Peak flow / spirometry (if available)", "text"]
    ], redFlags: ["Haemoptysis", "Severe airway / breathing concern"] },
    { id: "neurology", label: "Neurology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["AAN Clinical Practice Guidelines", "https://www.aan.com/practice/guidelines"], fields: [
      ["onset-pattern", "Onset pattern", "select", ["Not recorded", "Sudden", "Gradual", "Unclear"]],
      ["neurologic-deficits", "Focal neurological deficit findings", "textarea"], ["seizure-details", "Seizure characterisation", "textarea"],
      ["headache-details", "Headache characterisation", "textarea"], ["neurology-history", "Prior neurological history", "textarea"]
    ], redFlags: ["Thunderclap headache", "Focal neurological deficit", "Neck stiffness / photophobia", "New confusion"] },
    { id: "gastroenterology", label: "Gastroenterology / Hepatology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["ACG Gastroenterology Guidelines", "https://gi.org/guidelines/"], fields: [
      ["bowel-change", "Bowel habit changes", "textarea"], ["gi-bleeding", "GI bleeding characterisation", "select", ["Not recorded", "None reported", "Melaena", "Haematemesis", "Haematochezia", "Other"]],
      ["liver-history", "Liver disease history", "textarea"], ["alcohol", "Alcohol history (if relevant)", "textarea"],
      ["gi-procedures", "Prior GI procedures", "textarea"]
    ], redFlags: ["PR bleeding / melaena", "Severe abdominal pain / peritonism concern"] },
    { id: "nephrology", label: "Nephrology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["KDIGO Kidney Disease Guidelines", "https://kdigo.org/guidelines/"], fields: [
      ["renal-baseline", "Baseline renal function", "text"], ["dialysis", "Dialysis status", "select", ["Not recorded", "No", "Haemodialysis", "Peritoneal dialysis"]],
      ["urine-output", "Urine output (include timeframe / units)", "text"], ["fluid-balance", "Fluid balance", "textarea"],
      ["renal-history", "Prior renal history", "textarea"]
    ], redFlags: ["New oliguria / anuria (clinician assessed)"] },
    { id: "endocrinology", label: "Endocrinology / Diabetes", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["Endocrine Society Clinical Practice Guidelines", "https://www.endocrine.org/clinical-practice-guidelines"], fields: [
      ["diabetes-type", "Diabetes type", "select", ["Not recorded", "No known diabetes", "Type 1", "Type 2", "Other"]],
      ["diabetes-control", "Diabetes control status", "textarea"], ["thyroid-history", "Thyroid history", "textarea"],
      ["steroid-history", "Glucocorticoid / steroid history", "textarea"], ["endocrine-diagnoses", "Other endocrine diagnoses", "textarea"]
    ], redFlags: ["Severe hypoglycaemia / hyperglycaemia concern (clinician assessed)"] },
    { id: "hematology", label: "Hematology / Oncology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["ASH Clinical Practice Guidelines", "https://www.hematology.org/resources/clinical-practice-guidelines"], fields: [
      ["cancer-treatment", "Malignancy / current treatment", "textarea"], ["anticoagulants", "Anticoagulant / antiplatelet use", "textarea"],
      ["bleeding-history", "Bleeding / clotting history", "textarea"], ["transfusion-history", "Transfusion history", "textarea"],
      ["neutropenia-risk", "Neutropenia risk (clinician assessed)", "select", ["Not assessed", "Not identified", "Present / possible"]]
    ], redFlags: ["Neutropenic sepsis concern (clinician assessed)", "Significant active bleeding"] },
    { id: "infectious-disease", label: "Infectious Disease", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["IDSA Practice Guidelines", "https://www.idsociety.org/practice-guideline/practice-guidelines/"], fields: [
      ["travel", "Travel history", "textarea"], ["exposure", "Exposure history", "textarea"],
      ["immune-status", "Immunization / immune status", "textarea"], ["infectious-contacts", "Known infectious contacts", "textarea"],
      ["antimicrobials", "Current / recent antimicrobial use", "textarea"]
    ], redFlags: ["Possible meningitis / encephalitis concern", "Non-blanching rash"] },
    { id: "rheumatology", label: "Rheumatology / Immunology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["American College of Rheumatology Guidelines", "https://rheumatology.org/clinical-practice-guidelines"], fields: [
      ["joint-pattern", "Joint involvement pattern", "textarea"], ["autoimmune", "Known autoimmune diagnoses", "textarea"],
      ["immunosuppressants", "Current immunosuppressant use", "textarea"], ["systemic-symptoms", "Systemic symptoms", "textarea"]
    ], redFlags: ["Acute systemic inflammatory concern (clinician assessed)"] },
    { id: "dermatology", label: "Dermatology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["American Academy of Dermatology Guidelines", "https://www.aad.org/member/clinical-quality/guidelines"], fields: [
      ["rash-distribution", "Rash / lesion distribution", "text"], ["rash-morphology", "Morphology / appearance", "textarea"],
      ["rash-duration", "Duration", "text"], ["rash-evolution", "Evolution", "textarea"],
      ["skin-photo", "Attach a clinical image (optional; local only)", "file"], ["skin-history", "Prior skin conditions", "textarea"]
    ], redFlags: ["Non-blanching rash"] },
    { id: "ent", label: "ENT", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["AAO-HNS Clinical Practice Guidelines", "https://www.entnet.org/quality-practice/quality-products/clinical-practice-guidelines/"], fields: [
      ["hearing", "Hearing changes", "textarea"], ["vertigo-tinnitus", "Vertigo / tinnitus", "textarea"],
      ["airway-concern", "Airway concern", "select", ["Not assessed", "Not identified", "Present — clinician review required"]],
      ["throat-voice", "Throat / voice change", "textarea"]
    ], redFlags: ["New airway concern", "Acute voice change with breathing difficulty"] },
    { id: "ophthalmology", label: "Ophthalmology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["American Academy of Ophthalmology Guidelines", "https://www.aao.org/education/guidelines-browse"], fields: [
      ["visual-acuity", "Visual acuity (record units / eye)", "text"], ["eye-symptoms", "Eye pain / redness / discharge", "textarea"],
      ["vision-loss", "Vision-loss pattern", "select", ["Not recorded", "Sudden", "Gradual", "Field change", "Central", "Other"]]
    ], redFlags: ["Sudden vision loss (clinician assessed)"] },
    { id: "urology", label: "Urology", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["European Association of Urology Guidelines", "https://uroweb.org/guidelines"], fields: [
      ["urinary-symptoms", "Urinary symptoms", "textarea"], ["flank-pain", "Flank pain", "textarea"],
      ["urology-history", "Prior urological history / procedures", "textarea"]
    ], redFlags: ["Testicular pain", "Urinary retention"] },
    { id: "toxicology", label: "Toxicology / Poisoning", status: "DOCUMENTATION ONLY · CLINICAL REVIEW REQUIRED", source: ["American College of Medical Toxicology Resources", "https://www.acmt.net/resources/"], fields: [
      ["toxic-agent", "Substance / agent", "text"], ["exposure-time", "Time since exposure", "text"],
      ["exposure-route", "Route", "select", ["Not recorded", "Ingestion", "Inhalation", "Dermal", "Injection", "Other"]],
      ["exposure-quantity", "Quantity (if known; include units)", "text"], ["coingestants", "Co-ingestants", "textarea"],
      ["exposure-intent", "Intentionality (clinician assessed)", "select", ["Not assessed", "Unintentional / unclear", "Intentional self-harm concern — immediate clinician review"]]
    ], redFlags: ["Potential toxic exposure requiring immediate clinician assessment"] },
    { id: "critical-care", label: "Critical Care / ICU", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["SCCM Clinical Practice Guidelines", "https://www.sccm.org/clinical-resources/guidelines/guidelines"], fields: [
      ["organ-support", "Current organ support", "textarea"], ["sedation", "Sedation status", "text"],
      ["lines-devices", "Lines / devices", "textarea"], ["vitals-trend", "Serial vital-sign trend (time + units)", "textarea"]
    ], redFlags: ["Deteriorating trend (clinician assessed)"] },
    { id: "geriatrics", label: "Geriatrics", status: "DOCUMENTATION ONLY · REVIEW REQUIRED", source: ["AGS Geriatrics At Your Fingertips", "https://geriatricscareonline.org/"], fields: [
      ["frailty", "Frailty / functional status", "textarea"], ["falls", "Falls history", "textarea"],
      ["cognition-baseline", "Baseline cognitive status", "textarea"], ["function-baseline", "Baseline functional status", "textarea"]
    ], redFlags: ["Acute change from cognitive baseline"] }
  ],
  taxonomy: [
    ["symptom.chest-pain", "Chest pain", "acute,cardiology"], ["symptom.breathlessness", "Shortness of breath", "acute,respiratory"],
    ["symptom.cough", "Cough", "acute,respiratory"], ["symptom.fever", "Fever", "acute,infectious-disease"],
    ["symptom.headache", "Headache", "acute,neurology"], ["symptom.abdominal-pain", "Abdominal pain", "acute,gastroenterology,obgyn"],
    ["symptom.syncope", "Syncope / fainting", "acute,cardiology,neurology"], ["symptom.dizziness", "Dizziness", "acute,neurology,ent"],
    ["symptom.weakness", "Weakness", "acute,neurology"], ["symptom.confusion", "New confusion", "acute,neurology,geriatrics"],
    ["symptom.rash", "Rash", "acute,dermatology,infectious-disease"], ["symptom.vomiting", "Vomiting", "acute,gastroenterology,pediatrics"],
    ["symptom.diarrhea", "Diarrhoea", "acute,gastroenterology,pediatrics"], ["symptom.bleeding", "Bleeding", "acute,hematology"],
    ["finding.focal-deficit", "Focal neurological deficit", "acute,neurology"], ["finding.nonblanching-rash", "Non-blanching rash", "acute,dermatology,infectious-disease"],
    ["finding.hypoxia", "Low oxygen saturation recorded", "acute,respiratory"], ["finding.hypotension", "Low blood pressure recorded", "acute,cardiology"],
    ["finding.pregnancy", "Pregnancy / possible pregnancy", "obgyn"], ["finding.trauma", "Recent trauma / injury", "acute,musculoskeletal"]
  ].map(([id, label, modules]) => ({ id, label, modules: modules.split(",") })),
  scoreRegistry: [
    { id: "news2", name: "NEWS2", type: "early warning / monitoring", inputs: "Respiratory rate, SpO₂, systolic blood pressure, heart rate, temperature, consciousness, supplemental oxygen; SpO₂ scale.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/" },
    { id: "qsofa", name: "qSOFA", type: "screening", inputs: "Respiratory rate, systolic blood pressure, altered mentation.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "https://www.sccm.org/survivingsepsiscampaign" },
    { id: "sirs", name: "SIRS", type: "screening", inputs: "Temperature, heart rate, respiratory rate or PaCO₂, WBC.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "" },
    { id: "gcs", name: "GCS", type: "assessment", inputs: "Eye, verbal and motor response.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "https://www.glasgowcomascale.org/" },
    { id: "curb65", name: "CURB-65", type: "severity", inputs: "Confusion, urea, respiratory rate, blood pressure, age.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "https://www.ncbi.nlm.nih.gov/books/NBK551585/" },
    { id: "shock-index", name: "Shock Index", type: "screening", inputs: "Heart rate, systolic blood pressure.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6466438/" },
    { id: "map", name: "Mean arterial pressure (MAP)", type: "monitoring", inputs: "Systolic and diastolic blood pressure.", status: "UNVALIDATED CALCULATION · NOT FOR CLINICAL USE", url: "" }
  ]
});
