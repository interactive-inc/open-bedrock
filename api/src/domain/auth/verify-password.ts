import { toPasswordHash } from "@/domain/auth/to-password-hash"

// 平文パスワードを既存ハッシュと突き合わせて一致を判定する純粋関数。
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  const computedHash = await toPasswordHash(plainPassword)

  return computedHash === passwordHash
}
