import nodemailer from 'nodemailer';

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

  const subject = hardDelete
    ? `Your workspace "${workspaceName}" has been permanently deleted`
    : `Your workspace "${workspaceName}" has been suspended`;

  const body = hardDelete
    ? `
      <p>Hi ${toName},</p>
      <p>Your Focura workspace <strong>${workspaceName}</strong> has been permanently deleted by our admin team.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>All data associated with this workspace has been removed and cannot be recovered.</p>
      <p>If you believe this was a mistake, please contact support.</p>
      <p>— The Focura Team</p>
    `
    : `
      <p>Hi ${toName},</p>
      <p>Your Focura workspace <strong>${workspaceName}</strong> has been suspended by our admin team.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
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

  await transporter.sendMail({
    from:    `"Focura" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: 'Your Focura account has been suspended',
    html: `
      <p>Hi ${toName},</p>
      <p>Your Focura account has been suspended by our admin team.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you believe this was a mistake, please contact support.</p>
      <p>— The Focura Team</p>
    `,
  });
}