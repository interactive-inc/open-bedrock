/**
 * API が 401/403 を返したときに throw する例外。
 * Next.js の error boundary は `error.message` を本番でサニタイズするので、`digest` プロパティを
 * 明示的に設定し、`error.tsx` 側はそれで分岐する。
 */
export class AuthError extends Error {
  digest = "AUTH_REQUIRED"

  constructor() {
    super("AUTH_REQUIRED")

    this.name = "AuthError"
  }
}

export function isAuthErrorDigest(digest: string | undefined): boolean {
  return digest === "AUTH_REQUIRED"
}
