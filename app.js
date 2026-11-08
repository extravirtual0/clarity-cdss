"use strict";

(() => {
  const form = document.getElementById("case-form");
  if (!form) return;

  const registry = window.CLARITY_REGISTRY;
  if (!registry) throw new Error("Clarity registry failed to load; refresh the page before using the workspace.");
  const byId = (id) => document.getElementById(id);
  const value = (id) => {
    const element = byId(id);
    if (!element || element.value === "") return null;
    if (element.type === "number" && !element.checkValidity()) return null;
    const number = Number(element.value);
    return Number.isFinite(number) ? number : null;
  };
  const numericInputIsInvalid = (id) => {
    const element = byId(id);
    return Boolean(element && element.type === "number" && element.value !== "" && !element.checkValidity());
  };
  const calculateBmi = () => {
    const weight = value("weight");
    const heightCm = value("height");
    const bmiValue = byId("bmi-value");
    const bmiNote = byId("bmi-note");
    const bmiReference = byId("bmi-reference");
    const showUnavailable = (note) => {
      bmiValue.textContent = "Not calculated";
      bmiNote.textContent = note;
      return null;
    };
    if (weight === null || heightCm === null) {
      const note = numericInputIsInvalid("weight") || numericInputIsInvalid("height")
        ? "Enter valid weight and height values within the stated ranges."
        : "Enter a valid weight and height to calculate.";
      return showUnavailable(note);
    }
    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);
    if (!Number.isFinite(bmi)) {
      return showUnavailable("BMI could not be calculated from these values.");
    }
    const rounded = bmi.toFixed(1);
    const displayedBmi = Number(rounded);
    const age = value("age");
    const pregnancy = byId("pregnancy").value;
    let interpretation;
    let note;
    if (age === null) {
      interpretation = "Adult category not assessed";
      note = numericInputIsInvalid("age")
        ? "Enter a valid age to determine whether adult or age-specific BMI interpretation applies."
        : "Enter age to determine whether adult or age-specific BMI interpretation applies.";
    } else if (age < 18) {
      interpretation = "Adult category not applicable";
      note = age < 5
        ? "For children under 5, use age- and sex-specific growth standards (including weight-for-height); this workspace does not calculate growth indicators."
        : "For people aged 5–17, interpretation requires age- and sex-specific BMI-for-age references; this workspace does not calculate percentiles.";
    } else if (pregnancy === "Yes" || pregnancy === "Possibly") {
      interpretation = "Pregnancy-adjusted interpretation not provided";
      note = "BMI categories shown for non-pregnant adults are not applied during pregnancy; discuss with a qualified clinician.";
    } else if (displayedBmi < 18.5) {
      interpretation = "Below the WHO adult reference range (BMI < 18.5)";
      note = "Screening category only—not a diagnosis. Consider clinical context, body composition, and measurement accuracy.";
    } else if (displayedBmi < 25) {
      interpretation = "Within the WHO adult reference range (BMI 18.5 to <25)";
      note = "Screening category only—not a diagnosis or assurance of health. BMI does not directly measure body fat; consider clinical context, body composition, weight trajectory, and population-specific risk thresholds.";
    } else if (displayedBmi < 30) {
      interpretation = "Meets the WHO adult definition of overweight (BMI 25 to <30)";
      note = "Screening category only—not an individual diagnosis. BMI does not directly measure body fat; consider clinical context, body composition, weight trajectory, and population-specific risk thresholds.";
    } else {
      interpretation = "Meets the WHO adult definition of obesity (BMI ≥ 30)";
      note = "Screening category only—not an individual diagnosis. BMI does not directly measure body fat; consider clinical context, body composition, weight trajectory, and population-specific risk thresholds.";
    }
    if (age !== null && age >= 18 && pregnancy !== "No" && pregnancy !== "Yes" && pregnancy !== "Possibly") {
      note = `Pregnancy status is not recorded; if pregnant, standard adult BMI categories do not apply. ${note}`;
    }
    bmiValue.textContent = `${rounded} kg/m²`;
    bmiNote.textContent = `${interpretation}. ${note}`;
    bmiReference.href = age !== null && age < 5
      ? "https://www.who.int/tools/child-growth-standards"
      : age !== null && age < 18
        ? "https://www.who.int/tools/growth-reference-data-for-5to19-years"
      : "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight";
    bmiReference.textContent = age !== null && age < 5
      ? "WHO child growth standards ↗"
      : age !== null && age < 18 ? "WHO BMI-for-age reference ↗" : "WHO BMI guidance ↗";
    const referenceLabel = bmiReference.textContent.replace(" ↗", "");
    return { value: rounded, interpretation, note, referenceLabel, referenceUrl: bmiReference.href };
  };
  const checkedValues = (name) => [...new Set([...form.querySelectorAll(`input[name="${name}"]:checked`)].map((item) => item.value))];
  const textValue = (name) => {
    const element = form.elements.namedItem(name);
    return element && typeof element.value === "string" ? element.value.trim() : "";
  };
  let diagnosticEngine = null;
  let diagnosticRequestPending = false;
  let diagnosticRequestController = null;
  let diagnosticResults = [];
  let diagnosticDemoResults = [];
  let auditEntries = [];
  let auditOrder = "newest";
  let auditPlaybackTimer = null;
  let auditPlaybackEntries = [];
  let auditPlaybackIndex = 0;
  let generated = false;
  let selectedModules = new Set(["acute"]);
  const confirmedFindings = new Set();
  const moduleValues = new Map();
  const confirmedModuleRedFlags = new Set();
  let toastTimer;

  const audit = (message) => {
    stopAuditPlayback(false);
    const timestamp = new Date();
    auditEntries.unshift({ timestamp: timestamp.toISOString(), event: message });
    auditOrder = "newest";
    byId("audit-order").textContent = "Newest first";
    byId("audit-order").setAttribute("aria-label", "Sort audit events newest first");
    renderAudit();
  };

  const updateDiagnosticButton = () => {
    const confirmed = byId("diagnostic-transmission-confirmation").checked;
    const aiModeSelected = form.querySelector('input[name="diagnosticMode"]:checked')?.value === "ai-demo";
    byId("request-diagnostic-drafts").disabled = !aiModeSelected || !diagnosticEngine || !confirmed || diagnosticRequestPending;
    byId("generate-diagnostic-demo").disabled = !aiModeSelected || !byId("diagnostic-demo-acknowledgment").checked;
  };

  const readDiagnosticJson = async (response) => {
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new Error(`The diagnostic service request failed (${response.status}).`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > 262144) {
      throw new Error("The diagnostic service response exceeded the size limit.");
    }
    if (!response.body) throw new Error("The diagnostic service returned an empty response.");
    const reader = response.body.getReader();
    const chunks = [];
    let totalLength = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      totalLength += chunk.byteLength;
      if (totalLength > 262144) {
        await reader.cancel().catch(() => {});
        throw new Error("The diagnostic service response exceeded the size limit.");
      }
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    });
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("The diagnostic service returned invalid JSON.");
    }
  };

  const refreshDiagnosticEngineStatus = async () => {
    const status = byId("diagnostic-engine-status");
    diagnosticEngine = null;
    updateDiagnosticButton();
    if (window.location.protocol !== "https:") {
      status.textContent = "Unavailable: diagnostic-engine connections require an HTTPS deployment with a secured same-origin backend.";
      return;
    }
    try {
      const response = await fetch("/api/diagnostic-engine/status", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        headers: { Accept: "application/json" },
        referrerPolicy: "no-referrer"
      });
      const result = await readDiagnosticJson(response);
      const ready = result && result.available === true
        && result.clinicianAuthenticated === true
        && result.clinicalApproval === true
        && result.engineKind === "ai"
        && typeof result.engineName === "string" && result.engineName.trim() && result.engineName.length <= 120
        && typeof result.engineVersion === "string" && result.engineVersion.trim() && result.engineVersion.length <= 80
        && typeof result.clinicalScope === "string" && result.clinicalScope.trim() && result.clinicalScope.length <= 500
        && typeof result.approvalReference === "string" && result.approvalReference.trim() && result.approvalReference.length <= 200
        && typeof result.csrfToken === "string" && result.csrfToken.trim() && result.csrfToken.length <= 2048;
      if (!ready) {
        status.textContent = "Unavailable: no authenticated, clinically approved diagnostic engine is configured for this session.";
        return;
      }
      diagnosticEngine = {
        engineKind: result.engineKind,
        engineName: result.engineName.trim(),
        engineVersion: result.engineVersion.trim(),
        clinicalScope: result.clinicalScope.trim(),
        approvalReference: result.approvalReference.trim(),
        csrfToken: result.csrfToken
      };
      status.textContent = `Connected AI service: ${diagnosticEngine.engineName} ${diagnosticEngine.engineVersion}. Approved scope: ${diagnosticEngine.clinicalScope}. All results remain unverified drafts requiring clinician review.`;
      updateDiagnosticButton();
    } catch {
      status.textContent = "Unavailable: no secured same-origin diagnostic service is connected. No case data has been sent.";
    }
  };

  const validDiagnosticResponse = (result) => {
    const isTextList = (items) => Array.isArray(items) && items.length <= 30
      && items.every((item) => typeof item === "string" && item.length <= 2000);
    const isSafeHttpsUrl = (value) => {
      if (typeof value !== "string" || value.length > 2000) return false;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    };
    if (!result || typeof result !== "object"
      || typeof result.engineName !== "string" || !result.engineName.trim() || result.engineName.length > 120
      || typeof result.engineVersion !== "string" || !result.engineVersion.trim() || result.engineVersion.length > 80
      || typeof result.clinicalScope !== "string" || !result.clinicalScope.trim() || result.clinicalScope.length > 500
      || typeof result.approvalReference !== "string" || !result.approvalReference.trim() || result.approvalReference.length > 200
      || !Array.isArray(result.diagnoses)
      || result.diagnoses.length > 7
      || !isTextList(result.limitations)
      || result.diagnoses.some((diagnosis) => !diagnosis
        || typeof diagnosis.label !== "string"
        || !diagnosis.label.trim() || diagnosis.label.length > 300
        || (diagnosis.icd10Code !== undefined && (typeof diagnosis.icd10Code !== "string" || diagnosis.icd10Code.length > 40))
        || (diagnosis.icd10Edition !== undefined && (typeof diagnosis.icd10Edition !== "string" || diagnosis.icd10Edition.length > 120))
        || (diagnosis.certaintyPercent !== undefined
          && (typeof diagnosis.certaintyPercent !== "number"
            || diagnosis.certaintyPercent < 0
            || diagnosis.certaintyPercent > 100
            || typeof diagnosis.certaintyCalibration !== "string"
            || !diagnosis.certaintyCalibration.trim()
            || diagnosis.certaintyCalibration.length > 1000))
        || !isTextList(diagnosis.evidenceFor)
        || !isTextList(diagnosis.evidenceAgainst)
        || (diagnosis.missingInformation !== undefined && !isTextList(diagnosis.missingInformation))
        || (diagnosis.engineLimitations !== undefined && !isTextList(diagnosis.engineLimitations))
        || !Array.isArray(diagnosis.guidelineReferences)
        || diagnosis.guidelineReferences.length > 10
        || (diagnosis.managementConsiderations !== undefined
          && (typeof diagnosis.managementConsiderations !== "string" || diagnosis.managementConsiderations.length > 4000))
        || diagnosis.guidelineReferences.some((reference) => !reference
          || typeof reference.title !== "string" || !reference.title.trim() || reference.title.length > 300
          || !isSafeHttpsUrl(reference.url)
          || (reference.version !== undefined && (typeof reference.version !== "string" || reference.version.length > 120))))) return false;
    return true;
  };

  const renderDiagnosticDrafts = () => {
    const container = byId("diagnostic-draft-list");
    container.replaceChildren();
    container.hidden = diagnosticResults.length === 0;
    diagnosticResults.forEach((diagnosis, index) => {
      const card = document.createElement("article");
      card.className = "diagnostic-draft";
      card.dataset.diagnosisIndex = String(index);
      const source = document.createElement("p");
      source.className = "diagnostic-review-status";
      source.textContent = `AI-generated draft from ${diagnosticEngine?.engineName || "connected service"} · not clinician-authored or confirmed`;
      const heading = document.createElement("h4");
      heading.textContent = diagnosis.label;
      card.append(source, heading);
      const addText = (label, text) => {
        if (typeof text !== "string" || !text.trim()) return;
        const paragraph = document.createElement("p");
        paragraph.textContent = `${label}: ${text}`;
        card.append(paragraph);
      };
      if (diagnosis.icd10Code) {
        addText("Engine-provided ICD-10 code (verify independently)", `${diagnosis.icd10Code}${diagnosis.icd10Edition ? ` · ${diagnosis.icd10Edition}` : ""}`);
      }
      if (diagnosis.certaintyPercent !== undefined) {
        addText("Engine-reported certainty (not independently verified)", `${diagnosis.certaintyPercent}% · ${diagnosis.certaintyCalibration}`);
      }
      addText("Evidence the engine considered supportive", diagnosis.evidenceFor.join("; "));
      addText("Evidence against / uncertainty", diagnosis.evidenceAgainst.join("; "));
      addText("Management considerations (draft; verify source and applicability)", diagnosis.managementConsiderations);
      diagnosis.guidelineReferences.forEach((reference) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = `Guideline reference: ${reference.title}${reference.version ? ` · ${reference.version}` : ""}`;
        const link = document.createElement("a");
        link.href = reference.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = " Open source ↗";
        paragraph.append(link);
        card.append(paragraph);
      });
      if (diagnosis.missingInformation?.length) addText("Information gaps", diagnosis.missingInformation.join("; "));
      const limitations = diagnosis.engineLimitations || [];
      if (limitations.length) addText("Engine limitations", limitations.join("; "));
      const review = document.createElement("div");
      review.className = "diagnostic-draft-review";
      const state = document.createElement("span");
      state.className = "diagnostic-review-status";
      state.textContent = diagnosis.reviewDecision || "Awaiting clinician review";
      const accept = document.createElement("button");
      accept.className = "button button-outline";
      accept.type = "button";
      accept.dataset.reviewDecision = "Accepted for clinician assessment";
      accept.textContent = "Accept for clinician assessment";
      const decline = document.createElement("button");
      decline.className = "button button-outline";
      decline.type = "button";
      decline.dataset.reviewDecision = "Declined by clinician";
      decline.textContent = "Decline";
      review.append(state, accept, decline);
      card.append(review);
      container.append(card);
    });
    if (diagnosticResults.length) {
      const warning = document.createElement("p");
      warning.className = "diagnostic-result-warning";
      warning.textContent = "AI-generated content is an unverified draft, not a diagnosis or treatment instruction. Acceptance records a review decision only; it does not confirm the condition or replace independent assessment.";
      container.prepend(warning);
    }
  };

  const renderDiagnosticDemo = () => {
    const container = byId("diagnostic-demo-results");
    container.replaceChildren();
    container.hidden = diagnosticDemoResults.length === 0;
    if (!diagnosticDemoResults.length) return;
    const warning = document.createElement("p");
    warning.className = "diagnostic-result-warning";
    warning.textContent = "FIXED SYNTHETIC EXAMPLE · NOT GENERATED BY AI · NOT BASED ON YOUR PATIENT. Seven unranked teaching examples—not a diagnosis, probability, or treatment instruction. The ICD-10 codes are approximate illustrative mappings, not verified or patient-specific; confirm them in the official WHO browser. Sources are topic references, not personalized recommendations. Do not use for patient care.";
    container.append(warning);
    diagnosticDemoResults.forEach((result, index) => {
      const card = document.createElement("article");
      card.className = "diagnostic-draft";
      card.dataset.demoIndex = String(index);
      const heading = document.createElement("h4");
      heading.textContent = `Example candidate ${index + 1} · ${result.label}`;
      card.append(heading);
      const renderReason = (label, text) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = `${label}: ${text}`;
        card.append(paragraph);
      };
      renderReason("Why this candidate is included", result.reasoningFor);
      renderReason("Why it is not established / counterevidence", result.reasoningAgainst);
      renderReason("Important information not supplied in the vignette", result.informationNeeded);
      const certainty = document.createElement("p");
      certainty.textContent = "Certainty percentage: not calculated. No calibrated model or patient assessment is used in this demo.";
      const code = document.createElement("p");
      code.textContent = `Approximate WHO ICD-10 example: ${result.icd10Code}. This is an illustrative mapping, not verified or patient-specific; check the correct classification and specificity in the official WHO browser.`;
      const codeLink = document.createElement("a");
      codeLink.href = "https://icd.who.int/browse10/2019/en";
      codeLink.target = "_blank";
      codeLink.rel = "noopener noreferrer";
      codeLink.textContent = " Open WHO ICD-10 browser ↗";
      code.append(codeLink);
      const management = document.createElement("p");
      management.textContent = `Management: no patient-specific plan or treatment advice is generated. Source relevance: ${result.sourceRationale} The linked source is for independent clinician review and is not applied to patient care.`;
      const guideline = document.createElement("p");
      guideline.textContent = `Illustrative guideline/source for this example: ${result.guidelineTitle}. This fixed link is not automatically applied to a real case.`;
      const guidelineLink = document.createElement("a");
      guidelineLink.href = result.guidelineUrl;
      guidelineLink.target = "_blank";
      guidelineLink.rel = "noopener noreferrer";
      guidelineLink.textContent = " Open source ↗";
      guideline.append(guidelineLink);
      card.append(certainty, code, management, guideline);
      const review = document.createElement("div");
      review.className = "diagnostic-draft-review";
      const state = document.createElement("span");
      state.className = "diagnostic-review-status";
      state.textContent = result.reviewDecision || "Demo review state only";
      const accept = document.createElement("button");
      accept.className = "button button-outline";
      accept.type = "button";
      accept.dataset.demoReviewDecision = "Marked reviewed in demo";
      accept.textContent = "Mark reviewed (demo only)";
      const decline = document.createElement("button");
      decline.className = "button button-outline";
      decline.type = "button";
      decline.dataset.demoReviewDecision = "Dismissed in demo";
      decline.textContent = "Dismiss example";
      review.append(state, accept, decline);
      card.append(review);
      container.append(card);
    });
  };

  const generateDiagnosticDemo = () => {
    if (form.querySelector('input[name="diagnosticMode"]:checked')?.value !== "ai-demo"
      || !byId("diagnostic-demo-acknowledgment").checked) return;
    diagnosticDemoResults = [
      {
        label: "Viral upper respiratory infection with pharyngitis",
        icd10Code: "J06.9",
        reasoningFor: "An acute sore throat together with cough is compatible with a respiratory viral illness; viruses commonly cause acute sore throat.",
        reasoningAgainst: "Neither symptom identifies a specific virus. No additional viral features are documented, and this vignette provides no examination or test result to establish an infectious cause.",
        informationNeeded: "Symptom timeline and associated respiratory symptoms; examination; relevant exposure and local epidemiology; testing if clinically indicated.",
        guidelineTitle: "NICE NG84 · Sore throat (acute): antimicrobial prescribing",
        guidelineUrl: "https://www.nice.org.uk/guidance/ng84/chapter/Recommendations",
        sourceRationale: "NICE describes acute sore throat as commonly triggered by viral upper-respiratory infection and gives assessment guidance."
      },
      {
        label: "Group A streptococcal pharyngitis",
        icd10Code: "J02.0",
        reasoningFor: "Sore throat is compatible with group A streptococcal pharyngitis, so it remains one possible cause that a real assessment may consider.",
        reasoningAgainst: "Cough argues against the classic group A strep pattern; CDC notes that cough is not typical. Fever, tender anterior cervical nodes, tonsillar swelling or exudate, age and contact history are unknown—not confirmed absent—and no test is supplied.",
        informationNeeded: "Examination and complete history to assess applicable clinical criteria; age and exposure context; throat testing when indicated under local guidance.",
        guidelineTitle: "CDC · Clinical guidance for group A streptococcal pharyngitis",
        guidelineUrl: "https://www.cdc.gov/group-a-strep/hcp/clinical-guidance/strep-throat.html",
        sourceRationale: "CDC describes typical features, notes cough as atypical for group A strep, and explains that microbiological testing confirms infection."
      },
      {
        label: "Influenza",
        icd10Code: "J11.1",
        reasoningFor: "Cough and sore throat can occur in an acute influenza respiratory illness.",
        reasoningAgainst: "The vignette does not document abrupt onset, fever, myalgia, headache or other systemic symptoms. There is no exposure, community-circulation context or test, so influenza cannot be distinguished from other respiratory causes.",
        informationNeeded: "Onset and full symptom pattern; relevant exposure and current local influenza activity; risk factors, severity and testing where clinically appropriate.",
        guidelineTitle: "CDC · Clinical guidance for influenza",
        guidelineUrl: "https://www.cdc.gov/flu/hcp/clinical-guidance/index.html",
        sourceRationale: "CDC provides clinician guidance on influenza assessment and management; this general link does not establish influenza in the vignette."
      },
      {
        label: "COVID-19",
        icd10Code: "U07.1",
        reasoningFor: "Cough and sore throat are compatible with COVID-19, which overlaps clinically with other respiratory infections.",
        reasoningAgainst: "These nonspecific symptoms do not distinguish COVID-19. The vignette has no exposure history, test, severity assessment or information about risk factors.",
        informationNeeded: "Full history and examination, exposure context, appropriate testing and assessment of risk for severe disease.",
        guidelineTitle: "CDC · Clinical care quick reference for COVID-19",
        guidelineUrl: "https://www.cdc.gov/covid/hcp/clinical-care/index.html",
        sourceRationale: "CDC links clinicians to COVID-19 evaluation and care guidance; this reference is not a diagnostic test or individualized recommendation."
      },
      {
        label: "Infectious mononucleosis",
        icd10Code: "B27.9",
        reasoningFor: "Infectious mononucleosis can cause sore throat and is a relevant alternative cause when the broader clinical pattern supports it.",
        reasoningAgainst: "The vignette provides no prolonged or marked fatigue, fever, lymph-node findings, age-specific context or test results. A brief sore-throat-and-cough description alone is not specific for this infection.",
        informationNeeded: "Duration and systemic symptoms; lymph-node and oropharyngeal examination; other relevant examination findings; confirmatory testing if clinically indicated.",
        guidelineTitle: "NHS · Glandular fever",
        guidelineUrl: "https://www.nhs.uk/conditions/glandular-fever/",
        sourceRationale: "The source describes common symptoms and when clinical assessment or testing may be needed."
      },
      {
        label: "Acute tonsillitis",
        icd10Code: "J03.9",
        reasoningFor: "Acute tonsillar inflammation can present within a sore-throat illness, so it is a possible clinical syndrome to assess.",
        reasoningAgainst: "No tonsil examination or swallowing symptoms are provided. Tonsillitis describes an anatomic inflammatory syndrome; it does not by itself establish whether the cause is viral or bacterial and overlaps with pharyngitis.",
        informationNeeded: "Direct oropharyngeal examination, swallowing symptoms and full history; cause requires clinical assessment and testing where appropriate.",
        guidelineTitle: "NICE NG84 · Sore throat (acute): antimicrobial prescribing",
        guidelineUrl: "https://www.nice.org.uk/guidance/ng84/chapter/Recommendations",
        sourceRationale: "NICE covers acute sore throat including pharyngitis and tonsillitis and emphasizes assessment before management decisions."
      },
      {
        label: "Acute laryngitis",
        icd10Code: "J04.0",
        reasoningFor: "Laryngitis can cause an irritating cough and sore throat as part of an acute upper-respiratory illness.",
        reasoningAgainst: "No hoarse, croaky or changed voice—the defining clue highlighted by the reference—is described. Voice symptoms are unknown rather than confirmed absent, so the vignette cannot establish laryngitis.",
        informationNeeded: "Voice change and symptom timeline; associated respiratory symptoms; assessment of severity and any concerning airway or swallowing symptoms.",
        guidelineTitle: "NHS · Laryngitis",
        guidelineUrl: "https://www.nhs.uk/conditions/laryngitis/",
        sourceRationale: "The source describes typical laryngitis symptoms and course; the vignette omits its characteristic voice-change history."
      }
    ];
    renderDiagnosticDemo();
    audit("Fixed synthetic diagnostic demo displayed; worksheet data not used");
  };

  const setDiagnosticMode = (mode) => {
    const isAiDemo = mode === "ai-demo";
    byId("diagnostic-ai-demo-mode").hidden = !isAiDemo;
    byId("diagnostic-documentation-mode").hidden = isAiDemo;
    byId("diagnostic-transmission-confirmation").checked = false;
    byId("diagnostic-demo-acknowledgment").checked = false;
    diagnosticResults = [];
    diagnosticDemoResults = [];
    renderDiagnosticDrafts();
    renderDiagnosticDemo();
    if (isAiDemo) {
      byId("diagnostic-engine-status").textContent = "Checking for an approved AI service; no case data is sent.";
      refreshDiagnosticEngineStatus();
    } else {
      if (diagnosticRequestController) {
        diagnosticRequestController.abort();
        byId("diagnostic-engine-status").textContent = "Documentation-only mode selected. Browser request aborted; the AI service may already have received the case.";
      }
      diagnosticEngine = null;
      byId("diagnostic-engine-status").textContent = "AI service not checked. Switch to AI/demo mode to check; no case data is sent.";
    }
    updateDiagnosticButton();
    audit(isAiDemo ? "AI/demo mode selected" : "Documentation-only mode selected");
  };

  const requestDiagnosticDrafts = async () => {
    if (form.querySelector('input[name="diagnosticMode"]:checked')?.value !== "ai-demo"
      || !diagnosticEngine
      || !byId("diagnostic-transmission-confirmation").checked
      || diagnosticRequestPending) return;
    if (!validateCase()) return;
    diagnosticRequestPending = true;
    diagnosticRequestController = new AbortController();
    updateDiagnosticButton();
    byId("diagnostic-engine-status").textContent = "Sending the de-identified case to the configured same-origin clinical service for draft review…";
    diagnosticResults = [];
    renderDiagnosticDrafts();
    try {
      const response = await fetch("/api/diagnostic-engine/differential", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: diagnosticRequestController.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": diagnosticEngine.csrfToken
        },
        body: JSON.stringify({
          schemaVersion: "1.0",
          clinicianReviewRequired: true,
          approvalReference: diagnosticEngine.approvalReference,
          engineKind: diagnosticEngine.engineKind,
          case: collectCaseForDiagnostic()
        })
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(`The diagnostic service request failed (${response.status}).`);
      }
      const result = await readDiagnosticJson(response);
      if (!validDiagnosticResponse(result)
        || result.engineKind !== diagnosticEngine.engineKind
        || result.engineName !== diagnosticEngine.engineName
        || result.engineVersion !== diagnosticEngine.engineVersion
        || result.approvalReference !== diagnosticEngine.approvalReference
        || result.clinicalScope !== diagnosticEngine.clinicalScope) {
        throw new Error("The diagnostic service returned an invalid response or scope mismatch.");
      }
      diagnosticResults = result.diagnoses.map((diagnosis) => ({
        label: diagnosis.label,
        icd10Code: diagnosis.icd10Code,
        icd10Edition: diagnosis.icd10Edition,
        certaintyPercent: diagnosis.certaintyPercent,
        certaintyCalibration: diagnosis.certaintyCalibration,
        evidenceFor: diagnosis.evidenceFor,
        evidenceAgainst: diagnosis.evidenceAgainst,
        missingInformation: diagnosis.missingInformation,
        managementConsiderations: diagnosis.managementConsiderations,
        engineLimitations: diagnosis.engineLimitations,
        guidelineReferences: diagnosis.guidelineReferences.map(({ title, version, url }) => ({ title, version, url }))
      }));
      renderDiagnosticDrafts();
      byId("diagnostic-engine-status").textContent = `Received ${diagnosticResults.length} draft candidate(s) from ${diagnosticEngine.engineName}. Clinician review is required. ${result.limitations.join(" ")}`.trim();
      audit(`Diagnostic service returned ${diagnosticResults.length} draft candidate(s); clinician review required`);
    } catch (error) {
      if (error?.name !== "AbortError") {
        byId("diagnostic-engine-status").textContent = `${error instanceof Error ? error.message : "Diagnostic service unavailable."} No diagnosis was added to clinician documentation.`;
        diagnosticResults = [];
        renderDiagnosticDrafts();
        audit("Diagnostic engine request failed; no draft added");
      }
    } finally {
      diagnosticRequestPending = false;
      diagnosticRequestController = null;
      updateDiagnosticButton();
    }
  };

  const renderAudit = () => {
    const list = byId("audit-list");
    byId("audit-count").textContent = String(auditEntries.length);
    if (!auditEntries.length) {
      list.innerHTML = '<div class="empty-state">Your session activity will appear here.</div>';
      return;
    }
    if (auditPlaybackTimer && !auditPlaybackIndex) {
      list.replaceChildren(Object.assign(document.createElement("div"), {
        className: "empty-state",
        textContent: "Starting chronological replay…"
      }));
      return;
    }
    const visibleEntries = auditPlaybackTimer
      ? auditPlaybackEntries.slice(0, auditPlaybackIndex)
      : auditEntries.slice(0, 30);
    if (!auditPlaybackTimer && auditOrder === "oldest") visibleEntries.reverse();
    list.replaceChildren(...visibleEntries.map((entry) => {
      const row = document.createElement("div");
      row.className = "audit-entry";
      const time = document.createElement("time");
      time.dateTime = entry.timestamp;
      time.textContent = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      const description = document.createElement("span");
      description.textContent = entry.event;
      row.append(time, description);
      return row;
    }));
  };

  const showToast = (message) => {
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  };

  const setScore = (id, result, detail = "") => {
    const target = byId(id);
    target.replaceChildren();
    target.append(document.createTextNode(result));
    if (detail) {
      const note = document.createElement("small");
      note.textContent = ` ${detail}`;
      target.append(note);
    }
  };

  const newsResp = (v) => v <= 8 ? 3 : v <= 11 ? 1 : v <= 20 ? 0 : v <= 24 ? 2 : 3;
  const newsSpo2 = (v, scale) => {
    if (scale === "2") return v <= 83 ? 3 : v <= 85 ? 2 : v <= 87 ? 1 : v <= 92 ? 0 : v <= 94 ? 1 : v <= 96 ? 2 : 3;
    return v <= 91 ? 3 : v <= 93 ? 2 : v <= 95 ? 1 : 0;
  };
  const newsSystolic = (v) => v <= 90 ? 3 : v <= 100 ? 2 : v <= 110 ? 1 : v <= 219 ? 0 : 3;
  const newsHeartRate = (v) => v <= 40 ? 3 : v <= 50 ? 1 : v <= 90 ? 0 : v <= 110 ? 1 : v <= 130 ? 2 : 3;
  const newsTemperature = (v) => v <= 35 ? 3 : v <= 36 ? 1 : v <= 38 ? 0 : v <= 39 ? 1 : 2;
  const setStep = (number) => {
    document.querySelectorAll("#workflow-steps li").forEach((item, index) => {
      item.classList.toggle("is-current", index === number - 1);
      item.classList.toggle("is-done", index < number - 1);
      item.classList.toggle("is-blocked", index > number - 1);
    });
  };

  const moduleFieldValue = (moduleId, fieldId) => moduleValues.get(`module_${moduleId}_${fieldId}`) || "";

  const moduleFieldStatistics = (module) => {
    const fields = module.fields;
    const completed = fields.filter(([fieldId]) => {
      const current = byId(`module-${module.id}-${fieldId}`);
      const raw = current ? (current.type === "file" ? current.files.length : current.value) : moduleFieldValue(module.id, fieldId);
      return String(raw || "").trim() !== "";
    }).length;
    const invalid = fields.filter(([fieldId]) => {
      const current = byId(`module-${module.id}-${fieldId}`);
      return current && current.type === "number" && current.value !== "" && !current.checkValidity();
    }).length;
    return { completed, total: fields.length, invalid };
  };

  const renderModuleProgress = () => {
    for (const module of registry.modules) {
      if (!selectedModules.has(module.id)) continue;
      const target = byId(`module-progress-${module.id}`);
      if (!target) continue;
      if (!module.fields.length) {
        target.textContent = "No additional structured fields in this registry entry. Shared assessment fields apply; no specialty rules are activated.";
        continue;
      }
      const { completed, total, invalid } = moduleFieldStatistics(module);
      target.textContent = `${completed}/${total} documentation fields populated${invalid ? ` · ${invalid} value(s) outside the stated input range` : ""}. This is not a clinical completeness assessment.`;
      target.classList.toggle("has-invalid", invalid > 0);
    }
    const pediatricSelected = selectedModules.has("pediatrics");
    const pregnancySelected = selectedModules.has("obgyn");
    const limit = byId("module-score-limitation");
    limit.hidden = !pediatricSelected && !pregnancySelected;
    limit.textContent = [
      pediatricSelected ? "Pediatric module selected: NEWS2, qSOFA, SIRS, and CURB-65 are suppressed because these calculations are not validated for pediatric use." : "",
      pregnancySelected ? "Obstetric module selected: displayed scores are not pregnancy-adjusted or validated for obstetric use." : ""
    ].filter(Boolean).join(" ");
  };

  const calculateScores = () => {
    const rr = value("respRate");
    const spo2 = value("spo2");
    const sbp = value("systolicBP");
    const dbp = value("diastolicBP");
    const hr = value("heartRate");
    const temp = value("tempC");
    const urea = value("urea");
    const wbc = value("wbc");
    const paco2 = value("paco2");
    const avpu = byId("avpu").value;
    const o2 = byId("supplementalO2").checked;
    const pediatricMode = selectedModules.has("pediatrics");
    byId("news-scale").hidden = true;
    const gcsParts = [value("gcsEye"), value("gcsVerbal"), value("gcsMotor")];
    const gcsComplete = gcsParts.every((part) => part !== null);
    const gcs = gcsComplete ? gcsParts.reduce((sum, part) => sum + part, 0) : null;
    const scale = byId("spo2Scale").value;

    const missing = [];
    const observationInputs = [
      ["respRate", "respiratory rate"],
      ["spo2", "SpO₂"],
      ["systolicBP", "systolic BP"],
      ["heartRate", "heart rate"],
      ["tempC", "temperature"]
    ];
    for (const [id, label] of observationInputs) {
      if (value(id) === null) missing.push(numericInputIsInvalid(id) ? `${label} (outside permitted range)` : label);
    }
    if (!avpu) missing.push("consciousness");

    const newsValues = [];
    if (rr !== null) newsValues.push(newsResp(rr));
    if (spo2 !== null) newsValues.push(newsSpo2(spo2, scale));
    if (sbp !== null) newsValues.push(newsSystolic(sbp));
    if (hr !== null) newsValues.push(newsHeartRate(hr));
    if (temp !== null) newsValues.push(newsTemperature(temp));
    if (avpu) newsValues.push(avpu === "A" ? 0 : 3);
    const news = newsValues.reduce((sum, item) => sum + item, 0) + (o2 ? 2 : 0);

    byId("score-o2").textContent = o2 ? "+2" : "+0";
    byId("news-value").textContent = pediatricMode ? "N/A" : missing.length ? (newsValues.length ? `${news}+` : "—") : String(news);
    byId("missing-note").textContent = pediatricMode
      ? "NEWS2 is suppressed; pediatric use is not validated."
      : missing.length ? `NEWS2 missing: ${missing.join(", ")}` : "Inputs entered; calculation remains unvalidated.";

    if (pediatricMode) {
      byId("news-level").textContent = "Suppressed";
      byId("news-guidance").textContent = "Pediatric use is not validated here. Do not use this calculation for patient care.";
      byId("news-summary").classList.remove("risk-medium", "risk-high");
    } else if (missing.length) {
      byId("news-level").textContent = "Incomplete · unvalidated";
      byId("news-guidance").textContent = "Incomplete calculation. Any displayed value is unvalidated and must not guide patient care.";
      byId("news-summary").classList.remove("risk-medium", "risk-high");
    } else {
      byId("news-level").textContent = "Complete · unvalidated";
      byId("news-guidance").textContent = "Calculation only. It is not clinically validated and must not be used to assess, triage, or manage a patient.";
      byId("news-summary").classList.remove("risk-medium", "risk-high");
    }

    const qsofa = [rr === null ? null : Number(rr >= 22), sbp === null ? null : Number(sbp <= 100), gcs === null && !avpu ? null : Number(gcs !== null ? gcs < 15 : avpu !== "A")];
    const qsofaKnown = qsofa.filter((item) => item !== null);
    setScore("score-qsofa", pediatricMode ? "N/A" : qsofaKnown.length === 3 ? String(qsofaKnown.reduce((sum, item) => sum + item, 0)) : "—", pediatricMode ? "not validated for pediatric use" : qsofaKnown.length === 3 ? "of 3" : "incomplete");

    const respiratorySirs = rr === null && paco2 === null
      ? null
      : Number((rr !== null && rr > 20) || (paco2 !== null && paco2 < 4.3));
    const sirsCriteria = [
      temp === null ? null : Number(temp > 38 || temp < 36),
      hr === null ? null : Number(hr > 90),
      respiratorySirs,
      wbc === null ? null : Number(wbc > 12 || wbc < 4)
    ];
    const knownSirs = sirsCriteria.filter((item) => item !== null);
    setScore("score-sirs", pediatricMode ? "N/A" : knownSirs.length === 4 ? String(knownSirs.reduce((sum, item) => sum + item, 0)) : "—", pediatricMode ? "not validated for pediatric use" : `${knownSirs.length}/4 inputs assessed`);

    setScore("score-gcs", gcsComplete ? `${gcs}/15` : "—", gcsComplete ? `E${gcsParts[0]} V${gcsParts[1]} M${gcsParts[2]}` : "E/V/M required");

    const confusionKnown = Boolean(avpu || gcs !== null);
    const confusion = gcs !== null ? gcs < 15 : avpu ? avpu !== "A" : false;
    const curbCriteria = [value("age") === null ? null : Number(value("age") >= 65), urea === null ? null : Number(urea > 7), rr === null ? null : Number(rr >= 30), sbp === null || dbp === null ? null : Number(sbp < 90 || dbp <= 60), confusionKnown ? Number(confusion) : null];
    const curbComplete = curbCriteria.every((item) => item !== null);
    setScore("score-curb", pediatricMode ? "N/A" : curbComplete ? String(curbCriteria.reduce((sum, item) => sum + item, 0)) : "—", pediatricMode ? "not validated for pediatric use" : curbComplete ? "of 5 · confirm indication" : `${curbCriteria.filter((item) => item !== null).length}/5 inputs assessed`);

    if (hr !== null && sbp !== null && sbp > 0) setScore("score-shock", (hr / sbp).toFixed(2), "HR/SBP");
    else setScore("score-shock", "—", "HR/SBP required");
    if (sbp !== null && dbp !== null) setScore("score-map", `${((sbp + 2 * dbp) / 3).toFixed(0)} mmHg`, "calculated");
    else setScore("score-map", "—", "SBP/DBP required");

    return { news: pediatricMode ? null : news, newsComplete: !pediatricMode && missing.length === 0, newsMissing: pediatricMode ? ["not validated for pediatric use"] : missing, qsofa: pediatricMode || qsofaKnown.length !== 3 ? null : qsofaKnown.reduce((sum, item) => sum + item, 0), sirs: pediatricMode || knownSirs.length !== 4 ? null : knownSirs.reduce((sum, item) => sum + item, 0), gcs, curb: pediatricMode || !curbComplete ? null : curbCriteria.reduce((sum, item) => sum + item, 0), shock: hr !== null && sbp !== null && sbp > 0 ? (hr / sbp).toFixed(2) : null, map: sbp !== null && dbp !== null ? ((sbp + 2 * dbp) / 3).toFixed(0) : null };
  };

  const updateRedFlags = () => {
    const flags = checkedValues("redFlags");
    const alert = byId("red-flag-alert");
    alert.hidden = flags.length === 0;
    alert.textContent = flags.length ? `Red-flag item(s) marked present: ${flags.join("; ")}. This checklist is not a triage tool. The responsible clinician must assess promptly and follow local emergency pathways as appropriate.` : "";
  };

  const renderTaxonomy = () => {
    const target = byId("taxonomy-findings");
    const query = byId("taxonomy-search").value.trim().toLocaleLowerCase();
    const findings = registry.taxonomy.filter((item) => `${item.label} ${item.id}`.toLocaleLowerCase().includes(query));
    target.replaceChildren();
    for (const finding of findings) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "structuredFindings";
      checkbox.value = finding.id;
      checkbox.checked = confirmedFindings.has(finding.id);
      const text = document.createElement("span");
      text.textContent = finding.label;
      label.append(checkbox, text);
      target.append(label);
    }
    byId("taxonomy-status").textContent = !findings.length
      ? "No findings match this search."
      : confirmedFindings.size
        ? `${confirmedFindings.size} structured finding(s) explicitly confirmed by clinician.`
        : "No structured findings confirmed.";
  };

  const appendModuleField = (container, module, fieldDefinition, savedValues) => {
    const [fieldId, labelText, type, ...constraints] = fieldDefinition;
    const field = document.createElement("label");
    field.className = "field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const name = `module_${module.id}_${fieldId}`;
    let control;
    if (type === "select") {
      control = document.createElement("select");
      for (const optionText of constraints[0]) {
        const option = document.createElement("option");
        option.textContent = optionText;
        option.value = optionText === "Not recorded" ? "" : optionText;
        control.append(option);
      }
    } else if (type === "textarea") {
      control = document.createElement("textarea");
      control.rows = 3;
      control.maxLength = 600;
      control.placeholder = "Clinician-entered; no identifying information";
    } else {
      control = document.createElement("input");
      control.type = type;
      if (type === "number") {
        control.min = String(constraints[0]);
        control.max = String(constraints[1]);
        control.step = ["pack-years", "pediatric-weight"].includes(fieldId) ? "0.1" : "1";
      } else if (type === "file") {
        control.accept = "image/*";
        control.setAttribute("aria-describedby", "module-file-note");
      } else {
        control.maxLength = 240;
        control.placeholder = "Clinician-entered";
      }
    }
    control.id = `module-${module.id}-${fieldId}`;
    control.name = name;
    control.required = module.id === "pediatrics" && fieldId === "pediatric-weight";
    if (savedValues.has(name)) {
      if (type === "file" && window.DataTransfer) {
        const transfer = new DataTransfer();
        for (const file of savedValues.get(name)) transfer.items.add(file);
        control.files = transfer.files;
      } else if (type !== "file") {
        control.value = savedValues.get(name);
      }
    }
    field.append(label, control);
    container.append(field);
  };

  const renderModuleDetails = () => {
    const target = byId("module-details");
    for (const control of target.querySelectorAll("input[name^='module_'], select[name^='module_'], textarea[name^='module_']")) {
      if (control.type === "file") moduleValues.set(control.name, [...control.files]);
      else moduleValues.set(control.name, control.value);
    }
    for (const flag of checkedValues("redFlags")) {
      if (registry.modules.some((module) => module.redFlags.includes(flag))) confirmedModuleRedFlags.add(flag);
    }
    target.replaceChildren();
    for (const module of registry.modules.filter((item) => selectedModules.has(item.id))) {
      const panel = document.createElement("section");
      panel.className = "module-panel";
      const heading = document.createElement("div");
      heading.className = "module-panel-heading";
      const title = document.createElement("strong");
      title.textContent = module.label;
      const status = document.createElement("span");
      status.textContent = module.status;
      heading.append(title, status);
      panel.append(heading);
      const scope = document.createElement("p");
      scope.className = "module-scope";
      scope.textContent = `Documentation prompts for ${module.label}. They are optional (except explicitly required fields) and do not provide specialty-specific diagnostic, triage, or treatment algorithms.`;
      panel.append(scope);
      if (module.fields.length) {
        const fields = document.createElement("div");
        fields.className = "field-grid field-grid-2 module-fields";
        for (const definition of module.fields) appendModuleField(fields, module, definition, moduleValues);
        panel.append(fields);
      } else {
        const note = document.createElement("p");
        note.className = "module-empty";
        note.textContent = "The shared acute assessment fields above apply. This registry entry does not add automated specialty rules.";
        panel.append(note);
      }
      const progress = document.createElement("p");
      progress.className = "module-progress";
      progress.id = `module-progress-${module.id}`;
      progress.setAttribute("aria-live", "polite");
      panel.append(progress);
      if (module.id === "pediatrics") {
        const validationNote = document.createElement("p");
        validationNote.className = "module-validation-note";
        validationNote.id = "module-validation-note";
        validationNote.setAttribute("role", "status");
        panel.append(validationNote);
      }
      if (module.id === "dermatology" && module.fields.some((field) => field[2] === "file")) {
        const fileNote = document.createElement("p");
        fileNote.className = "field-hint";
        fileNote.id = "module-file-note";
        fileNote.textContent = "Image selection stays in this page; file contents and filenames are excluded from reports.";
        panel.append(fileNote);
      }
      if (module.redFlags.length) {
        const flagTitle = document.createElement("p");
        flagTitle.className = "module-red-flag-label";
        flagTitle.textContent = "Additional clinician-assessed red flags";
        const flags = document.createElement("div");
        flags.className = "check-grid module-red-flags";
        for (const flag of module.redFlags) {
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.name = "redFlags";
          checkbox.value = flag;
          checkbox.checked = confirmedModuleRedFlags.has(flag);
          const text = document.createElement("span");
          text.textContent = flag;
          label.append(checkbox, text);
          flags.append(label);
        }
        panel.append(flagTitle, flags);
      }
      target.append(panel);
    }
    renderModuleProgress();
    renderRegistryCoverage();
  };

  const renderModulePicker = () => {
    const target = byId("module-picker");
    target.replaceChildren();
    for (const module of registry.modules) {
      const label = document.createElement("label");
      label.className = "module-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "modules";
      checkbox.value = module.id;
      checkbox.checked = selectedModules.has(module.id);
      checkbox.disabled = module.id === "acute";
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = module.label;
      const status = document.createElement("small");
      status.textContent = module.status;
      copy.append(title, status);
      label.append(checkbox, copy);
      target.append(label);
    }
  };

  const renderRegistryCoverage = () => {
    byId("registry-summary").textContent = `${selectedModules.size} of ${registry.modules.length} available modules selected. Specialty content is documentation-only and requires clinical review.`;
    const list = byId("active-modules-list");
    list.replaceChildren(...registry.modules.filter((module) => selectedModules.has(module.id)).map((module) => {
      const row = document.createElement("div");
      row.className = "registry-mini-row";
      const title = document.createElement("strong");
      title.textContent = module.label;
      const status = document.createElement("span");
      status.textContent = module.status;
      row.append(title, status);
      return row;
    }));
  };

  const collectCase = () => {
    const data = {};
    for (const [key, item] of new FormData(form).entries()) {
      if (key === "diagnosticMode") continue;
      if (item instanceof File) continue;
      if (["comorbidities", "redFlags", "modules", "structuredFindings"].includes(key)) {
        if (!data[key]) data[key] = [];
        data[key].push(String(item));
      } else {
        data[key] = String(item).trim();
      }
    }
    data.modules = registry.modules.filter((module) => selectedModules.has(module.id)).map((module) => module.label);
    if (confirmedFindings.size) {
      data.structuredFindings = registry.taxonomy.filter((finding) => confirmedFindings.has(finding.id)).map((finding) => finding.label);
    }
    if (form.querySelector('input[type="file"]')?.files.length) data.localImageSelected = "Image selected locally; file content and filename are excluded from this worksheet.";
    data.supplementalO2 = byId("supplementalO2").checked;
    const bmi = calculateBmi();
    if (bmi !== null) data.bmi = `${bmi.value} kg/m². ${bmi.interpretation}. ${bmi.note} Reference: ${bmi.referenceLabel} (${bmi.referenceUrl})`;
    return data;
  };
  const collectCaseForDiagnostic = () => Object.fromEntries(
    Object.entries(collectCase()).filter(([key]) => !key.startsWith("clinician"))
  );

  const validateCase = () => {
    let firstInvalid = null;
    document.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    const moduleValidationNote = byId("module-validation-note");
    if (moduleValidationNote) moduleValidationNote.textContent = "";
    let validationMessage = "";
    for (const input of form.querySelectorAll("input[type=number]")) {
      if ((input.value || input.required) && !input.checkValidity()) {
        input.setCustomValidity("");
        firstInvalid = firstInvalid || input;
      }
    }
    if (selectedModules.has("pediatrics")) {
      const ageYears = byId("age").value.trim();
      const ageMonths = byId("module-pediatrics-age-months");
      if (!ageYears && !(ageMonths && ageMonths.value.trim())) {
        validationMessage = "Pediatric documentation requires age in years or, for a child under 2, age in months.";
        const ageError = document.querySelector('[data-error-for="age"]');
        if (ageError) ageError.textContent = validationMessage;
        if (moduleValidationNote) moduleValidationNote.textContent = validationMessage;
        firstInvalid = firstInvalid || byId("age");
      }
    }
    const complaint = byId("complaint");
    if (!complaint.value.trim()) {
      document.querySelector('[data-error-for="complaint"]').textContent = "Enter a chief complaint before preparing the clinician worksheet.";
      firstInvalid = firstInvalid || complaint;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      if (firstInvalid !== complaint) firstInvalid.reportValidity();
      showToast(firstInvalid === complaint ? "A chief complaint is required to prepare the worksheet." : validationMessage || "Check the highlighted value; it is outside the permitted range.");
      return false;
    }
    return true;
  };

  const fieldLabel = (name) => {
    const field = form.elements.namedItem(name);
    return field && field.closest(".field") ? field.closest(".field").querySelector("span").childNodes[0].textContent.trim() : name;
  };
  const populatedFields = (data) => Object.entries(data).filter(([key, item]) => {
    if (key === "supplementalO2") return item;
    if (Array.isArray(item)) return item.length > 0;
    return item !== "";
  });
  const hasClinicianDocumentation = () => [...form.querySelectorAll('[name^="clinicianDiagnosis"], [name^="clinicianIcd10_"], [name^="clinicianDiagnosisStatus"], [name^="clinicianRationale"], [name="clinicianManagementPlan"], [name="clinicianGuidelineCitation"], [name="clinicianReviewConfirmed"]')]
    .some((control) => control.type === "checkbox" ? control.checked : Boolean(control.value.trim()));
  const canCreateReport = () => generated || hasClinicianDocumentation();

  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const renderWorksheetStatus = () => {
    const card = byId("differential-card");
    const results = byId("differential-results");
    results.replaceChildren();
    card.hidden = !generated;
    if (!generated) return;
    const documentedCount = [...form.querySelectorAll('[name^="clinicianDiagnosis"]')]
      .filter((input) => input.value.trim()).length;
    const status = document.createElement("p");
    status.className = "differential-empty";
    status.textContent = `${documentedCount} clinician-authored ${documentedCount === 1 ? "diagnosis" : "diagnoses"} recorded. No diagnostic candidates were generated.`;
    results.append(status);
  };

  const buildReport = () => {
    const data = collectCase();
    const scores = calculateScores();
    const pediatricMode = selectedModules.has("pediatrics");
    const obstetricMode = selectedModules.has("obgyn");
    const rows = populatedFields(data).map(([key, raw]) => {
      const label = key === "supplementalO2" ? "Supplemental oxygen"
        : key === "comorbidities" ? "Comorbidities"
          : key === "redFlags" ? "Red flags marked present"
            : key === "modules" ? "Specialty modules selected"
              : key === "structuredFindings" ? "Clinician-confirmed structured findings"
                    : key === "localImageSelected" ? "Image attachment"
                      : key === "bmi" ? "BMI (calculated)" : fieldLabel(key);
      const content = key === "supplementalO2" ? "Yes" : Array.isArray(raw) ? raw.join(", ") : raw;
      return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(content)}</td></tr>`;
    }).join("");
    const notValidatedForPediatrics = "Not calculated — pediatric use not validated";
    const scoreRows = [
      ["NEWS2", pediatricMode ? notValidatedForPediatrics : scores.newsComplete ? String(scores.news) : `${scores.news} (incomplete)`],
      ["qSOFA", pediatricMode ? notValidatedForPediatrics : scores.qsofa === null ? "Incomplete" : `${scores.qsofa} / 3`],
      ["SIRS", pediatricMode ? notValidatedForPediatrics : scores.sirs === null ? "Incomplete" : `${scores.sirs} / 4`],
      ["GCS", scores.gcs === null ? "Incomplete" : `${scores.gcs} / 15`],
      ["CURB-65", pediatricMode ? notValidatedForPediatrics : scores.curb === null ? "Incomplete" : `${scores.curb} / 5`],
      ["Shock Index", scores.shock === null ? "Incomplete" : scores.shock],
      ["MAP", scores.map === null ? "Incomplete" : `${scores.map} mmHg`]
    ].map(([label, result]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(result)}</td></tr>`).join("");
    const scoreLimitations = [
      pediatricMode ? "Pediatric module selected: NEWS2, qSOFA, SIRS, and CURB-65 were not calculated because pediatric use is not validated here." : "",
      obstetricMode ? "Obstetric module selected: displayed scores are not pregnancy-adjusted or validated for obstetric use." : ""
    ].filter(Boolean).map((text) => `<p>${escapeHtml(text)}</p>`).join("");
    const invalidNumberFields = [...form.querySelectorAll('input[type="number"]')]
      .filter((input) => input.value !== "" && !input.checkValidity())
      .map((input) => fieldLabel(input.name));
    const inputValidationNote = invalidNumberFields.length
      ? `<p><strong>Input validation:</strong> The following entered numeric value(s) are outside the field's stated range or precision and were excluded from calculations: ${invalidNumberFields.map(escapeHtml).join(", ")}.</p>`
      : "";
    const created = new Date().toLocaleString();
    return `<!doctype html><html><head><meta charset="utf-8"><title>De-identified clinical worksheet</title><style>body{font:14px Arial,sans-serif;color:#23383d;max-width:860px;margin:34px auto;padding:0 20px}h1{font-size:23px}h2{font-size:16px;margin-top:24px}p{line-height:1.55}.notice{padding:12px;background:#fff7e8;border:1px solid #ead8b4}.toolbar{display:flex;justify-content:flex-end;gap:8px}.toolbar button{border:1px solid #dfe6e5;background:white;border-radius:5px;padding:8px 12px;color:#315b55;cursor:pointer}@media print{body{margin:0 auto}.toolbar{display:none}}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:7px;border-bottom:1px solid #e5e9e9}th{width:28%;color:#52676a}footer{margin-top:24px;color:#778588;font-size:11px}</style></head><body><div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div><p><strong>CLARITY CDSS · CLINICAL DOCUMENTATION WORKSPACE</strong></p><h1>De-identified clinical worksheet</h1><p>Created ${escapeHtml(created)}</p><p class="notice"><strong>Not a diagnostic system.</strong> This local workspace has no validated diagnostic engine, authentication, or server-side audit. It does not generate or verify diagnoses, differentials, certainty percentages, ICD-10 codes, disposition, or treatment advice. Score calculations are unvalidated and must not guide patient care. Entries in the clinician documentation section are clinician-authored and are not verified by this app. Verify all recorded values and calculations independently.</p><h2>Unvalidated score calculations</h2><table>${scoreRows}</table>${inputValidationNote}${scoreLimitations}<h2>Clinician-entered diagnostic documentation</h2><p>Diagnoses, statuses, ICD-10 codes, rationale, management notes, and citations below were entered by the clinician. This app does not determine, verify, or endorse them. Confirm ICD-10 codes against the official WHO classification and verify guideline applicability/current version independently.</p><h2>Clinician-entered information</h2><table>${rows || "<tr><td>No information entered.</td></tr>"}</table><footer>Licensed clinician review required · No identifying patient information should be entered · Session data is held in page memory only.</footer></body></html>`;
  };

  const downloadBlob = (content, mime, filename) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportAudit = (format) => {
    if (!auditEntries.length) {
      showToast("There is no session activity to export yet.");
      return;
    }
    if (format === "json") {
      downloadBlob(JSON.stringify({ exportedAt: new Date().toISOString(), scope: "in-memory session events; no patient information", events: auditEntries }, null, 2), "application/json", "clarity-session-audit.json");
    } else {
      const quote = (text) => `"${String(text).replace(/"/g, '""')}"`;
      const csv = ["timestamp,event", ...auditEntries.map((entry) => `${quote(entry.timestamp)},${quote(entry.event)}`)].join("\r\n");
      downloadBlob(csv, "text/csv;charset=utf-8", "clarity-session-audit.csv");
    }
    byId("export-options").hidden = true;
    byId("export-menu-button").setAttribute("aria-expanded", "false");
    audit("Audit log exported");
  };

  const replayReview = () => {
    if (!auditEntries.length) {
      showToast("There is no session activity to replay yet.");
      return;
    }
    if (auditPlaybackTimer) {
      stopAuditPlayback();
      return;
    }
    auditPlaybackEntries = auditEntries.slice(0, 30).reverse();
    auditPlaybackIndex = 0;
    byId("replay-audit").textContent = "Stop replay";
    auditPlaybackTimer = window.setInterval(() => {
      auditPlaybackIndex += 1;
      renderAudit();
      byId("audit-list").scrollTop = byId("audit-list").scrollHeight;
      if (auditPlaybackIndex >= auditPlaybackEntries.length) {
        stopAuditPlayback(false);
        auditOrder = "oldest";
        byId("audit-order").textContent = "Oldest first";
        byId("audit-order").setAttribute("aria-label", "Sort audit events oldest first");
        renderAudit();
        showToast("Audit replay complete. Events only; case data is not reconstructed.");
      }
    }, 350);
    renderAudit();
    showToast("Replaying the latest audit events oldest to newest; no case data is reconstructed.");
  };

  const stopAuditPlayback = (render = true) => {
    if (auditPlaybackTimer) window.clearInterval(auditPlaybackTimer);
    auditPlaybackTimer = null;
    auditPlaybackEntries = [];
    auditPlaybackIndex = 0;
    byId("replay-audit").textContent = "Replay timeline";
    if (render) renderAudit();
  };

  const toggleAuditOrder = () => {
    if (auditPlaybackTimer) stopAuditPlayback(false);
    auditOrder = auditOrder === "newest" ? "oldest" : "newest";
    byId("audit-order").textContent = auditOrder === "newest" ? "Newest first" : "Oldest first";
    byId("audit-order").setAttribute("aria-label", `Sort audit events ${auditOrder} first`);
    renderAudit();
    byId("audit-list").scrollTop = 0;
  };

  const clearCase = () => {
    if (diagnosticRequestController) {
      diagnosticRequestController.abort();
      byId("diagnostic-engine-status").textContent = "Case cleared and browser request aborted. If transmission had begun, the service may already have received the case.";
    }
    diagnosticResults = [];
    renderDiagnosticDrafts();
    form.reset();
    byId("diagnostic-transmission-confirmation").checked = false;
    byId("diagnostic-demo-acknowledgment").checked = false;
    setDiagnosticMode("documentation");
    updateDiagnosticButton();
    selectedModules = new Set(["acute"]);
    confirmedFindings.clear();
    moduleValues.clear();
    confirmedModuleRedFlags.clear();
    byId("taxonomy-search").value = "";
    renderModulePicker();
    renderModuleDetails();
    renderTaxonomy();
    generated = false;
    renderWorksheetStatus();
    document.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
    byId("report-description").textContent = "Enter clinician documentation or prepare the worksheet to enable downloads.";
    byId("workflow-note").textContent = "The synthetic demo ignores patient data. Real AI requests send case fields only after an approved service is connected and a clinician confirms consent.";
    setStep(1);
    calculateScores();
    updateRedFlags();
    audit("Case form cleared");
    showToast("Case cleared from the page.");
  };

  const prepareClinicalWorksheet = () => {
    if (!validateCase()) return;
    generated = false;
    renderWorksheetStatus();
    byId("workflow-note").textContent = "Checking required fields and preparing the clinician-authored worksheet…";
    setStep(2);
    audit("Input validation completed");
    const scores = calculateScores();
    audit("Unvalidated score calculations updated");
    setStep(3);
    updateRedFlags();
    audit(checkedValues("redFlags").length ? "Safety checklist updated: marked items require clinician assessment" : "Safety checklist refreshed: clinician assessment required");
    setStep(4);
    generated = true;
    renderWorksheetStatus();
    const newsDescription = selectedModules.has("pediatrics")
      ? "suppressed; pediatric use is unvalidated"
      : scores.newsComplete ? "calculated but unvalidated" : "incomplete";
    byId("report-description").textContent = `Clinician worksheet ready. NEWS2: ${newsDescription}. No diagnosis or differential was generated.`;
    byId("workflow-note").textContent = "Worksheet prepared for clinician review. Draft generation, if available, is a separate consented action; score calculations are unvalidated.";
    audit("Clinician worksheet prepared; no diagnosis generated");
    byId("differential-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    byId("report-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast("Clinical worksheet prepared. No diagnosis was generated.");
  };

  const updateTaxonomyStatus = () => {
    const hasMatches = byId("taxonomy-findings").querySelectorAll('input[name="structuredFindings"]').length > 0;
    byId("taxonomy-status").textContent = !hasMatches
      ? "No findings match this search."
      : confirmedFindings.size
        ? `${confirmedFindings.size} structured finding(s) explicitly confirmed by clinician.`
        : "No structured findings confirmed.";
  };

  const handleCaseChange = (event) => {
    if (event.target.id === "diagnostic-transmission-confirmation"
      || event.target.id === "diagnostic-demo-acknowledgment"
      || event.target.name === "diagnosticMode") {
      updateDiagnosticButton();
      return;
    }
    const hadInFlightRequest = Boolean(diagnosticRequestController);
    const hadConsent = byId("diagnostic-transmission-confirmation").checked;
    if (hadConsent) {
      byId("diagnostic-transmission-confirmation").checked = false;
      updateDiagnosticButton();
    }
    if (hadInFlightRequest) {
      diagnosticRequestController.abort();
      byId("diagnostic-engine-status").textContent = "Case changed while a request was in progress. The browser request was aborted; if transmission had begun, the service may already have received the case.";
      updateDiagnosticButton();
    }
    if (diagnosticResults.length) {
      diagnosticResults = [];
      renderDiagnosticDrafts();
      byId("diagnostic-engine-status").textContent = "Case changed after draft generation. Previous drafts were cleared; review the updated case before requesting new ones.";
    } else if (hadConsent && !hadInFlightRequest) {
      byId("diagnostic-engine-status").textContent = "Case changed; transmission consent was cleared. Review the case and confirm again before requesting drafts.";
    }
    if (["weight", "height", "age", "pregnancy"].includes(event.target.id || event.target.name)) calculateBmi();
    if (event.target.name === "redFlags" && registry.modules.some((module) => module.redFlags.includes(event.target.value))) {
      if (event.target.checked) confirmedModuleRedFlags.add(event.target.value);
      else confirmedModuleRedFlags.delete(event.target.value);
    }
    if (event.target.name === "structuredFindings") {
      if (event.target.checked) confirmedFindings.add(event.target.value);
      else confirmedFindings.delete(event.target.value);
      updateTaxonomyStatus();
    }
    if (event.target.id === "taxonomy-search" && event.type === "input") renderTaxonomy();
    if (event.target.name === "modules" && event.type === "change") {
      selectedModules = new Set([...form.querySelectorAll('input[name="modules"]:checked')].map((checkbox) => checkbox.value));
      selectedModules.add("acute");
      renderModulePicker();
      renderModuleDetails();
      audit(`Specialty module selection updated (${selectedModules.size} selected)`);
    }
    if (event.target.id === "age" || event.target.id === "module-pediatrics-age-months" || event.target.name === "modules") {
      const ageYears = byId("age").value.trim();
      const ageMonths = byId("module-pediatrics-age-months");
      if (!selectedModules.has("pediatrics") || ageYears || (ageMonths && ageMonths.value.trim())) {
        const ageError = document.querySelector('[data-error-for="age"]');
        if (ageError) ageError.textContent = "";
        const moduleValidationNote = byId("module-validation-note");
        if (moduleValidationNote) moduleValidationNote.textContent = "";
      }
    }
    renderModuleProgress();
    calculateScores();
    calculateBmi();
    updateRedFlags();
    if (generated) {
      generated = false;
      renderWorksheetStatus();
      byId("report-description").textContent = "Case changed since the worksheet was prepared. Prepare it again to refresh the worksheet.";
      byId("workflow-note").textContent = "Case changed. Prepare the worksheet again to refresh it.";
      setStep(1);
    }
  };
  form.addEventListener("input", handleCaseChange);
  form.addEventListener("change", handleCaseChange);
  byId("clear-case").addEventListener("click", clearCase);
  byId("generate-draft").addEventListener("click", prepareClinicalWorksheet);
  byId("diagnostic-transmission-confirmation").addEventListener("change", (event) => {
    if (!event.currentTarget.checked && diagnosticRequestController) {
      diagnosticRequestController.abort();
      byId("diagnostic-engine-status").textContent = "Transmission consent withdrawn and browser request aborted. If transmission had begun, the service may already have received the case.";
    }
    updateDiagnosticButton();
  });
  form.querySelectorAll('input[name="diagnosticMode"]').forEach((input) => {
    input.addEventListener("change", (event) => setDiagnosticMode(event.currentTarget.value));
  });
  byId("diagnostic-demo-acknowledgment").addEventListener("change", updateDiagnosticButton);
  byId("generate-diagnostic-demo").addEventListener("click", generateDiagnosticDemo);
  byId("request-diagnostic-drafts").addEventListener("click", requestDiagnosticDrafts);
  byId("diagnostic-draft-list").addEventListener("click", (event) => {
    const decisionButton = event.target.closest("[data-review-decision]");
    if (!decisionButton) return;
    const card = decisionButton.closest("[data-diagnosis-index]");
    const diagnosis = card && diagnosticResults[Number(card.dataset.diagnosisIndex)];
    if (!diagnosis) return;
    diagnosis.reviewDecision = decisionButton.dataset.reviewDecision;
    renderDiagnosticDrafts();
    audit(`Diagnostic draft ${diagnosis.reviewDecision.toLowerCase()}`);
  });
  byId("diagnostic-demo-results").addEventListener("click", (event) => {
    const decisionButton = event.target.closest("[data-demo-review-decision]");
    if (!decisionButton) return;
    const card = decisionButton.closest("[data-demo-index]");
    const result = card && diagnosticDemoResults[Number(card.dataset.demoIndex)];
    if (!result) return;
    result.reviewDecision = decisionButton.dataset.demoReviewDecision;
    renderDiagnosticDemo();
    audit(`Synthetic demo item ${result.reviewDecision.toLowerCase()}; not a patient diagnosis`);
  });
  byId("labs-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const content = byId("labs-content");
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    content.hidden = expanded;
    button.textContent = expanded ? "Show +" : "Hide −";
  });
  byId("download-pdf").addEventListener("click", () => {
    if (!canCreateReport()) { showToast("Enter clinician documentation or prepare the worksheet before creating a report."); return; }
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      showToast("Allow pop-ups to open the printable worksheet.");
      return;
    }
    preview.document.open();
    preview.document.write(buildReport());
    preview.document.close();
    audit("Printable worksheet opened");
  });
  byId("download-word").addEventListener("click", () => {
    if (!canCreateReport()) { showToast("Enter clinician documentation or prepare the worksheet before creating a report."); return; }
    downloadBlob(buildReport(), "application/msword;charset=utf-8", "clarity-clinical-worksheet.doc");
    audit("Word-compatible worksheet downloaded");
  });
  byId("export-menu-button").addEventListener("click", () => {
    const menu = byId("export-options");
    menu.hidden = !menu.hidden;
    byId("export-menu-button").setAttribute("aria-expanded", String(!menu.hidden));
  });
  byId("export-options").addEventListener("click", (event) => {
    const exportButton = event.target.closest("[data-export]");
    if (exportButton) exportAudit(exportButton.dataset.export);
  });
  byId("audit-order").addEventListener("click", toggleAuditOrder);
  byId("replay-audit").addEventListener("click", replayReview);
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".export-menu")) {
      byId("export-options").hidden = true;
      byId("export-menu-button").setAttribute("aria-expanded", "false");
    }
  });

  renderModulePicker();
  renderModuleDetails();
  renderTaxonomy();
  calculateScores();
  byId("diagnostic-transmission-confirmation").checked = false;
  byId("diagnostic-demo-acknowledgment").checked = false;
  updateDiagnosticButton();
  audit("Session started · clinician");
  audit("Scores updated · NEWS2 incomplete");
})();
