import "server-only";
import nodemailer from "nodemailer";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(message: EmailMessage) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.EMAIL_FROM;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
    throw new Error("Configure SMTP_HOST, SMTP_PORT, and EMAIL_FROM to send email.");
  }

  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if ((user && !password) || (!user && password)) {
    throw new Error("Configure both SMTP_USER and SMTP_PASSWORD, or neither.");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    ...(user && password ? { auth: { user, pass: password } } : {}),
  });

  await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
