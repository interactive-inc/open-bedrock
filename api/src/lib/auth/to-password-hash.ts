import { derivePbkdf2 } from "@/lib/auth/derive-pbkdf2"
import { formatPbkdf2 } from "@/lib/auth/format-pbkdf2"

/** PBKDF2 (SHA-256) のパラメータ。Cloudflare Workers の CPU 制限内で十分なコストになる反復回数。 */
const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 16
const KEY_LENGTH = 32

/**
 * 平文パスワードを PBKDF2-SHA256（ユーザー毎のランダムソルト・反復回数同梱）でハッシュ化する。
 * 保存フォーマット: `pbkdf2:<iterations>:<base64(salt)>:<base64(hash)>`（PHC 風、アルゴリズム識別子あり）。
 */
export async function toPasswordHash(plainPassword: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const hash = await derivePbkdf2(plainPassword, salt, PBKDF2_ITERATIONS, KEY_LENGTH)

  return formatPbkdf2(PBKDF2_ITERATIONS, salt, hash)
}
