# TOR 5.x Compliance Notes

Updated: 2026-05-02

This document summarizes the current implementation status of TOR items 5.1-5.4 for the NUCARE project, including the test approach that can be referenced in a delivery package.

## 5.1 WCAG 2.x Level AA

### Current implementation

- `client/src/app/layout.tsx`
  Added a skip link to main content for keyboard users.
- `client/src/app/globals.css`
  Added visible `:focus-visible` styling and a `prefers-reduced-motion` fallback.
- `client/src/components/cookie-consent-popup.tsx`
  Improved keyboard accessibility by adding:
  - dialog semantics (`role="dialog"`, `aria-modal`)
  - dialog labelling (`aria-labelledby`, `aria-describedby`)
  - initial focus placement when the dialog opens
  - focus trapping while the dialog is open
  - focus restoration after closing
  - accessible labelling for the analytics toggle

### Automated checks performed

- `client`: `npm run lint`
  Uses the Next.js ESLint pipeline, including accessibility lint rules from `eslint-plugin-jsx-a11y`.
- `client`: `npm run build`
- `server`: `npm run build`

### Manual test scope required for formal handoff

The following manual tests should be executed in a browser before final acceptance because automated linting cannot fully verify them:

1. Keyboard-only navigation on the public home page, login flow, privacy page, and cookie settings dialog.
2. Focus order and visible focus indication for all interactive controls.
3. Responsive display at mobile, tablet, and desktop breakpoints.
4. Screen-reader spot checks for page titles, dialog announcements, and form labels.
5. Color contrast verification for key text, buttons, alerts, and status badges.

### Current status

- Partially satisfied in code.
- Browser-based manual accessibility verification is still required for a formal WCAG AA acceptance statement.

## 5.2 URL Structure and SEO

### Current implementation

- Added reusable metadata utilities in `client/src/lib/site-metadata.ts`.
- Added route-level metadata for:
  - `/`
  - `/privacy`
  - `/terms`
- Added `noindex` metadata for:
  - `/login`, `/forgot-password`, `/reset-password`
  - authenticated app routes `/student`, `/admin`, `/advisor`, `/instructor`, `/executive`, `/mental-health`, `/student-development`, `/change-password`
- Added canonical URLs via App Router metadata.

### Current status

- Public routes now have SEO metadata scaffolding suitable for fixed marketing/legal pages.
- Internal authenticated routes are explicitly marked as non-indexable.

### Remaining gap against TOR

- The current project does not yet include a course CMS or slug-based course detail routes such as `/course/nursing-specialty-4m`.
- If the scope later includes public course content, the following should be added:
  - a slug field in the CMS/data model
  - dynamic course routes
  - per-course `title` and `description` generation from CMS content

## 5.3 PDPA Framework Implementation

### Current implementation

- Cookie consent is shown clearly on first visit via `client/src/components/cookie-consent-popup.tsx`.
- Users can now choose:
  - accept all cookies
  - accept necessary cookies only
  - customize analytics preference
- Privacy and cookie policy content is available on `/privacy`.
- The privacy content already describes:
  - categories of personal data
  - purposes of use
  - retention period
  - security controls
  - data subject rights

### Current status

- The front-end consent and policy requirements are substantially covered.

### Remaining gap against TOR

- Consent is currently stored in browser `localStorage` only.
- For stronger governance, consider adding a server-side consent ledger with:
  - consent version
  - timestamp
  - policy version
  - user or anonymous session identifier

## 5.4 Audit Readiness

### Current implementation

- Audit logging already existed for major admin and workflow actions.
- Added audit logging to authentication-related flows in `server/src/controllers/auth.controller.ts`:
  - successful login
  - failed login attempt
  - logout
  - password reset request
  - password reset completion
  - password change
- The production Docker path still keeps PostgreSQL on the internal network via `docker-compose.prod.yml`, while `docker-compose.yml` now republishes `5432:5432` temporarily to support the local `npm run dev` workflow.
- Added `docker-compose.prod.yml` and a file-based secret policy so production deployments can inject sensitive values through `*_FILE` references instead of inline compose secrets.
- Audit logs are available in the admin dashboard.

### Current status

- The system is materially closer to audit readiness because privileged and security-sensitive events are now traceable in one log stream.

### Remaining gap against TOR

- No dedicated audit export package or retention policy document is included yet.
- No tamper-evidence or external log shipping is implemented yet.
- For stronger readiness, consider:
  - exportable audit reports
  - retention policy by log type
  - immutable/off-system log forwarding
  - centralized off-host log shipping for production incidents

## Verification Summary

The following checks were executed on 2026-05-01:

- `client`: `npm run lint`
- `client`: `npm run build`
- `server`: `npm run build`
- `client`: `npm audit --omit=dev`
- `server`: `npm audit --omit=dev`

Audit result:

- `client`: `found 0 vulnerabilities`
- `server`: `found 0 vulnerabilities`
