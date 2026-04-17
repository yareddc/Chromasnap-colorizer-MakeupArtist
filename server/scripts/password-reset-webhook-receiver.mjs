#!/usr/bin/env node

import crypto from 'crypto';
import express from 'express';

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);

const webhookPath = process.env.PASSWORD_RESET_WEBHOOK_PATH || '/password-reset';
const sharedSecret = (process.env.PASSWORD_RESET_WEBHOOK_SHARED_SECRET || '').trim();
const emailProvider = (process.env.PASSWORD_RESET_EMAIL_PROVIDER || 'auto').trim().toLowerCase();
const dryRun = process.env.PASSWORD_RESET_WEBHOOK_DRY_RUN === 'true';
const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
const sendgridFromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim();
const mailgunApiKey = (process.env.MAILGUN_API_KEY || '').trim();
const mailgunDomain = (process.env.MAILGUN_DOMAIN || '').trim();
const mailgunFromEmail = (process.env.MAILGUN_FROM_EMAIL || '').trim();
const resetLinkTemplate = (process.env.PASSWORD_RESET_LINK_TEMPLATE || '').trim();
const resetLinkFallbackBase = (process.env.PASSWORD_RESET_LINK_BASE_URL || '').trim();

app.use(express.json({ limit: '1mb' }));

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const verifySharedSecret = (req, res, next) => {
  if (!sharedSecret) return next();

  const provided = String(req.header('x-reset-webhook-secret') || '').trim();
  if (!provided || !timingSafeEqual(provided, sharedSecret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

const maskToken = (token) => {
  const value = String(token || '');
  if (value.length < 12) return '***';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const buildResetLink = (token) => {
  if (resetLinkTemplate) {
    return resetLinkTemplate.replace(/\{\{token\}\}/g, encodeURIComponent(token));
  }

  if (resetLinkFallbackBase) {
    const separator = resetLinkFallbackBase.includes('?') ? '&' : '?';
    return `${resetLinkFallbackBase}${separator}token=${encodeURIComponent(token)}`;
  }

  return '';
};

const sendPasswordResetEmail = async ({ username, recoveryEmail, resetToken, expiresAt }) => {
  const expiresAtIso = new Date(expiresAt).toISOString();
  const resetLink = buildResetLink(resetToken);

  const textContent = [
    `Hi ${username},`,
    '',
    'We received a request to reset your ChromaSnap password.',
    resetLink ? `Reset link: ${resetLink}` : `Reset token: ${resetToken}`,
    `Expires at: ${expiresAtIso}`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  const htmlContent = `
    <p>Hi <strong>${username}</strong>,</p>
    <p>We received a request to reset your ChromaSnap password.</p>
    ${resetLink
      ? `<p><a href="${resetLink}">Reset your password</a></p>`
      : `<p><strong>Reset token:</strong> <code>${resetToken}</code></p>`}
    <p><strong>Expires at:</strong> ${expiresAtIso}</p>
    <p>If you did not request this, you can safely ignore this email.</p>
  `.trim();

  const selectedProvider = (() => {
    if (emailProvider === 'sendgrid' || emailProvider === 'mailgun') return emailProvider;
    if (sendgridApiKey && sendgridFromEmail) return 'sendgrid';
    if (mailgunApiKey && mailgunDomain && mailgunFromEmail) return 'mailgun';
    return '';
  })();

  if (!selectedProvider) {
    throw new Error('No email provider configured. Set SendGrid or Mailgun env vars.');
  }

  if (selectedProvider === 'sendgrid') {
    if (dryRun) {
      return {
        provider: selectedProvider,
        usedResetLink: Boolean(resetLink),
        dryRun: true,
      };
    }

    if (!sendgridApiKey || !sendgridFromEmail) {
      throw new Error('SENDGRID_API_KEY and SENDGRID_FROM_EMAIL must be configured for sendgrid provider');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recoveryEmail }] }],
        from: { email: sendgridFromEmail },
        subject: 'ChromaSnap Password Reset',
        content: [
          { type: 'text/plain', value: textContent },
          { type: 'text/html', value: htmlContent },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`SendGrid delivery failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
    }

    return {
      provider: selectedProvider,
      usedResetLink: Boolean(resetLink),
      dryRun: false,
    };
  }

  if (dryRun) {
    return {
      provider: selectedProvider,
      usedResetLink: Boolean(resetLink),
      dryRun: true,
    };
  }

  if (!mailgunApiKey || !mailgunDomain || !mailgunFromEmail) {
    throw new Error('MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL must be configured for mailgun provider');
  }

  const mailgunEndpoint = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
  const basicAuth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
  const form = new URLSearchParams();
  form.set('from', mailgunFromEmail);
  form.set('to', recoveryEmail);
  form.set('subject', 'ChromaSnap Password Reset');
  form.set('text', textContent);
  form.set('html', htmlContent);

  const response = await fetch(mailgunEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Mailgun delivery failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
  }

  return {
    provider: selectedProvider,
    usedResetLink: Boolean(resetLink),
    dryRun: false,
  };
};

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post(webhookPath, verifySharedSecret, async (req, res) => {
  const body = req.body || {};
  const event = String(body.event || '');

  if (event !== 'password_reset_requested') {
    return res.status(400).json({ error: 'Unsupported event type' });
  }

  const username = String(body.username || '').trim();
  const recoveryEmail = String(body.recoveryEmail || '').trim().toLowerCase();
  const resetToken = String(body.resetToken || '').trim();
  const expiresAt = Number(body.expiresAt || 0);

  if (!username || !recoveryEmail || !resetToken || !Number.isFinite(expiresAt)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const result = await sendPasswordResetEmail({
    username,
    recoveryEmail,
    resetToken,
    expiresAt,
  });

  console.log('PASSWORD_RESET_DELIVERY', JSON.stringify({
    username,
    recoveryEmail,
    expiresAt,
    provider: result.provider,
    usedResetLink: result.usedResetLink,
    dryRun: result.dryRun,
    resetTokenPreview: maskToken(resetToken),
  }));

  return res.status(202).json({ accepted: true, provider: result.provider, dryRun: result.dryRun });
});

app.listen(port, () => {
  console.log(`Password reset webhook receiver listening on :${port} path=${webhookPath}`);
});
