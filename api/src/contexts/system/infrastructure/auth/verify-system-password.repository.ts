import { verifyPassword } from "@system/infrastructure/auth/verify-password.repository"

/** Web Cryptoの失敗をSystem applicationが扱えるError値へ変換する。 */
export async function verifySystemPassword(
  password: string,
  passwordHash: string,
  pepper: string,
): Promise<boolean | Error> {
  try {
    return await verifyPassword(password, passwordHash, pepper)
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to verify password")
  }
}
