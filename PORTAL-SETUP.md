# MessMate VIT portal — deployment and activation

The portal uses Sites-managed D1 for records and private R2 for readiness photos. It contains no seeded student, caterer, or warden identities. Authorization is checked on each API request; the public Sites audience exposes the login screen, not private mess records.

## Confirmed roles

- Student: VIT email and password, then a single-use emailed code on each login. A verified student without approval can access only their account and assignment requests.
- Incharge: warden-issued ID and secret sign-in key, restricted to one mess. “Passkey” is currently interpreted as an issued secret, not a WebAuthn biometric credential.
- Warden: email and password, then email code, with cross-mess oversight. Warden email format is pending the owner’s input. There is no public staff registration or self-assigned role.

## Required before campus use

Configure runtime values through Sites; never commit live values:

| Value | Purpose |
| --- | --- |
| RESEND_API_KEY | Transactional email provider credential |
| MAIL_FROM | Sender on a verified email domain |
| STUDENT_REGISTRATION_PATTERN | Institution-approved registration number regex, without outer anchors |
| WARDEN_EMAIL_PATTERN | Institution-approved warden email regex, without outer anchors |
| BOOTSTRAP_WARDEN_EMAIL | Approved initial warden’s email |
| BOOTSTRAP_WARDEN_HASH | PBKDF2 password hash produced by scripts/create-warden-hash.mjs |
| CRON_SECRET | Random 32-byte-or-longer secret for the external readiness scheduler |

Use the password hash helper with the password passed through a secure environment variable named MESSMATE_WARDEN_PASSWORD. Do not paste plaintext credentials into tickets or commit them. The helper prints only the hash. Configuring an initial email does not verify it; the warden still completes emailed verification before access.

The food warden registers each actual hostel/caterer/mess and issues its incharge account. Obtain the official current roster; the three meal categories are not identities for individual caterers. Keep an email address on every incharge account for warning records even though email is not its login identifier.

## Menu content

MessIT’s frontend fetches these public JSON paths:
`https://messit.vinnovateit.com/menu-data/hostel-{1|2}-mess-{1|2|3}.json`

Hostel 1 = men, 2 = ladies. Mess 1 = Special, 2 = Veg, 3 = Non-Veg. These are category-level menus, not a confirmed caterer roster. The portal’s importer requires an authorized incharge/warden to explicitly map a feed to their registered mess. It validates the response identity and schema, preserves supplied dish names, imports only the requested month, and never manufactures missing months. No third-party credentials are required.

Source serving times: breakfast weekdays 07:00–09:00, weekends 07:30–09:30; lunch 12:30–14:30; snacks 16:30–18:15; dinner 19:00–21:00, all Asia/Kolkata. Confirm local caterer times before enabling warnings. Grace defaults to 15 minutes but is explicitly entered when the warden registers a mess. Historical imports are allowed without retroactive warnings; existing meals whose serving time has started cannot be overwritten. Menus can also be imported as validated JSON with documented source and optional sourced nutrition per item.

## Scheduled warnings and delivery

A scheduler must POST to `/api/portal/cron` every minute with `Authorization: Bearer <CRON_SECRET>`. The Sites interface exposed in this session does not provide a cron-trigger control, so the external schedule is NOT configured by this build. Do not claim unattended warnings are active until this is connected and exercised. The endpoint fails closed without the secret and runs independently of browser visits.

Checks insert a unique warning for each published meal lacking an on-time photo. An outbox with a unique per-warning/per-incharge identifier queues email; leases and provider idempotency keys reduce duplicate sends, with bounded exponential retries. Delivery after a provider’s idempotency retention expires can still duplicate a message if the provider accepted it but its acknowledgment was lost. Warning rows remain unique. Stored records include the meal deadline, server warning time, responses, photo receipt, and email sent time.

## Camera evidence

Capture uses getUserMedia with no gallery picker. A two-minute server-issued ticket binds a submission to the logged-in incharge and authorized meal. The server validates file size/type/signature, enforces a one-use ticket, detects exact byte reuse, stores the photo privately, and records receipt time independently of the client-reported time. Photos are immutable through the app. These controls cannot prove physical freshness or prevent virtual-camera replay or photographing another photo. Camera access requires HTTPS and browser permission. No freshness certification is implied.

## Monthly feedback and festivals

Survey, voting, and suggestions open during the last seven calendar days of the month in India time. The API enforces the window and one survey/suggestion/vote per student per month, even after a mess transfer. Votes can change within the same mess. The previous month’s normalized suggestion counts determine the top five, with deterministic alphabetical tie-breaking. Staff see aggregate survey scores; raw comments and student survey identities are not exposed by staff endpoints.

The 2026 national/Tamil Nadu holiday calendar comes from the government notification at https://www.tn.gov.in/sites/default/holidays/public_e_708_2025.pdf (annexure pages 4–5), inspected September 15, 2026. Bank-only closing day is excluded. On recognized dates the festival section appears automatically, with a truthful unpublished-menu state until the warden adds dishes. Warden-approved campus/regional additions are stored with a calendar source URL. Import the next official calendar annually; dates are not extrapolated.

Nutrition is reference-only, with explicit portion/source. Unknown recipe estimates are left unavailable until provided; they are not fabricated or treated as personal targets.

## Verification

`node scripts/test-portal.mjs` exercises the actual API logic against isolated SQLite, including cross-mess denials, pending approvals, role restrictions, CSRF checks, password hashing, two-step verification, single-use codes, India-time month boundaries, warning/email deduplication, and photo/import authorization. No real email or production records are used. Run the TypeScript check and Sites build after source changes. Physical device camera capture and live email/scheduler integration still require acceptance testing after activation.
