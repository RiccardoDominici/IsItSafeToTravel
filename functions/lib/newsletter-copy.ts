// functions/lib/newsletter-copy.ts — shared localized copy + inline HTML builders for the
// mailing-list Functions (subscribe/confirm/unsubscribe) and the digest script.
// Kept dependency-free of src/i18n/ui.ts on purpose: functions/ is a separate edge runtime and
// the house style (see functions/api/vote.ts, feedback.ts) does not import from src/.
// Styling mirrors functions/api/feedback.ts's inline email aesthetic (terracotta #c96b4f, sand
// background #f9f6f3, system font stack).

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
  "You're receiving this because someone entered this address on isitsafetotravel.org. No emails are sent until you confirm. — Sent by Riccardo Dominici, operator of isitsafetotravel.org · Contact: Riccardo.Dominici1999@gmail.com · This is not marketing.",
  "Ricevi questo messaggio perché questo indirizzo è stato inserito su isitsafetotravel.org. Nessuna email viene inviata prima della conferma. — Inviata da Riccardo Dominici, gestore di isitsafetotravel.org · Contatto: Riccardo.Dominici1999@gmail.com · Non è materiale promozionale.",
  'Recibes este mensaje porque alguien introdujo esta dirección en isitsafetotravel.org. No se envía ningún correo hasta que confirmes. — Enviado por Riccardo Dominici, operador de isitsafetotravel.org · Contacto: Riccardo.Dominici1999@gmail.com · Esto no es marketing.',
  "Vous recevez cet e-mail car quelqu'un a saisi cette adresse sur isitsafetotravel.org. Aucun e-mail n'est envoyé tant que vous n'avez pas confirmé. — Envoyé par Riccardo Dominici, opérateur d'isitsafetotravel.org · Contact : Riccardo.Dominici1999@gmail.com · Ceci n'est pas un e-mail marketing.",
  'Recebe esta mensagem porque este endereço foi inserido em isitsafetotravel.org. Nenhum e-mail é enviado antes da confirmação. — Enviado por Riccardo Dominici, operador do isitsafetotravel.org · Contacto: Riccardo.Dominici1999@gmail.com · Isto não é marketing.',
  '您收到此邮件是因为有人在 isitsafetotravel.org 上输入了此邮箱地址。在您确认之前不会发送任何邮件。— 发件人:Riccardo Dominici,isitsafetotravel.org 运营者 · 联系方式:Riccardo.Dominici1999@gmail.com · 这不是营销邮件。',
  'Du erhältst diese E-Mail, weil jemand diese Adresse auf isitsafetotravel.org eingegeben hat. Es werden keine E-Mails gesendet, bevor du bestätigst. — Gesendet von Riccardo Dominici, Betreiber von isitsafetotravel.org · Kontakt: Riccardo.Dominici1999@gmail.com · Dies ist keine Werbung.',
);

/** Base email chrome: sand/terracotta card, matches feedback.ts's inline aesthetic. */
function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f9f6f3; border-radius: 12px; padding: 28px;">
        ${bodyHtml}
      </div>
    </div>`;
}

function emailButton(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#c96b4f; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">${escapeHtml(label)}</a>`;
}

export function confirmEmailHtml(locale: Locale, confirmUrl: string): string {
  return emailShell(`
    <h2 style="color:#1a1a1a; margin:0 0 12px;">${escapeHtml(CONFIRM_HEADING[locale])}</h2>
    <p style="color:#333; line-height:1.6; margin:0;">${escapeHtml(CONFIRM_BODY[locale])}</p>
    ${emailButton(CONFIRM_BUTTON[locale], confirmUrl)}
    <p style="margin-top:28px; color:#999; font-size:12px; line-height:1.6;">${escapeHtml(CONFIRM_FOOTER[locale])}</p>
  `);
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
function page(locale: Locale, message: string): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IsItSafeToTravel</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f6f3;color:#1a1a1a;margin:0;padding:40px 20px;display:flex;justify-content:center;}
  .card{max-width:480px;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);text-align:center;}
  a{color:#c96b4f;text-decoration:none;font-weight:600;}
  p{line-height:1.6;}
</style>
</head>
<body>
  <div class="card">
    <p>${escapeHtml(message)}</p>
    <a href="https://isitsafetotravel.org/${locale}/">${escapeHtml(BACK_TO_SITE[locale])}</a>
  </div>
</body>
</html>`;
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
  'You receive this because you confirmed a subscription at isitsafetotravel.org. Sent by Riccardo Dominici (Italy), operator of isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · We never share your address.',
  "Ricevi questa email perché hai confermato un'iscrizione su isitsafetotravel.org. Inviata da Riccardo Dominici (Italia), gestore di isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Non condividiamo mai il tuo indirizzo.",
  'Recibes este correo porque confirmaste una suscripción en isitsafetotravel.org. Enviado por Riccardo Dominici (Italia), operador de isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Nunca compartimos tu dirección.',
  'Vous recevez cet e-mail car vous avez confirmé un abonnement sur isitsafetotravel.org. Envoyé par Riccardo Dominici (Italie), opérateur d\'isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Nous ne partageons jamais votre adresse.',
  'Recebe este e-mail porque confirmou uma inscrição em isitsafetotravel.org. Enviado por Riccardo Dominici (Itália), operador do isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Nunca partilhamos o seu endereço.',
  '您收到此邮件是因为您在 isitsafetotravel.org 确认了订阅。发件人:Riccardo Dominici(意大利),isitsafetotravel.org 运营者 · Riccardo.Dominici1999@gmail.com · 我们绝不会分享您的邮箱地址。',
  'Du erhältst diese E-Mail, weil du ein Abonnement auf isitsafetotravel.org bestätigt hast. Gesendet von Riccardo Dominici (Italien), Betreiber von isitsafetotravel.org · Riccardo.Dominici1999@gmail.com · Wir geben deine Adresse niemals weiter.',
);

const UNSUBSCRIBE_LABEL = rec(
  'Unsubscribe', 'Annulla iscrizione', 'Cancelar suscripción', 'Se désabonner',
  'Cancelar inscrição', '取消订阅', 'Abmelden',
);

/** Header + rows (pre-rendered by the caller) + footer, ready to send. */
export function wrapperHtml(locale: Locale, rowsHtml: string, unsubUrl: string): string {
  return emailShell(`
    <h2 style="color:#1a1a1a; margin:0 0 16px;">${escapeHtml(DIGEST_HEADER[locale])}</h2>
    <table style="width:100%; border-collapse:collapse;">${rowsHtml}</table>
    <p style="margin-top:28px; color:#999; font-size:12px; line-height:1.6;">
      ${escapeHtml(DIGEST_FOOTER[locale])}
      <br><a href="${escapeHtml(unsubUrl)}" style="color:#c96b4f;">${escapeHtml(UNSUBSCRIBE_LABEL[locale])}</a>
    </p>
  `);
}
