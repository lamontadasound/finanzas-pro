# Service permissions and saved customer billing

Baseline: GitHub main 7e05ebdeacaf37a22180b8965cc3a05891da580b, Vercel finanzas-pro10 READY.

Implemented: optional section allow-lists on existing line permissions, backend restrictive policies plus scoped privileged RPCs, calendar projection without amounts for calendar-only access, saved customer companies per line, editable invoice from each income with same-line and duplicate checks. Existing NULL allow-lists preserve current grants; admins retain full access.

Validation: production schema-only snapshot loaded into isolated PGlite; section/role/company isolation and calendar redaction passed. Linked invoice checks passed for Real Madrid and Sound including retry and duplicate refusal. 50 React tests passed; production build passed. Local visual QA reviewed user-permissions editor and company form with synthetic data. No real invoices or invitations issued during QA.

Routing: the optional astra-flash agent route was unavailable (missing routing.json); implemented directly without delegation.

Release blocked: automatic approval review rejected the production migration because it changes RLS, security-definer functions, storage and billing across multiple tables. It also rejected branch publication containing schema/function snapshots. Those local QA snapshots are now git-ignored and removed from the committed patch. No production migration, push, PR or deployment completed.

Pending: explicit user approval to apply the reviewed production migration and publish the feature code. The local PGlite section test requires the ignored schema-before.json fixture captured in this workspace.
