import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  const e = env();
  if (!e.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

/**
 * Send an email via SMTP. Without SMTP configured, development prints the
 * message to the console so flows like password reset stay testable; in
 * production it logs a warning (without the message body) instead.
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  const t = getTransport();
  if (t) {
    await t.sendMail({ from: env().EMAIL_FROM, ...msg });
    return;
  }
  if (env().NODE_ENV === "production") {
    console.warn("[email] SMTP is not configured; an email could not be sent.");
    return;
  }
  if (env().NODE_ENV === "test") return;
  console.info(`\n[email:dev] To: ${msg.to}\n[email:dev] Subject: ${msg.subject}\n${msg.text}\n`);
}
