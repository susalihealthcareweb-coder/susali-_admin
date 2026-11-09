import nodemailer from "nodemailer";

let transport;
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST);

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function emailHtml({ title, body, link, rows }) {
  const table = rows?.length
    ? `<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">${rows
        .map((r) => `<tr>${r.map((c, i) => `<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;${i ? "text-align:right" : ""}">${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</table>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<div style="background:#0b4633;color:#e1bd6c;padding:16px 24px;font-weight:bold;font-size:18px;letter-spacing:2px;border-bottom:3px solid #c4923a">SUSALI HEALTHCARE</div>
<div style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
<p style="margin:0;line-height:1.5;white-space:pre-line">${esc(body)}</p>${table}
${link ? `<p style="margin-top:20px"><a href="${esc(link)}" style="background:#0b4633;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open SUSALI</a></p>` : ""}
</div><div style="padding:12px 24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">This is an automated message from SUSALI. Please do not reply.</div></div></body></html>`;
}

export async function sendEmail({ to, subject, html, text }) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] Email to ${to}: ${subject}`);
      return "simulated";
    }
    throw new Error("SMTP is not configured");
  }
  const info = await getTransport().sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
  return info.messageId;
}
