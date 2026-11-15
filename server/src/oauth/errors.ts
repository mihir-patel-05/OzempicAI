import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * An OAuth error response (RFC 6749 §5.2, RFC 7591 §3.2.2): sent as
 * `{ error, error_description }` instead of the API's usual `{ error }`.
 */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status: ContentfulStatusCode = 400,
  ) {
    super(description)
  }

  toJSON() {
    return { error: this.error, error_description: this.description }
  }
}
