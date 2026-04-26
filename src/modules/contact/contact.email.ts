import nodemailer from "nodemailer";
import type { CreateContactMessageInput } from "./contact.validator.js";

// ─── Transporter ──────────────────────────────────────────────────────────────
// Uses the EMAIL_* env vars you already have configured
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

const FROM = process.env.EMAIL_FROM ?? "Focura <focurabusiness@gmail.com>";
const SUPPORT_EMAIL = process.env.EMAIL_SERVER_USER ?? "focurabusiness@gmail.com";

// ─── Category label map ───────────────────────────────────────────────────────
const categoryLabel: Record<string, string> = {
  GENERAL: "General Enquiry",
  BILLING: "Billing & Subscriptions",
  TECHNICAL: "Technical Issue",
  FEATURE_REQUEST: "Feature Request",
  PARTNERSHIP: "Partnership",
  SECURITY: "Security",
  OTHER: "Other",
};

// ─── Template helpers ─────────────────────────────────────────────────────────
function baseWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Focura</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0a0a0a;border-radius:12px 12px 0 0;padding:28px 36px;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Focura
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px;border-radius:0 0 12px 12px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">
                © ${new Date().getFullYear()} Focura · 
                <a href="https://focura-client.vercel.app" style="color:#a3a3a3;">focura-client.vercel.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ─── Admin notification email ─────────────────────────────────────────────────
function buildAdminEmailHtml(
  data: CreateContactMessageInput,
  messageId: string,
  ip: string
): string {
  const content = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#0a0a0a;">
      New Contact Message
    </h2>
    <p style="margin:0 0 24px;font-size:13px;color:#737373;">Message ID: ${messageId}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${[
        ["Name", data.name],
        ["Email", `<a href="mailto:${data.email}" style="color:#0a0a0a;">${data.email}</a>`],
        ["Category", categoryLabel[data.category] ?? data.category],
        ["Subject", data.subject],
        ["IP Address", ip],
      ]
        .map(
          ([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? "#fafafa" : "#ffffff"};">
          <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#737373;white-space:nowrap;border-bottom:1px solid #f0f0f0;width:120px;">
            ${label}
          </td>
          <td style="padding:10px 14px;font-size:13px;color:#0a0a0a;border-bottom:1px solid #f0f0f0;">
            ${value}
          </td>
        </tr>`
        )
        .join("")}
    </table>

    <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#737373;text-transform:uppercase;letter-spacing:0.5px;">
        Message
      </p>
      <p style="margin:0;font-size:14px;color:#0a0a0a;line-height:1.7;white-space:pre-wrap;">${data.message}</p>
    </div>

    <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject)}"
       style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 20px;border-radius:8px;">
      Reply to ${data.name}
    </a>
  `;
  return baseWrapper(content);
}

// ─── User auto-reply email ────────────────────────────────────────────────────
function buildUserAutoReplyHtml(data: CreateContactMessageInput): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0a0a0a;">
      Thanks for reaching out, ${data.name.split(" ")[0]}!
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#525252;line-height:1.7;">
      We received your message and our team will get back to you within
      <strong style="color:#0a0a0a;">2 business days</strong>. In the meantime,
      you can browse our documentation or check the FAQ on our contact page.
    </p>

    <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#737373;text-transform:uppercase;letter-spacing:0.5px;">
        Your message
      </p>
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0a0a0a;">${data.subject}</p>
      <p style="margin:0;font-size:13px;color:#525252;line-height:1.6;white-space:pre-wrap;">${data.message.length > 300 ? data.message.slice(0, 300) + "…" : data.message}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#737373;">Category</p>
          <p style="margin:0;font-size:13px;color:#0a0a0a;">${categoryLabel[data.category] ?? data.category}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;color:#737373;line-height:1.6;">
      If this is urgent, you can also reach us directly at
      <a href="mailto:focurabusiness@gmail.com" style="color:#0a0a0a;font-weight:600;">focurabusiness@gmail.com</a>.
    </p>
    <p style="margin:0;font-size:13px;color:#737373;">
      — The Focura Team
    </p>
  `;
  return baseWrapper(content);
}

// ─── Plain-text fallbacks ─────────────────────────────────────────────────────
function buildAdminEmailText(
  data: CreateContactMessageInput,
  messageId: string,
  ip: string
): string {
  return [
    "NEW CONTACT MESSAGE — FOCURA",
    `Message ID: ${messageId}`,
    "",
    `Name:     ${data.name}`,
    `Email:    ${data.email}`,
    `Category: ${categoryLabel[data.category] ?? data.category}`,
    `Subject:  ${data.subject}`,
    `IP:       ${ip}`,
    "",
    "MESSAGE:",
    data.message,
    "",
    `Reply: mailto:${data.email}`,
  ].join("\n");
}

function buildUserAutoReplyText(data: CreateContactMessageInput): string {
  return [
    `Hi ${data.name.split(" ")[0]},`,
    "",
    "Thanks for reaching out to Focura. We received your message and will reply within 2 business days.",
    "",
    `Subject: ${data.subject}`,
    `Category: ${categoryLabel[data.category] ?? data.category}`,
    "",
    "Your message:",
    data.message.length > 300 ? data.message.slice(0, 300) + "…" : data.message,
    "",
    "If urgent, email us directly at focurabusiness@gmail.com.",
    "",
    "— The Focura Team",
  ].join("\n");
}

// ─── Public send functions ────────────────────────────────────────────────────
/**
 * Sends admin notification email to focurabusiness@gmail.com
 */
export async function sendAdminContactNotification(
  data: CreateContactMessageInput,
  messageId: string,
  ip: string
): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: SUPPORT_EMAIL,
    replyTo: data.email,
    subject: `[Contact] ${categoryLabel[data.category] ?? data.category}: ${data.subject}`,
    text: buildAdminEmailText(data, messageId, ip),
    html: buildAdminEmailHtml(data, messageId, ip),
  });
}

/**
 * Sends auto-reply confirmation to the user who submitted the form
 */
export async function sendUserAutoReply(
  data: CreateContactMessageInput
): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: data.email,
    subject: `We received your message — Focura`,
    text: buildUserAutoReplyText(data),
    html: buildUserAutoReplyHtml(data),
  });
}