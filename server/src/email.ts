/**
 * Password reset email, sent through Resend's HTTP API (https://resend.com).
 *
 * Needs RESEND_API_KEY, EMAIL_FROM (a sender on a domain verified in Resend)
 * and APP_URL (the web app's public origin, used to build the link). When any
 * is missing the request is accepted but no email goes out, and a warning is
 * logged — the reset link itself is never logged.
 */
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '')

  if (!apiKey || !from || !appUrl) {
    console.warn(
      'Password reset requested, but email is not configured ' +
        '(set RESEND_API_KEY, EMAIL_FROM and APP_URL on the api service).',
    )
    return
  }

  const link = `${appUrl}/reset-password#token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    // Never let a slow provider hold the request (or a socket) open.
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your OzempicAI password',
      text:
        `Someone asked to reset the password for your OzempicAI account.\n\n` +
        `Set a new password here (the link works once, for 60 minutes):\n${link}\n\n` +
        `If this wasn't you, you can ignore this email.`,
      html:
        `<p>Someone asked to reset the password for your OzempicAI account.</p>` +
        `<p><a href="${link}">Set a new password</a>. The link works once, for 60 minutes.</p>` +
        `<p>If this wasn't you, you can ignore this email.</p>`,
    }),
  })

  if (!response.ok) {
    console.error('Resend rejected the password reset email', response.status, await response.text())
  }
}
