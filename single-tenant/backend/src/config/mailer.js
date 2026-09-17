import nodemailer from "nodemailer";
import { env } from "./env.js";

const SECURE_SMTP_PORT = 465;
const DEFAULT_FROM_ADDRESS = '"Mova Support" <noreply@mova_app.com>';

let transporter = null;

export async function createEtherealTransporter() {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

export const getMailTransporter = async () => {
  if (transporter) return transporter;

  if (env.SMTP?.HOST) {
    try {
      transporter = nodemailer.createTransport({
        host: env.SMTP.HOST,
        port: env.SMTP.PORT,
        secure: env.SMTP.PORT === SECURE_SMTP_PORT,
        auth: {
          user: env.SMTP.USER,
          pass: env.SMTP.PASS,
        },
      });
    } catch (err) {
      console.warn(`⚠️ Gagal inisialisasi SMTP: ${err.message}. Beralih ke Ethereal dinamis...`);
      transporter = await createEtherealTransporter();
    }
  } else {
    transporter = await createEtherealTransporter();
  }

  return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
  try {
    let mailer = await getMailTransporter();
    const fromAddress = env.SMTP?.FROM || DEFAULT_FROM_ADDRESS;

    let info;
    try {
      info = await mailer.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text,
      });
    } catch (sendErr) {
      console.warn(`⚠️ Pengiriman via transporter utama gagal (${sendErr.message}), fallback ke Ethereal...`);
      mailer = await createEtherealTransporter();
      transporter = mailer;
      info = await mailer.sendMail({
        from: DEFAULT_FROM_ADDRESS,
        to,
        subject,
        html,
        text,
      });
    }

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("🔗 Preview email (Ethereal):", previewUrl);
    }

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || null,
    };
  } catch (err) {
    console.error("❌ Gagal mengirim email:", err.message);
    throw err;
  }
};
