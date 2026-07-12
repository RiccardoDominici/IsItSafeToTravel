---
quick_id: 260711-daily-news-and-mailing-list
doc: LEGAL-PRIVACY-ASSESSMENT
author: Opus Legal/Privacy Analyst
date: 2026-07-11
status: draft-for-implementation
scope: GDPR / ePrivacy / cookie assessment for (A) mailing list, (B) vote geolocation, (C) cookies overall
disclaimer: Practical engineering guidance, not formal legal advice. Operator should have a lawyer sanity-check before scaling paid/marketing use.
---

# Legal & Privacy Assessment — Daily News + Mailing List

**Operator / data controller:** Riccardo Dominici, individual, based in Italy (EU). Audience worldwide incl. EU. GDPR + Italian D.Lgs. 196/2003 (as amended by 101/2018) + ePrivacy Directive (2002/58/EC, transposed) apply. German subscribers → BDSG / UWG double-opt-in expectations also apply, which the chosen design already satisfies.

**Existing state (verified against code):** There is ALREADY a combined Terms + Privacy + Imprint page per locale at route `legal` (`src/pages/{lang}/legal/index.astro`), with structured i18n keys under `legal.privacy_*` in `src/i18n/ui.ts` (7 locales). So the task is **additions to an existing policy**, not writing one from scratch. Imprint present: "Operator: Riccardo Dominici / Email: Riccardo.Dominici1999@gmail.com".

**Verified processor certifications (web, 2026-07-11):**
- **Resend** (email send) — certified under **EU-US Data Privacy Framework + UK extension**, publishes a DPA (`resend.com/legal/dpa`) and subprocessor list (`resend.com/legal/subprocessors`), SOC 2 + GDPR. US company. Transfer covered.
- **Cloudflare** (Pages hosting + D1 storage + Turnstile + CF-IPCountry) — certified under **EU-US / Swiss-US DPF + UK extension**, DPA incorporates **EU SCCs** as fallback. Transfer covered.
- **GitHub / Microsoft** (Actions runner that triggers the digest send) — Microsoft LLC is DPF-certified and offers SCC-backed DPA. GitHub Actions only holds secrets + the render step in memory; it is a transient processor of the send job. Transfer covered.

---

## 1. Per-feature analysis

### A. MAILING LIST (newsletter / daily digest)

**Personal data inventory (one D1 row per subscriber):**
| Field | Personal data? | Purpose |
|---|---|---|
| `email` | Yes (direct identifier) | deliver digest; primary key for rights requests |
| `confirmed` (bool) + `confirm_token` | Yes (linked) | double opt-in state |
| `consent_ts` (timestamp) | Yes (linked) | accountability / proof of consent |
| `consent_version` (e.g. `v1-2026-07-11`) | No alone | which consent text the user saw |
| `signup_country` (ISO-2 from CF-IPCountry) | No alone / low-risk in context | fraud/geo context, NOT full IP |
| `locale` | No alone | which language to send |
| `source_page` (e.g. `/en/country/fra`) | No alone | UX/attribution |
| `unsubscribe_token` | Yes (linked) | one-click unsubscribe |

Explicitly NOT stored: raw IP, name, browsing history, open/click tracking, profiling attributes. **Store `signup_country` only (2-letter code), never the full IP** — the raw IP is available on the request but must be dropped, not persisted.

**Legal basis:** **Consent — GDPR Art. 6(1)(a)** + **ePrivacy Art. 13** (electronic marketing requires prior consent). This is the only defensible basis for unsolicited recurring email to individuals; do not attempt legitimate interest here. Consent must be: freely given, specific, informed, unambiguous, opt-in. Design requirements this imposes:
- Checkbox/affirmative action **unticked by default** (no pre-checked box — CJEU *Planet49*). A dedicated "Subscribe" button click on a form whose sole purpose is the newsletter can itself be the affirmative act, provided the consent text sits directly under the field (the microcopy in §3b).
- **Double opt-in** (already chosen — correct; effectively mandatory for German recipients). The confirmation email must not contain marketing content beyond confirming.
- Consent must be **as easy to withdraw as to give** → one-click unsubscribe in every email (Art. 7(3)).

