import 'server-only';

import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// ----------------------------------------------------------------------

let client: Resend | undefined;

export function getEmailSender() {
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    const email = process.env.GMAIL_USER?.trim();
    return email ? `E-KRU Marketplace <${email}>` : null;
  }
  return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

export function getEmailReplyTo() {
  return (
    process.env.EMAIL_REPLY_TO?.trim() ||
    (process.env.EMAIL_PROVIDER === 'gmail'
      ? process.env.GMAIL_USER?.trim()
      : process.env.RESEND_REPLY_TO_EMAIL?.trim()) ||
    undefined
  );
}

function getResendClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable');
    }

    client = new Resend(apiKey);
  }

  return client;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  if (process.env.EMAIL_PROVIDER === 'gmail') {
    const user = process.env.GMAIL_USER?.trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
    if (!user || !/^[^\s@<>]+@gmail\.com$/i.test(user) || !pass) {
      throw Object.assign(new Error('Missing Gmail configuration'), {
        providerCode: 'gmail_configuration_error',
      });
    }
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({
        from: { name: 'E-KRU Marketplace', address: user },
        to: params.to,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo || getEmailReplyTo() || user,
      });
      if (!result.messageId || !result.accepted?.length || result.rejected?.length) {
        throw new Error('Gmail did not accept the recipient');
      }
    } catch (mailError) {
      const authFailed =
        mailError &&
        typeof mailError === 'object' &&
        'code' in mailError &&
        mailError.code === 'EAUTH';
      throw Object.assign(new Error('Gmail send failed'), {
        providerCode: authFailed ? 'gmail_auth_error' : 'gmail_send_error',
      });
    } finally {
      transport.close();
    }
    return;
  }
  if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== 'resend') {
    throw new Error('Unsupported EMAIL_PROVIDER');
  }
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...((params.replyTo || getEmailReplyTo()) && { replyTo: params.replyTo || getEmailReplyTo() }),
  });

  if (error) {
    throw Object.assign(new Error(error.message), { providerCode: error.name });
  }
  if (!data?.id) throw new Error('Resend did not return a message ID');
}
