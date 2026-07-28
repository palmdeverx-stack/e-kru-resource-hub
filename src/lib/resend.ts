import 'server-only';

import { Resend } from 'resend';

// ----------------------------------------------------------------------

let client: Resend | undefined;

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
}): Promise<void> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