**Storage location + processors / transfers:**
- Storage: **Cloudflare D1** (subscriber table) — EU data may be processed in US infra; covered by CF DPF + SCC.
- Send: **Resend** (US) — covered by Resend DPF + DPA.
- Orchestration: **GitHub Actions** (Microsoft, US) — covered by DPF/SCC.
- No other third-party sharing, no ad networks, no list rental.

**Retention (proposed, concrete):**
- Unconfirmed signups: **delete after 30 days** if `confirmed = false` (cron/cleanup). Prevents indefinite storage of an email that never consented.
- Active subscribers: retained **until unsubscribe**.
- After unsubscribe: delete the profile row, but retain a **minimal suppression + proof-of-consent record** (hashed email or email + `consent_ts` + `consent_version` + `unsubscribe_ts`) for **up to 3 years** to (a) honour the opt-out / not re-add, and (b) evidence that consent existed (accountability, Art. 5(2)/7(1), and defence window vs. UWG/marketing complaints). Document this in the policy.

**Data-subject rights handling:**
- Access/export: `SELECT * WHERE email = ?` → return the row (email is the lookup key; a request from that mailbox authenticates itself well enough at this scale — reply to the same address).
- Erasure: `DELETE WHERE email = ?` (minus the suppression record above, which is itself a legal-obligation/accountability retention and can be honoured by keeping only a one-way hash).
- Rectification: rarely relevant (only field is email → just resubscribe).
- Withdrawal: one-click unsubscribe link = withdrawal of consent; must work without login.
- Provide the contact (existing imprint email) as the rights channel.

### B. VOTE GEOLOCATION (adding `voter_country` to the sentiment endpoint)

**Current state (verified — assess this too, not just the delta):**
- Endpoint `functions/api/vote.ts`, D1 table `votes`: `id, iso3, delta, official_score, voter_hash, day_hash, created_at`, `UNIQUE(iso3, voter_hash)`.
- `voter_hash` / `day_hash` = **salted SHA-256** (`VOTE_HASH_SALT`) of IP-derived input. **Raw IP is NOT stored.** Under GDPR (*Breyer* C-582/14) a salted hash of an IP is still **pseudonymous personal data**, not anonymous — but it is a proportionate, minimised abuse-prevention measure and already documented in the privacy policy (`legal.privacy_votes_text`).
- Client-side dedup: `localStorage['sentiment-voted-<iso3>']` — device-local flag, set as a **direct result of the user's own vote action**. This is consent-exempt under ePrivacy (strictly-necessary / user-requested functionality). Already disclosed. No cookie.
- Turnstile: env-gated anti-bot; Cloudflare processor, no cross-site tracking cookie in managed mode. Already disclosed.

**Delta being added:** persist `voter_country` = ISO-2 from `request.cf.country` / `CF-IPCountry`.

**Personal data inventory (delta):** a 2-letter country code stored next to a pseudonymous `voter_hash`. Country alone is not personal data; combined with the row it is low-risk, coarse (country-level, not city/IP), and cannot single out an individual. No new identifier, no raw IP, no lat/long.

**Legal basis:** **Legitimate interest — GDPR Art. 6(1)(f)**. Balancing test:
- *Purpose:* detect geographic vote-brigading / abuse and show aggregate "where votes came from" context — legitimate, and integral to a crowd-sentiment feature's integrity.
- *Necessity:* coarse country is the minimum that achieves geo-abuse detection; no less-intrusive means gives geo signal.
- *Balancing / data-subject impact:* minimal — no cookie, no raw IP, no tracking across sites, no profiling, coarse granularity, already-hashed identity. A voter has no reasonable expectation that the *country* they voted from is private when publicly submitting a crowd score. Impact does not override the interest. **Legitimate interest stands.**
- Consent is NOT required (no marketing, no cookie access beyond the already-exempt functional flag). Just disclose it in the policy (§3a addition) and in the Art. 13 notice.

