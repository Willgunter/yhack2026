# Sovereign Governance Charter v2.0 (2026)

### Section 1: Access Control (RBAC)
- **Role: Intern**: Restricted to "Development" environments. No access to production keys, customer PII, or financial deployment.
- **Role: Senior Developer**: Authorized for "Staging" and "Review" overrides.
- **Role: Compliance Lead**: Root authority for all Level 5 security breaches.

### Section 2: Prohibited Actions (Intern)
- **Violation Level 5**: Pushing unencrypted high-entropy strings (API Keys, Secrets, Private Keys) to any repository.
- **Violation Level 4**: Verbalizing plain-text credentials in a monitored environment.
- **Violation Level 3**: Attempting to bypass the local `pre-push` guard.

### Section 3: Enforcement Protocol
- **Immediate Action**: Any Level 5 breach results in a terminal lock and a PSI (Tavus) Face-to-Face confrontation.
- **Escalation**: All telemetry, including the K2 Reasoning Trace and PSI Video, is mirrored to the **Senior Developer** and/or **Compliance Lead** depending on the severity of the violation.
