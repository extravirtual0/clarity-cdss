# Diagnostic-engine integration contract

This document defines an integration boundary only. **No backend, clinician authentication, AI engine, or clinical approval is included in this project.** The separately labeled synthetic demo shows seven prewritten, unranked teaching candidates for one fictional sore-throat vignette. They are not AI results and do not read patient fields. They have no assigned certainty scores; their approximate illustrative ICD-10 mappings are not verified or patient-specific and must be confirmed in the official WHO classification. The demo includes no management plan, and its topic links are not personalized or automatically applied to patient care. It must never be treated as clinical guidance. Real patient-specific generation must remain unavailable until an independently implemented same-origin AI service is configured, reviewed, and approved for its exact intended clinical use. Do not treat this contract as clinical validation or authorization to deploy.

## Required server controls

The server must enforce authentication and authorization on every endpoint, not rely on the client readiness check or checkbox. It must verify the clinician's permitted scope and the engine's documented approval for that scope, validate all request fields, reject identifying data according to its policy, and independently require CSRF protection and same-origin `Origin`/`Referer` checks. Use HTTPS, restrictive security headers, `Cache-Control: no-store`, request-size limits, rate limits, secure session cookies, and server-side audit/access controls appropriate to the deployment. Never send provider credentials or engine secrets to the browser. The service must document its data handling, retention, subprocessors, model/version, approval evidence, limitations, and incident process.

The clinician consent checkbox is an explicit user interaction, not a security control or proof that submitted information is de-identified. The server must perform its own checks. The browser's case collector excludes uploaded image contents and filenames, but clinicians must not enter names, record numbers, contact details, or other identifying information in any field.

## Readiness endpoint

`GET /api/diagnostic-engine/status`

The workspace makes this same-origin request only after the user selects AI/demo mode, and only over HTTPS, with credentials included, redirects rejected, and cache disabled. It sends no case data. Return JSON only. The client enables the AI request button only when all of the following are present:

```json
{
  "available": true,
  "clinicianAuthenticated": true,
  "clinicalApproval": true,
  "engineKind": "ai",
  "engineName": "Approved service name",
  "engineVersion": "Version",
  "clinicalScope": "Precisely approved use and population",
  "approvalReference": "Auditable approval identifier",
  "csrfToken": "Short-lived session-bound token"
}
```

These booleans are not sufficient by themselves: the server must derive them from real authenticated session and approval configuration, and re-check them on generation. Do not put credentials in the token or return long-lived secrets. If any property is absent, false, stale, or outside the active session/scope, the client remains disabled. The endpoint must not reveal patient data.

## Generation request

`POST /api/diagnostic-engine/differential`

The browser sends this only after readiness succeeds for an approved AI service, the clinician checks the per-case consent box, and the clinician explicitly activates generation. It uses HTTPS, same-origin credentials, JSON, the returned CSRF token in `X-CSRF-Token`, rejects redirects, and disables caching:

```json
{
  "schemaVersion": "1.0",
  "clinicianReviewRequired": true,
  "approvalReference": "The exact active readiness approval reference",
  "engineKind": "ai",
  "case": {
    "complaint": "De-identified worksheet fields and explicit clinician selections"
  }
}
```

The real `case` object is collected from the worksheet. The example is abbreviated. The server must not trust the client-side consent or `clinicianReviewRequired` flags; validate fields, authenticated identity, approval, scope, and CSRF independently. Reject requests when the clinical scope does not cover the entered population or use. Never return fabricated success-shaped output on failure.

## Response shape and client handling

Successful responses must be JSON and use this shape. Arrays may be empty; the engine should return only candidates supported within its approved scope, not pad to an arbitrary count.

```json
{
  "engineName": "Approved service name",
  "engineKind": "ai",
  "engineVersion": "Version",
  "clinicalScope": "Precisely approved use and population",
  "approvalReference": "The exact active approval reference",
  "limitations": ["Relevant limitations for this request"],
  "diagnoses": [
    {
      "label": "Draft candidate label",
      "icd10Code": "Optional engine-provided code",
      "icd10Edition": "Optional classification edition",
      "certaintyPercent": 0,
      "certaintyCalibration": "Required evidence and meaning when a percentage is returned",
      "evidenceFor": ["Supporting case evidence"],
      "evidenceAgainst": ["Counterevidence and uncertainty"],
      "missingInformation": ["Important missing information"],
      "managementConsiderations": "Optional draft considerations, never an instruction",
      "engineLimitations": ["Candidate-specific limitations"],
      "guidelineReferences": [
        {
          "title": "Source title",
          "version": "Optional version or publication date",
          "url": "https://approved-source.example/path"
        }
      ]
    }
  ]
}
```

At most seven candidates are rendered. If a certainty percentage is returned, the engine must provide calibration meaning; an uncalibrated score must not be presented as a probability or certainty. ICD-10 values and citations are displayed as engine-provided content and are **not verified by the app**. References must be HTTPS URLs and are opened as external links. Keep user-supplied output as plain text; never return HTML for rendering.

The browser limits response size, validates the response shape, candidate count, field lengths, scope and approval echo, and safely renders strings with text nodes. Invalid responses and network/server errors fail closed: no draft is shown or copied into clinician-authored diagnosis fields. The user can mark a draft “Accept for clinician assessment” or “Decline”; these choices are transient review annotations only and do not confirm a diagnosis, populate the clinical record, or prove that the candidate is correct. Any case edit clears displayed drafts; edits during a request abort the browser request, but the service may already have received it if transmission began.

All generation responses remain unverified decision support. They must be presented with a prominent warning that clinician review is mandatory and that output is not a diagnosis or treatment instruction. No output may bypass clinician assessment or be silently written as an approved diagnosis, code, or management plan.

## Current state

There is no implementation of either endpoint in this project. Real AI generation remains disabled. Do not enable it by hard-coding a status object, embedding a model key, or substituting local candidate rules for AI. The separate prewritten demo uses only a fixed synthetic vignette and is never based on patient form data. A deployment needs a separately reviewed backend, appropriate authentication, AI-engine and clinical approval, clinical validation, and operational safety review before it can return real case drafts.