**Retention:** votes are retained as an aggregate dataset. Recommend: purge or re-hash `voter_hash` after the **dedup window is no longer needed (e.g. 90 days)** to reduce linkability, keeping `iso3 / delta / voter_country / created_at` as anonymous aggregate. Not a blocker; a SHOULD.

**Rights:** because rows are pseudonymous with no stored raw IP/email, the operator generally cannot re-identify a voter to service a granular erasure request (Art. 11 — no obligation to acquire extra data to identify). Document that votes are pseudonymised and aggregate.

### C. COOKIES / TRACKERS OVERALL — actual inventory

| Mechanism | Set by | Type | Consent status |
|---|---|---|---|
| `theme` localStorage | `DarkModeToggle.astro` | functional, user-set | **Exempt** (strictly necessary / user-requested) |
| `sentiment-voted-<iso3>` localStorage | `SentimentVote.astro` | functional, result of user action | **Exempt** |
| **Newsletter form** (new) | subscribe widget | **none** — plain POST, no cookie, no storage | **No change to cookie posture** |
| Cloudflare Web Analytics | (policy claims used) | cookieless, aggregate | Exempt (no cookie, no PII) |
| **Microsoft Clarity** | `Base.astro` deferred loader | **session-recording + sets first-party cookies `_clck` / `_clsk`** | **NOT strictly necessary → requires prior consent** ⚠️ |
| Ko-fi widget | `Base.astro` deferred loader | third-party donate widget; may set its own cookies when loaded | Consent-relevant if it sets cookies before interaction ⚠️ |

⚠️ **Pre-existing gap, flagged (not caused by this project):** The privacy copy currently asserts a "zero-cookie approach" and that Clarity "does not use cookies." That is factually inaccurate — **Microsoft Clarity sets first-party cookies (`_clck`, `_clsk`) and records session behaviour**, which under ePrivacy/CJEU *Planet49* is a non-essential technology requiring **prior opt-in consent**. This means a consent mechanism (or removing/gating Clarity) is arguably *already* required today, independent of the newsletter. The newsletter/vote-country changes do **not** worsen this, but the assessment must not paper over it.

---

## 2. Cookie-banner verdict

**Verdict for the NEW features (newsletter + vote country): NO cookie banner is required, and they do not create one.**
- The subscribe form sets **no cookies and no client storage** — it is a consent-based form submission, governed by the privacy notice + the checkbox, not by ePrivacy cookie rules.
- `theme` and `sentiment-voted` localStorage are **consent-exempt** (strictly necessary / explicitly user-requested). Adding `voter_country` server-side touches no client storage.
- Country geolocation is server-side from an HTTP header, not a "storage of / access to information on the user's device" event → outside the ePrivacy cookie-consent trigger.

**Conditions that WOULD require a banner (state them plainly):**
1. **Microsoft Clarity (and any Ko-fi cookies) — this already trips the wire.** Clarity's `_clck/_clsk` + session recording is non-essential. To stay banner-free the operator must either **(a) remove Clarity**, or **(b) load it only after explicit opt-in via a lightweight consent control.** As long as Clarity runs unconditionally, the honest position is that a consent gate is due. **Recommended:** treat this as a parallel SHOULD-fix; either drop Clarity in favour of the cookieless Cloudflare Web Analytics already in use, or gate it. Then the whole site is genuinely banner-free.
2. If the newsletter ever adds **open/click tracking pixels or per-user analytics** → that is profiling → requires its own consent and likely a banner. Keep the digest tracking-free.
3. If any **advertising / retargeting / third-party marketing** scripts are ever added.

**Bottom line:** *This project* keeps the site's cookie posture clean. The only banner question on the site is Clarity, which predates this work — fix or gate it and the site is legitimately "no banner needed."

---

