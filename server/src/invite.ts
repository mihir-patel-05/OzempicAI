/** Owner-only CLI: npm run invite -- person@example.com (never a public route). */
import { hashToken, isEmail, newToken } from './auth.js'
import { pool } from './db.js'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase() ?? ''
  if (!isEmail(email)) throw new Error('Usage: npm run invite -- person@example.com')
  const appUrl = new URL(process.env.APP_URL ?? '')
  if (appUrl.protocol !== 'https:' && !(appUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname))) {
    throw new Error('APP_URL must use HTTPS (or HTTP on localhost for development)')
  }
  const token = newToken()
  await pool.query(
    `insert into auth.signup_invitations(token_hash,email,expires_at)
     values($1,$2,now()+interval '7 days')`,
    [hashToken(token), email],
  )
  const link = new URL('/login', appUrl)
  link.hash = new URLSearchParams({ invite: token, email }).toString()
  // This command is intentionally interactive: treat the resulting link as
  // a credential and give it only to the intended person over a trusted channel.
  console.log(`Single-use invitation for ${email}, valid for 7 days:\n${link}`)
}
main().catch(err => { console.error(err instanceof Error ? err.message : 'Invitation failed'); process.exitCode = 1 })
  .finally(() => pool.end())
