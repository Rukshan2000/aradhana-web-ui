import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_FROM_NAME = 'Guest Book',
  SMTP_FROM_EMAIL,
} = process.env;

// Mail is optional at boot: the API still serves everything else if SMTP is
// unconfigured, and only the code-based auth routes report it as unavailable.
export const mailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // 587 upgrades via STARTTLS instead
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })
  : null;

if (!mailEnabled) {
  console.warn('SMTP is not configured — sign-in codes and password resets are disabled.');
}

const FROM = `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL || SMTP_USER}>`;

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) throw Object.assign(new Error('email is not configured on this server'), { status: 503 });
  return transporter.sendMail({ from: FROM, to, subject, text, html });
}

/** The one email both code flows send — only the wording around it differs. */
export function codeEmail({ name, code, minutes, purpose }) {
  const heading = purpose === 'login' ? 'Your sign-in code' : 'Reset your password';
  const lede =
    purpose === 'login'
      ? 'Use this code to sign in to the Guest Book portal.'
      : 'Use this code to choose a new password for your Guest Book account.';

  return {
    subject: `${code} — ${heading}`,
    text: `Hi ${name},\n\n${lede}\n\n${code}\n\nThis code expires in ${minutes} minutes and can be used once.\nIf you did not request it, you can ignore this email — nothing has changed.\n\n— Guest Book`,
    html: `
<div style="margin:0;padding:32px 16px;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#22201d">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ece5da;border-radius:16px;padding:32px">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a08c6b">Guest Book</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5b544c">Hi ${name}, ${lede}</p>
    <p style="margin:0 0 24px;padding:18px;background:#faf7f2;border:1px solid #ece5da;border-radius:12px;text-align:center;font-size:32px;font-weight:600;letter-spacing:.28em">${code}</p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8a8078">This code expires in ${minutes} minutes and can be used once.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8078">If you did not request it, you can ignore this email — nothing has changed.</p>
  </div>
</div>`,
  };
}