## 3. Draft texts (ready to paste) — EN + IT

> Add these as **new i18n keys** in `src/i18n/ui.ts` for all 7 locales (en/it/es/fr/pt/zh/de). EN + IT authoritative below; es/fr/pt/zh/de translated to match. Suggested key namespace: `legal.privacy_newsletter_*`, `newsletter.consent`, `newsletter.email_footer_*`.

### 3a. Privacy-policy additions

**New subsection — Newsletter (key `legal.privacy_newsletter_title` / `_text`):**

**EN — title:** "Newsletter / Daily Digest"
**EN — text:**
"If you subscribe to our email digest, we collect and store your email address, your language preference, the page you subscribed from, and — as proof of consent — the date and time of your subscription, the version of this consent text you agreed to, and the two-letter country code of your connection (derived from your IP by our host; we never store your full IP address). We use this data for the sole purpose of sending you the safety-update digest you asked for. The legal basis is your consent (Art. 6(1)(a) GDPR and the ePrivacy rules on electronic marketing). We confirm every subscription by email (double opt-in) and never share your address with third parties for their own marketing. Your email is stored in our Cloudflare D1 database and sent via Resend, Inc. (USA); both are certified under the EU-US Data Privacy Framework. Unconfirmed subscriptions are deleted after 30 days. You can unsubscribe at any time using the one-click link in every email; after you unsubscribe we delete your profile but keep a minimal record (a hashed identifier and the consent date) for up to 3 years to honour your opt-out and to evidence prior consent. To access or delete your data, email us at the address below."

**IT — title:** "Newsletter / Riepilogo giornaliero"
**IT — text:**
"Se ti iscrivi al nostro riepilogo via email, raccogliamo e conserviamo il tuo indirizzo email, la tua preferenza di lingua, la pagina da cui ti sei iscritto e — come prova del consenso — la data e l'ora dell'iscrizione, la versione del testo di consenso che hai accettato e il codice a due lettere del Paese della tua connessione (ricavato dal tuo IP dal nostro host; non memorizziamo mai l'indirizzo IP completo). Utilizziamo questi dati al solo scopo di inviarti il riepilogo sugli aggiornamenti di sicurezza che hai richiesto. La base giuridica e il tuo consenso (art. 6, par. 1, lett. a) del GDPR e le norme ePrivacy sul marketing elettronico). Confermiamo ogni iscrizione via email (double opt-in) e non condividiamo mai il tuo indirizzo con terzi per finalita di marketing proprie. La tua email e conservata nel nostro database Cloudflare D1 e inviata tramite Resend, Inc. (USA); entrambi sono certificati secondo il Data Privacy Framework UE-USA. Le iscrizioni non confermate vengono eliminate dopo 30 giorni. Puoi annullare l'iscrizione in qualsiasi momento tramite il link con un clic presente in ogni email; dopo la cancellazione eliminiamo il tuo profilo ma conserviamo un dato minimo (un identificatore con hash e la data del consenso) per un massimo di 3 anni, per rispettare la tua rinuncia e dimostrare il consenso prestato. Per accedere ai tuoi dati o eliminarli, scrivici all'indirizzo indicato sotto."

**Amendment to the existing vote subsection (`legal.privacy_votes_text`)** — append one sentence (EN / IT):
- **EN:** "We also store the two-letter country code of your connection (from your host's geolocation header, never your full IP address) to detect coordinated vote manipulation and to show aggregate, country-level context. The legal basis for this is our legitimate interest (Art. 6(1)(f) GDPR) in keeping community scores trustworthy; the data is coarse, pseudonymous, and never used to profile or track you."
- **IT:** "Memorizziamo inoltre il codice a due lettere del Paese della tua connessione (dall'header di geolocalizzazione del nostro host, mai il tuo indirizzo IP completo) per rilevare manipolazioni coordinate dei voti e mostrare un contesto aggregato a livello di Paese. La base giuridica e il nostro legittimo interesse (art. 6, par. 1, lett. f) del GDPR) a mantenere affidabili i punteggi della community; il dato e generico, pseudonimo e non viene mai usato per profilarti o tracciarti."

