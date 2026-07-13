// functions/lib/newsletter-copy.ts — shared localized copy + inline HTML builders for the
// mailing-list Functions (subscribe/confirm/unsubscribe) and the digest script.
// Kept dependency-free of src/i18n/ui.ts on purpose: functions/ is a separate edge runtime and
// the house style (see functions/api/vote.ts, feedback.ts) does not import from src/.
// Styling matches the site's brand: sand palette + terracotta accent, DM Sans heading font (see
// src/styles/global.css). Digest event cards are a lite, email-safe rendition of the site's B6
// news card (src/components/news/NewsCard.astro) — same sentiment tint family (emerald=up,
// red=down/alert, sky=rank moves), flag emoji, bold linked headline, right-aligned score.
// Nested tables + fully inline CSS throughout (no external CSS/JS/fonts/images — email-safe).

export type Locale = 'en' | 'it' | 'es' | 'fr' | 'pt' | 'zh' | 'de';
export const LOCALES: ReadonlySet<string> = new Set(['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']);

/** Validate an arbitrary input against the supported locale set; falls back to 'en'. */
export function safeLocale(x: unknown): Locale {
  return typeof x === 'string' && LOCALES.has(x) ? (x as Locale) : 'en';
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const rec = (en: string, it: string, es: string, fr: string, pt: string, zh: string, de: string): Record<Locale, string> => ({
  en, it, es, fr, pt, zh, de,
});

// ---------------------------------------------------------------------------
// Confirmation email
// ---------------------------------------------------------------------------

export const CONFIRM_SUBJECT: Record<Locale, string> = rec(
  'Confirm your IsItSafeToTravel subscription',
  'Conferma la tua iscrizione a IsItSafeToTravel',
  'Confirma tu suscripción a IsItSafeToTravel',
  "Confirmez votre abonnement à IsItSafeToTravel",
  'Confirme a sua inscrição no IsItSafeToTravel',
  '确认您在 IsItSafeToTravel 的订阅',
  'Bestätige dein IsItSafeToTravel-Abonnement',
);

const CONFIRM_HEADING = rec(
  'One last step', 'Un ultimo passaggio', 'Un último paso', 'Une dernière étape',
  'Um último passo', '最后一步', 'Ein letzter Schritt',
);

const CONFIRM_BODY = rec(
  "Please confirm you want daily travel-safety updates from IsItSafeToTravel. If this wasn't you, just ignore this email.",
  'Conferma di voler ricevere gli aggiornamenti quotidiani sulla sicurezza di viaggio da IsItSafeToTravel. Se non sei stato tu, ignora questa email.',
  'Confirma que deseas recibir las actualizaciones diarias sobre seguridad de viaje de IsItSafeToTravel. Si no has sido tú, simplemente ignora este correo.',
  "Merci de confirmer que vous souhaitez recevoir les mises à jour quotidiennes sur la sécurité des voyages d'IsItSafeToTravel. Si ce n'était pas vous, ignorez simplement cet e-mail.",
  'Confirme que deseja receber as atualizações diárias sobre segurança de viagem do IsItSafeToTravel. Se não foi você, basta ignorar este e-mail.',
  '请确认您希望收到 IsItSafeToTravel 的每日旅行安全更新。如果这不是您本人的操作,请忽略此邮件。',
  'Bitte bestätige, dass du tägliche Reisesicherheits-Updates von IsItSafeToTravel erhalten möchtest. Falls du das nicht warst, ignoriere einfach diese E-Mail.',
);

const CONFIRM_BUTTON = rec(
  'Confirm subscription', 'Conferma iscrizione', 'Confirmar suscripción', "Confirmer l'abonnement",
  'Confirmar inscrição', '确认订阅', 'Abonnement bestätigen',
);

// Legal §3c: sender identity + "this is not marketing" line, required on the confirmation email.
const CONFIRM_FOOTER = rec(
  "You're receiving this because someone entered this address on isitsafetotravel.org. No emails are sent until you confirm. — Sent by the operator of isitsafetotravel.org · Contact: Riccardo.Dominici1999@gmail.com · This is not marketing.",
  "Ricevi questo messaggio perché questo indirizzo è stato inserito su isitsafetotravel.org. Nessuna email viene inviata prima della conferma. — Inviata dal gestore di isitsafetotravel.org · Contatto: Riccardo.Dominici1999@gmail.com · Non è materiale promozionale.",
  'Recibes este mensaje porque alguien introdujo esta dirección en isitsafetotravel.org. No se envía ningún correo hasta que confirmes. — Enviado por el operador de isitsafetotravel.org · Contacto: Riccardo.Dominici1999@gmail.com · Esto no es marketing.',
  "Vous recevez cet e-mail car quelqu'un a saisi cette adresse sur isitsafetotravel.org. Aucun e-mail n'est envoyé tant que vous n'avez pas confirmé. — Envoyé par l'opérateur d'isitsafetotravel.org · Contact : Riccardo.Dominici1999@gmail.com · Ceci n'est pas un e-mail marketing.",
  'Recebe esta mensagem porque este endereço foi inserido em isitsafetotravel.org. Nenhum e-mail é enviado antes da confirmação. — Enviado pelo operador do isitsafetotravel.org · Contacto: Riccardo.Dominici1999@gmail.com · Isto não é marketing.',
  '您收到此邮件是因为有人在 isitsafetotravel.org 上输入了此邮箱地址。在您确认之前不会发送任何邮件。— 发件人:isitsafetotravel.org 运营者 · 联系方式:Riccardo.Dominici1999@gmail.com · 这不是营销邮件。',
  'Du erhältst diese E-Mail, weil jemand diese Adresse auf isitsafetotravel.org eingegeben hat. Es werden keine E-Mails gesendet, bevor du bestätigst. — Gesendet vom Betreiber von isitsafetotravel.org · Kontakt: Riccardo.Dominici1999@gmail.com · Dies ist keine Werbung.',
);

// ---------------------------------------------------------------------------
// Shared email chrome — brand header, bulletproof button, sand/white card shell
// ---------------------------------------------------------------------------

const FONT_STACK = "'DM Sans','Segoe UI',Arial,sans-serif";
const SAND_50 = '#F7F4EE';
const SAND_100 = '#EFEAE0';
const SAND_500 = '#8C7F6E';
const SAND_600 = '#6B5F52';
const SAND_800 = '#362F29';
const TERRACOTTA_500 = '#c96b4f';

/** Hidden preheader: shows next to the subject in inbox lists, invisible in the body. */
function preheaderHtml(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${SAND_50};opacity:0;">${escapeHtml(text)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`;
}

/**
 * Full email document: sand-50 page background, centered 600px white card, brand wordmark
 * header (🌍 IsItSafeToTravel), nested-table body. `bodyRowsHtml` must be a sequence of <tr>s.
 */
function emailShell(locale: Locale, preheader: string, bodyRowsHtml: string): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>IsItSafeToTravel</title>
</head>
<body style="margin:0;padding:0;background:${SAND_50};font-family:${FONT_STACK};">
${preheaderHtml(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SAND_50};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td align="center" style="padding:0 0 20px;">
<span style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:${SAND_800};">🌍 IsItSafeToTravel</span>
</td></tr>
<tr><td style="background:#ffffff;border-radius:14px;padding:32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${bodyRowsHtml}
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Bulletproof CTA button: VML roundrect for Outlook desktop, plain padded <a> everywhere else. */
function emailButton(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="16%" stroke="f" fillcolor="${TERRACOTTA_500}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${safeUrl}" target="_blank" style="display:inline-block;background:${TERRACOTTA_500};color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;">${safeLabel}</a>
<!--<![endif]-->`;
}

export function confirmEmailHtml(locale: Locale, confirmUrl: string): string {
  const rows = `
<tr><td style="padding:0 0 14px;">
<h1 style="margin:0;font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${SAND_800};">${escapeHtml(CONFIRM_HEADING[locale])}</h1>
</td></tr>
<tr><td style="padding:0 0 24px;">
<p style="margin:0;font-family:${FONT_STACK};color:${SAND_600};font-size:15px;line-height:1.6;">${escapeHtml(CONFIRM_BODY[locale])}</p>
</td></tr>
<tr><td align="center" style="padding:0 0 14px;">
${emailButton(CONFIRM_BUTTON[locale], confirmUrl)}
</td></tr>
<tr><td align="center" style="padding:0 0 28px;">
<p style="margin:0;font-family:${FONT_STACK};color:${SAND_500};font-size:12px;word-break:break-all;">${escapeHtml(confirmUrl)}</p>
</td></tr>
<tr><td style="border-top:1px solid ${SAND_100};padding-top:20px;">
<p style="margin:0;font-family:${FONT_STACK};color:${SAND_500};font-size:12px;line-height:1.6;">${escapeHtml(CONFIRM_FOOTER[locale])}</p>
</td></tr>`;
  return emailShell(locale, `${CONFIRM_HEADING[locale]} — ${CONFIRM_SUBJECT[locale]}`, rows);
}

// ---------------------------------------------------------------------------
// Inline noindex HTML result pages (no-JS form fallback, confirm/unsubscribe results)
// ---------------------------------------------------------------------------

const BACK_TO_SITE = rec(
  'Back to isitsafetotravel.org', 'Torna a isitsafetotravel.org', 'Volver a isitsafetotravel.org',
  'Retour à isitsafetotravel.org', 'Voltar a isitsafetotravel.org', '返回 isitsafetotravel.org',
  'Zurück zu isitsafetotravel.org',
);

/** Minimal, dependency-free page shell for /api/* inline responses. Always noindex. */
function pageShell(locale: Locale, cardInnerHtml: string): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IsItSafeToTravel</title>
<style>
  body{font-family:'DM Sans','Segoe UI',Arial,sans-serif;background:${SAND_50};color:${SAND_800};margin:0;padding:40px 20px;display:flex;justify-content:center;}
  .wrap{max-width:420px;width:100%;}
  .wordmark{display:block;text-align:center;font-weight:700;font-size:18px;color:${SAND_800};margin-bottom:16px;}
  .card{background:#fff;border-radius:14px;padding:36px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);text-align:center;}
  a.back{color:${TERRACOTTA_500};text-decoration:none;font-weight:700;}
  p{line-height:1.6;margin:0 0 20px;font-size:15px;}
</style>
</head>
<body>
  <div class="wrap">
    <div class="wordmark">🌍 IsItSafeToTravel</div>
    <div class="card">${cardInnerHtml}
    </div>
  </div>
</body>
</html>`;
}

function page(locale: Locale, message: string): string {
  return pageShell(
    locale,
    `
      <p>${escapeHtml(message)}</p>
      <a class="back" href="https://isitsafetotravel.org/${locale}/">${escapeHtml(BACK_TO_SITE[locale])}</a>`,
  );
}

const CHECK_INBOX_TEXT = rec(
  'Almost there — check your inbox and click the confirmation link to finish subscribing.',
  "Ci siamo quasi: controlla la tua casella di posta e clicca sul link di conferma per completare l'iscrizione.",
  'Ya casi está — revisa tu bandeja de entrada y haz clic en el enlace de confirmación para completar la suscripción.',
  'Presque terminé — vérifiez votre boîte de réception et cliquez sur le lien de confirmation pour terminer votre abonnement.',
  'Quase lá — verifique a sua caixa de entrada e clique no link de confirmação para concluir a inscrição.',
  '只差一步 — 请查看您的收件箱并点击确认链接以完成订阅。',
  'Fast geschafft — überprüfe dein Postfach und klicke auf den Bestätigungslink, um das Abonnement abzuschließen.',
);

const ALREADY_CONFIRMED_TEXT = rec(
  "You're already subscribed. You'll get travel-safety updates whenever something notable changes.",
  "Sei già iscritto. Riceverai gli aggiornamenti sulla sicurezza di viaggio quando qualcosa di rilevante cambia.",
  'Ya estás suscrito. Recibirás actualizaciones sobre seguridad de viaje cuando algo relevante cambie.',
  'Vous êtes déjà abonné. Vous recevrez des mises à jour sur la sécurité des voyages en cas de changement notable.',
  'Já está inscrito. Vai receber atualizações sobre segurança de viagem sempre que algo relevante mudar.',
  '您已订阅。当有重要变化时,我们会向您发送旅行安全更新。',
  'Du bist bereits abonniert. Du erhältst Reisesicherheits-Updates, sobald sich etwas Wesentliches ändert.',
);

const CONFIRM_SUCCESS_TEXT = rec(
  "You're subscribed. You'll get travel-safety updates whenever something notable changes.",
  'Iscrizione confermata. Riceverai gli aggiornamenti sulla sicurezza di viaggio quando qualcosa di rilevante cambia.',
  'Suscripción confirmada. Recibirás actualizaciones sobre seguridad de viaje cuando algo relevante cambie.',
  'Abonnement confirmé. Vous recevrez des mises à jour sur la sécurité des voyages en cas de changement notable.',
  'Inscrição confirmada. Vai receber atualizações sobre segurança de viagem sempre que algo relevante mudar.',
  '订阅已确认。当有重要变化时,我们会向您发送旅行安全更新。',
  'Abonnement bestätigt. Du erhältst Reisesicherheits-Updates, sobald sich etwas Wesentliches ändert.',
);

const CONFIRM_ERROR_TEXT = rec(
  'This confirmation link is invalid or has expired.',
  'Questo link di conferma non è valido o è scaduto.',
  'Este enlace de confirmación no es válido o ha caducado.',
  "Ce lien de confirmation n'est pas valide ou a expiré.",
  'Este link de confirmação é inválido ou expirou.',
  '此确认链接无效或已过期。',
  'Dieser Bestätigungslink ist ungültig oder abgelaufen.',
);

const UNSUB_SUCCESS_TEXT = rec(
  "You've been unsubscribed. You won't receive any more emails from us.",
  'Iscrizione annullata. Non riceverai più email da noi.',
  'Te has dado de baja. No recibirás más correos nuestros.',
  "Vous avez été désabonné. Vous ne recevrez plus d'e-mails de notre part.",
  'A sua inscrição foi cancelada. Não vai receber mais e-mails nossos.',
  '您已取消订阅。您将不会再收到我们的邮件。',
  'Du wurdest abgemeldet. Du erhältst keine weiteren E-Mails mehr von uns.',
);

const UNSUB_CONFIRM_TEXT = rec(
  'Do you want to stop receiving the daily travel-safety updates at this address?',
  'Vuoi smettere di ricevere gli aggiornamenti quotidiani sulla sicurezza di viaggio a questo indirizzo?',
  '¿Quieres dejar de recibir las actualizaciones diarias sobre seguridad de viaje en esta dirección?',
  'Voulez-vous ne plus recevoir les mises à jour quotidiennes sur la sécurité des voyages à cette adresse ?',
  'Quer deixar de receber as atualizações diárias sobre segurança de viagem neste endereço?',
  '您想停止在此邮箱接收每日旅行安全更新吗?',
  'Möchtest du keine täglichen Reisesicherheits-Updates mehr an diese Adresse erhalten?',
);

const UNSUB_CONFIRM_BUTTON = rec(
  'Yes, unsubscribe me', 'Sì, annulla la mia iscrizione', 'Sí, darme de baja', 'Oui, me désabonner',
  'Sim, cancelar a inscrição', '是的,取消订阅', 'Ja, abmelden',
);

const UNSUB_ERROR_TEXT = rec(
  'This unsubscribe link is invalid or has already been used.',
  'Questo link di annullamento non è valido o è già stato utilizzato.',
  'Este enlace de baja no es válido o ya se ha utilizado.',
  'Ce lien de désabonnement n\'est pas valide ou a déjà été utilisé.',
  'Este link de cancelamento é inválido ou já foi utilizado.',
  '此取消订阅链接无效或已被使用。',
  'Dieser Abmeldelink ist ungültig oder wurde bereits verwendet.',
);

export const checkInboxHtml = (locale: Locale) => page(locale, CHECK_INBOX_TEXT[locale]);
export const alreadyConfirmedHtml = (locale: Locale) => page(locale, ALREADY_CONFIRMED_TEXT[locale]);
export const confirmResultHtml = (locale: Locale, success: boolean) =>
  page(locale, success ? CONFIRM_SUCCESS_TEXT[locale] : CONFIRM_ERROR_TEXT[locale]);
export const unsubResultHtml = (locale: Locale, success: boolean) =>
  page(locale, success ? UNSUB_SUCCESS_TEXT[locale] : UNSUB_ERROR_TEXT[locale]);

/**
 * GET /api/unsubscribe confirmation page: shows a POST form instead of unsubscribing
 * directly — a GET that mutates state gets triggered by antispam link scanners
 * (learned the hard way on day one). Real one-click stays on POST per RFC 8058.
 */
export function unsubConfirmHtml(locale: Locale, actionUrl: string): string {
  return pageShell(
    locale,
    `
      <p>${escapeHtml(UNSUB_CONFIRM_TEXT[locale])}</p>
      <form method="POST" action="${escapeHtml(actionUrl)}" style="margin:0 0 20px;">
        <button type="submit" style="background:${TERRACOTTA_500};color:#fff;border:0;border-radius:8px;padding:13px 28px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;">${escapeHtml(UNSUB_CONFIRM_BUTTON[locale])}</button>
      </form>
      <a class="back" href="https://isitsafetotravel.org/${locale}/">${escapeHtml(BACK_TO_SITE[locale])}</a>`,
  );
}

// ---------------------------------------------------------------------------
// Error strings for subscribe.ts's respErr()
// ---------------------------------------------------------------------------

export type ErrorReason =
  | 'invalid_email' | 'rate' | 'unavailable'
  | 'unsupported_media_type' | 'origin_mismatch' | 'body_too_large' | 'invalid_json';

const ERROR_INVALID_EMAIL = rec(
  "That doesn't look like a valid email address.",
  "L'indirizzo email non sembra valido.",
  'Esa dirección de correo no parece válida.',
  'Cette adresse e-mail ne semble pas valide.',
  'Este endereço de e-mail não parece válido.',
  '该邮箱地址似乎无效。',
  'Diese E-Mail-Adresse scheint ungültig zu sein.',
);

const ERROR_RATE = rec(
  'Too many attempts — please try again later.',
  'Troppi tentativi, riprova più tardi.',
  'Demasiados intentos: inténtalo de nuevo más tarde.',
  'Trop de tentatives — veuillez réessayer plus tard.',
  'Demasiadas tentativas — tente novamente mais tarde.',
  '尝试次数过多,请稍后再试。',
  'Zu viele Versuche — bitte versuche es später erneut.',
);

const ERROR_UNAVAILABLE = rec(
  'Subscriptions are temporarily unavailable. Please try again soon.',
  'Le iscrizioni non sono momentaneamente disponibili. Riprova a breve.',
  'Las suscripciones no están disponibles temporalmente. Inténtalo de nuevo pronto.',
  'Les abonnements sont temporairement indisponibles. Veuillez réessayer bientôt.',
  'As inscrições estão temporariamente indisponíveis. Tente novamente em breve.',
  '订阅功能暂时不可用,请稍后再试。',
  'Abonnements sind vorübergehend nicht verfügbar. Bitte versuche es bald erneut.',
);

const ERROR_GENERIC = rec(
  'Something went wrong. Please try again.',
  'Qualcosa è andato storto. Riprova.',
  'Algo salió mal. Inténtalo de nuevo.',
  "Une erreur s'est produite. Veuillez réessayer.",
  'Algo correu mal. Tente novamente.',
  '出现问题,请重试。',
  'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
);

const ERROR_TEXT: Record<ErrorReason, Record<Locale, string>> = {
  invalid_email: ERROR_INVALID_EMAIL,
  rate: ERROR_RATE,
  unavailable: ERROR_UNAVAILABLE,
  unsupported_media_type: ERROR_GENERIC,
  origin_mismatch: ERROR_GENERIC,
  body_too_large: ERROR_GENERIC,
  invalid_json: ERROR_GENERIC,
};

export function errorMessage(locale: Locale, reason: ErrorReason): string {
  return (ERROR_TEXT[reason] ?? ERROR_GENERIC)[locale];
}

export const errorHtml = (locale: Locale, reason: ErrorReason) => page(locale, errorMessage(locale, reason));

// ---------------------------------------------------------------------------
// Digest — fallback subject + wrapper (used when src/lib/news-digest.ts is absent)
// ---------------------------------------------------------------------------

const DIGEST_SUBJECT_TEMPLATE = rec(
  'Travel-safety news — {n} update(s) today',
  'Sicurezza di viaggio — {n} aggiornamenti oggi',
  'Noticias de seguridad de viaje — {n} actualización(es) hoy',
  'Actualités sécurité des voyages — {n} mise(s) à jour aujourd\'hui',
  'Notícias de segurança de viagem — {n} atualização(ões) hoje',
  '旅行安全资讯 — 今日 {n} 项更新',
  'Reisesicherheits-News — {n} Update(s) heute',
);

export function digestSubjectFallback(locale: Locale, n: number): string {
  return (DIGEST_SUBJECT_TEMPLATE[locale] ?? DIGEST_SUBJECT_TEMPLATE.en).replace('{n}', String(n));
}

const DIGEST_HEADER = rec(
  "Today's travel-safety changes",
  "I cambiamenti di oggi sulla sicurezza di viaggio",
  'Los cambios de hoy en seguridad de viaje',
  'Les changements du jour en matière de sécurité des voyages',
  'As alterações de hoje na segurança de viagem',
  '今日旅行安全变化',
  'Die heutigen Änderungen bei der Reisesicherheit',
);

// Legal §3c recurring-digest footer: sender identity + "never share your address" + unsubscribe.
const DIGEST_FOOTER = rec(
  'You receive this because you confirmed a subscription at isitsafetotravel.org. Sent by the operator of isitsafetotravel.org (Italy) · Riccardo.Dominici1999@gmail.com · We never share your address.',
  "Ricevi questa email perché hai confermato un'iscrizione su isitsafetotravel.org. Inviata dal gestore di isitsafetotravel.org (Italia) · Riccardo.Dominici1999@gmail.com · Non condividiamo mai il tuo indirizzo.",
  'Recibes este correo porque confirmaste una suscripción en isitsafetotravel.org. Enviado por el operador de isitsafetotravel.org (Italia) · Riccardo.Dominici1999@gmail.com · Nunca compartimos tu dirección.',
  'Vous recevez cet e-mail car vous avez confirmé un abonnement sur isitsafetotravel.org. Envoyé par l\'opérateur d\'isitsafetotravel.org (Italie) · Riccardo.Dominici1999@gmail.com · Nous ne partageons jamais votre adresse.',
  'Recebe este e-mail porque confirmou uma inscrição em isitsafetotravel.org. Enviado pelo operador do isitsafetotravel.org (Itália) · Riccardo.Dominici1999@gmail.com · Nunca partilhamos o seu endereço.',
  '您收到此邮件是因为您在 isitsafetotravel.org 确认了订阅。发件人:isitsafetotravel.org 运营者(意大利)· Riccardo.Dominici1999@gmail.com · 我们绝不会分享您的邮箱地址。',
  'Du erhältst diese E-Mail, weil du ein Abonnement auf isitsafetotravel.org bestätigt hast. Gesendet vom Betreiber von isitsafetotravel.org (Italien) · Riccardo.Dominici1999@gmail.com · Wir geben deine Adresse niemals weiter.',
);

const UNSUBSCRIBE_LABEL = rec(
  'Unsubscribe', 'Annulla iscrizione', 'Cancelar suscripción', 'Se désabonner',
  'Cancelar inscrição', '取消订阅', 'Abmelden',
);

const VIEW_ALL_LABEL = rec(
  'View all updates', 'Vedi tutti gli aggiornamenti', 'Ver todas las actualizaciones',
  'Voir toutes les mises à jour', 'Ver todas as atualizações', '查看所有更新', 'Alle Updates ansehen',
);

// ---------------------------------------------------------------------------
// Digest — per-event card (email-safe lite rendition of the site's B6 NewsCard: tinted
// background by sentiment, flag + bold linked headline, muted detail, right-aligned score)
// ---------------------------------------------------------------------------

export type CardSentiment = 'up' | 'down' | 'info';

const SENTIMENT_COLORS: Record<CardSentiment, { bg: string; border: string; text: string }> = {
  up: { bg: '#ecfdf5', border: '#10b981', text: '#047857' }, // emerald
  down: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' }, // red
  info: { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1' }, // sky
};

export interface EventCardOptions {
  url: string;
  flag: string | null;
  headline: string;
  detail: string;
  sentiment: CardSentiment;
  scoreText?: string;
}

/** One event, styled as a tinted card with the headline as a clickable link to the country page. */
export function eventCardHtml(opts: EventCardOptions): string {
  const c = SENTIMENT_COLORS[opts.sentiment];
  const flagHtml = opts.flag ? `${opts.flag} ` : '';
  const scoreHtml = opts.scoreText
    ? `<td valign="top" align="right" style="padding:14px 14px 14px 8px;white-space:nowrap;"><span style="font-family:${FONT_STACK};font-weight:700;font-size:17px;color:${c.text};">${escapeHtml(opts.scoreText)}</span></td>`
    : '';
  return `
<tr><td style="padding:0 0 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-radius:10px;background:${c.bg};border-left:4px solid ${c.border};">
<tr>
<td style="padding:14px 8px 14px 14px;">
<a href="${escapeHtml(opts.url)}" target="_blank" style="color:${SAND_800};text-decoration:none;font-weight:700;font-size:15px;line-height:1.4;font-family:${FONT_STACK};">${flagHtml}${escapeHtml(opts.headline)}</a>
<div style="margin-top:4px;color:${SAND_600};font-size:13px;line-height:1.5;">${escapeHtml(opts.detail)}</div>
</td>
${scoreHtml}
</tr>
</table>
</td></tr>`;
}

/** Header + date + event cards (pre-rendered by the caller) + "view all" CTA + footer. */
export function wrapperHtml(
  locale: Locale,
  cardsHtml: string,
  unsubUrl: string,
  viewAllUrl: string,
  dateLabel: string,
): string {
  const rows = `
<tr><td style="padding:0 0 4px;">
<h1 style="margin:0;font-family:${FONT_STACK};font-size:21px;font-weight:700;color:${SAND_800};">${escapeHtml(DIGEST_HEADER[locale])}</h1>
</td></tr>
<tr><td style="padding:0 0 20px;">
<p style="margin:0;font-family:${FONT_STACK};color:${SAND_500};font-size:13px;">${escapeHtml(dateLabel)}</p>
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cardsHtml}
</table>
</td></tr>
<tr><td align="center" style="padding:12px 0 28px;">
${emailButton(VIEW_ALL_LABEL[locale], viewAllUrl)}
</td></tr>
<tr><td style="border-top:1px solid ${SAND_100};padding-top:20px;">
<p style="margin:0;font-family:${FONT_STACK};color:${SAND_500};font-size:12px;line-height:1.6;">
${escapeHtml(DIGEST_FOOTER[locale])}
<br><a href="${escapeHtml(unsubUrl)}" style="color:${TERRACOTTA_500};">${escapeHtml(UNSUBSCRIBE_LABEL[locale])}</a>
</p>
</td></tr>`;
  return emailShell(locale, `${DIGEST_HEADER[locale]} — ${dateLabel}`, rows);
}
