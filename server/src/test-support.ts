/** Synthetic invitation fixture; never used by application handlers. */
export async function testInvitation(email: string): Promise<string> {
  if (!process.env.TEST_DATABASE_URL) throw new Error('A disposable test database is required')
  const { pool } = await import('./db.js')
  const { hashToken, newToken } = await import('./auth.js')
  const token = newToken()
  await pool.query(
    `insert into auth.signup_invitations(token_hash,email,expires_at) values($1,$2,now()+interval '1 hour')`,
    [hashToken(token), email.trim().toLowerCase()],
  )
  return token
}