**Amend the processors/hosting text** to name Resend and, ideally, GitHub Actions as processors, and correct the Clarity/"zero-cookie" claim (see §4 MUST). Suggested processor list line (EN): "We rely on the following processors: Cloudflare (hosting, database, bot-check, geolocation — EU-US DPF + SCCs), Resend, Inc. (newsletter delivery — EU-US DPF), and GitHub, Inc. / Microsoft (automation that triggers the digest — EU-US DPF + SCCs)."

### 3b. Subscribe-form consent microcopy (line under the email field)

- **EN:** "By subscribing you agree to receive our safety-update digest by email and to our [Privacy Policy](/en/legal/). We store only your email and consent details, never share them, and you can unsubscribe with one click any time."
- **IT:** "Iscrivendoti accetti di ricevere il nostro riepilogo sugli aggiornamenti di sicurezza via email e la nostra [Informativa sulla privacy](/it/legale/). Conserviamo solo la tua email e i dati del consenso, non li condividiamo mai e puoi annullare l'iscrizione con un clic in qualsiasi momento."

*(The link target must use each locale's localized `legal` slug via `getLocalizedPath`.)* The checkbox, if used, must be **unticked by default**.

### 3c. Confirmation / digest email footer lines (Art. 13 identity + unsubscribe)

**Confirmation (double opt-in) email — body + footer, EN:**
"You (or someone using this address) asked to receive the isitsafetotravel.org safety digest. Please confirm your subscription: [Confirm]. If you didn't request this, ignore this email — no messages will be sent without confirmation.
—
Sent by Riccardo Dominici, operator of isitsafetotravel.org · Contact: Riccardo.Dominici1999@gmail.com · You are receiving this only to confirm a subscription request; this is not marketing."

**Confirmation email — IT:**
"Tu (o qualcuno che usa questo indirizzo) hai chiesto di ricevere il riepilogo sulla sicurezza di isitsafetotravel.org. Conferma l'iscrizione: [Conferma]. Se non hai effettuato questa richiesta, ignora questa email: nessun messaggio verra inviato senza conferma.
—
Inviata da Riccardo Dominici, gestore di isitsafetotravel.org · Contatto: Riccardo.Dominici1999@gmail.com · Ricevi questo messaggio solo per confermare una richiesta di iscrizione; non e materiale promozionale."

**Recurring digest — footer, EN:**
"You receive this because you confirmed a subscription at isitsafetotravel.org. · [Unsubscribe with one click] · Sent by Riccardo Dominici (Italy), operator of isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · We never share your address."

**Recurring digest — footer, IT:**
"Ricevi questa email perche hai confermato un'iscrizione su isitsafetotravel.org. · [Annulla iscrizione con un clic] · Inviata da Riccardo Dominici (Italia), gestore di isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Non condividiamo mai il tuo indirizzo."

*(A physical postal address is a strict CAN-SPAM requirement for US recipients and good practice; an individual operator may use a contact email + country in lieu of publishing a home address, which is the pragmatic EU-imprint approach already used on the site. If US volume grows, add a mailing address or PO box.)*

### 3d. Full minimal privacy policy?

**Not needed** — a per-locale privacy policy already exists (`legal` route, `legal.privacy_*` keys). Do the §3a **additions**, not a rewrite.

---

## 4. Action checklist

### MUST (legally required before shipping the newsletter)
1. **Publish the newsletter privacy subsection** (§3a) in the existing `legal` page for **all 7 locales** before the form goes live. New i18n keys `legal.privacy_newsletter_title/_text`.
2. **Consent microcopy + privacy link directly under the email field** (§3b), on every placement (country pages + news page). Link uses the localized `legal` slug. Any consent checkbox is **unticked by default**.
3. **Store a consent record on signup**: `consent_ts` (UTC), `consent_version` = **`v1-2026-07-11`** (bump the string whenever the microcopy/policy text changes), `locale`, `source_page`, `signup_country` (ISO-2 from `CF-IPCountry`). **Never persist the raw IP.**
4. **Double opt-in**: no address is added to the send list until the confirmation link is clicked; unconfirmed rows deleted after 30 days. Confirmation email carries the §3c identity + "this is not marketing" line.
5. **One-click unsubscribe in every digest** (working without login; a tokenised GET/POST). Also honour `List-Unsubscribe` + `List-Unsubscribe-Post` email headers (one-click, RFC 8058 — required by Gmail/Yahoo bulk-sender rules).
6. **Digest footer** with sender identity + unsubscribe (§3c) on every send.
7. **Add the vote-country sentence** (§3a amendment to `legal.privacy_votes_text`) for all 7 locales **before** the endpoint starts storing `voter_country`. Store **country code only, never raw IP**.
8. **Name the processors** (Cloudflare, Resend, GitHub) and their DPF/SCC transfer basis in the policy (§3a processors line), all 7 locales. Required for lawful international-transfer disclosure (Art. 13(1)(f)).
9. **Erasure + export path**: implement (even if manual) `DELETE`/`SELECT WHERE email = ?` reachable via the imprint email; state the rights + contact in the newsletter subsection.

### SHOULD (best practice, do soon)
10. **Fix the Clarity / "zero-cookie" inaccuracy** (§1C ⚠️): either drop Microsoft Clarity in favour of the already-present cookieless Cloudflare Web Analytics, **or** gate Clarity behind explicit opt-in — then correct `legal.privacy_cookies_text` / `_analytics_text` in all 7 locales. Until then the site's "no cookies" claim is not accurate.
11. **Sign/record the DPAs**: accept Resend's DPA and Cloudflare's DPA (self-serve); keep a copy. These are the Art. 28 processor contracts.
12. **Purge/rotate `voter_hash` after ~90 days** and consider the same lifecycle discipline for aborted signups; document retention in policy.
13. **Rate-limit + validate the subscribe endpoint** (email format, one confirmation email per address per window) to avoid being an open relay for confirmation-email spam / list-bombing others.
14. **`consent_version` change process**: whenever §3b/§3a text changes, bump the string (`v2-YYYY-MM-DD`) so records map to the exact text consented to.

### NICE
15. Preference/expectation copy: state send frequency ("about once a day") near the form — reduces spam complaints, strengthens "informed" consent.
16. Add a physical/postal contact (PO box) if US send volume grows (CAN-SPAM).
17. Self-service data export button (vs. manual email handling).
18. Suppression list stored as a one-way hash of the email (privacy-preserving opt-out memory).

---

## 5. Out of scope / deferred (with reasons)

- **Article 30 Records of Processing (ROPA):** Art. 30(5) exempts controllers <250 persons unless processing is non-occasional. A newsletter is arguably regular, so a *one-page* internal ROPA is good hygiene — but at single-operator hobby scale it is a **SHOULD-later**, not a ship blocker. Deferred.
- **Data Protection Officer (DPO):** not required — no large-scale/systematic monitoring, no special-category processing (Art. 37). Deferred/N-A.
- **DPIA (Art. 35):** not required — low-risk, no profiling, no special categories, no large-scale monitoring. N-A.
- **EU/UK representative (Art. 27):** N-A — controller is established in the EU (Italy).
- **Formal, individually negotiated DPAs / SCC signing ceremonies:** the self-serve DPF+SCC terms from Cloudflare/Resend/GitHub suffice at this scale; bespoke SCC negotiation deferred.
- **Cookie consent-management platform (CMP):** not adopted — the fix is to remove/gate Clarity (SHOULD #10), not to bolt on a CMP. Deferred unless ads/tracking are ever added.
- **Age-gating / children's data:** newsletter is general-audience, non-targeted; standard "not directed to children" stance suffices. Deferred.
