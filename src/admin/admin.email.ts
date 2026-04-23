import nodemailer from 'nodemailer';
import escape from "escape-html";
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWorkspaceDeletedEmail(params: {
  toEmail:       string;
  toName:        string;
  workspaceName: string;
  reason?:       string;
  hardDelete:    boolean;
}): Promise<void> {
  const { toEmail, toName, workspaceName, reason, hardDelete } = params;
  const safeName = escape(toName);
const safeWorkspace = escape(workspaceName);
const safeReason = reason ? escape(reason) : "";

  const subject = hardDelete
    ? `Your workspace "${safeWorkspace}" has been permanently deleted`
    : `Your workspace "${safeWorkspace}" has been suspended`;

  const body = hardDelete
    ? `
      <p>Hi ${safeName},</p>
      <p>Your Focura workspace <strong>${safeWorkspace}</strong> has been permanently deleted by our admin team.</p>
      ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ''}
      <p>All data associated with this workspace has been removed and cannot be recovered.</p>
      <p>If you believe this was a mistake, please contact support.</p>
      <p>— The Focura Team</p>
    `
    : `
      <p>Hi ${safeName},</p>
      <p>Your Focura workspace <strong>${safeWorkspace}</strong> has been suspended by our admin team.</p>
      ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ''}
      <p>If you believe this was a mistake, please contact support.</p>
      <p>— The Focura Team</p>
    `;

  await transporter.sendMail({
    from:    `"Focura" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to:      toEmail,
    subject,
    html:    body,
  });
}

export async function sendBanEmail(params: {
  toEmail:  string;
  toName:   string;
  reason:   string;
}): Promise<void> {
  const { toEmail, toName, reason } = params;
  const safeName = escape(toName);
const safeReason = reason ? escape(reason) : "";

  await transporter.sendMail({
    from:    `"Focura" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: 'Your Focura account has been suspended',
    html: `
      <p>Hi ${safeName},</p>
      <p>Your Focura account has been suspended by our admin team.</p>
      <p><strong>Reason:</strong> ${safeReason}</p>
      <p>If you believe this was a mistake, please contact support.</p>
      <p>— The Focura Team</p>
    `,
  });
}