import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";

let transporter: Transporter | null = null;

export const getMailTransporter = async (): Promise<Transporter | null> => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || env.SMTP?.HOST || "smtp.ethereal.email";
  const port = Number(process.env.SMTP_PORT || env.SMTP?.PORT || 587);
  const user = process.env.SMTP_USER || env.SMTP?.USER || "jarvis.waelchi3@ethereal.email";
  const pass = process.env.SMTP_PASS || env.SMTP?.PASS || "aRJVCCfSEcjTdEAxbQ";

  try {
    if (host && host !== "mock") {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });
      console.log(`📧 Mailer: SMTP terkonfigurasi (${host}:${port} - User: ${user})`);
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`📧 Mailer: Ethereal test account aktif (${testAccount.user})`);
    }
    return transporter;
  } catch (err: any) {
    console.warn(`⚠️ [MAILER INIT WARNING] Gagal menginisialisasi transporter SMTP (${err.message}). Mengaktifkan Mock Console Mailer.`);
    return null;
  }
};

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendMail = async ({ to, subject, html, text }: SendMailOptions) => {
  try {
    const mailer = await getMailTransporter();
    if (mailer) {
      const from = process.env.SMTP_FROM || env.SMTP?.FROM || '"MantaKopi COZIS" <jarvis.waelchi3@ethereal.email>';
      const info = await mailer.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`📧 [MAILER SUCCESS] Email terkirim ke ${to} via SMTP (Message ID: ${info.messageId})`);
      if (previewUrl) {
        console.log(`🌐 [ETHEREAL INBOX PREVIEW]: ${previewUrl}`);
      }
      return {
        messageId: info.messageId,
        previewUrl: previewUrl || null,
      };
    }
  } catch (err: any) {
    console.warn(`⚠️ [MAILER SEND WARNING] SMTP outbound gagal (${err.message}). Mengalihkan ke Mock Console Mailer.`);
    transporter = null;
  }

  // MOCK DEVELOPMENT FALLBACK: Catat ke konsol terminal tanpa melempar error
  console.log("================================================================================");
  console.log(`📬 [MOCK MAILER DEVELOPMENT CONSOLE]`);
  console.log(` Ke      : ${to}`);
  console.log(` Subjek  : ${subject}`);
  if (text) console.log(` Pesan   : ${text}`);
  // Ekstrak URL jika ada di HTML
  const linkMatch = html.match(/href="([^"]+)"/);
  if (linkMatch) {
    console.log(` 🔗 Tautan Aksi: ${linkMatch[1]}`);
  }
  console.log("================================================================================");

  return {
    messageId: `mock-${Date.now()}`,
    previewUrl: null,
    mocked: true,
  };
};
