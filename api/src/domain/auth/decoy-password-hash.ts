import { derivePbkdf2, formatPbkdf2 } from "@/domain/auth/to-password-hash"

// ユーザー列挙のタイミングサイドチャネル対策に使う固定デコイハッシュ（#212）。
// 実在しないメールでのログイン時も、実在ユーザーと同じ PBKDF2 検証コストを払うために
// verifyPassword の照合先として渡す。どの平文とも一致しないため認証は必ず失敗する。
// 反復回数・鍵長は本番ハッシュ（to-password-hash）と揃え、検証コストを一致させる。
const DECOY_ITERATIONS = 100_000

const DECOY_SALT = new TextEncoder().encode("open-karte-decoy-salt-constant")

const DECOY_KEY_LENGTH = 32

export const decoyPasswordHash: string = formatPbkdf2(
  DECOY_ITERATIONS,
  DECOY_SALT,
  await derivePbkdf2(
    "open-karte-decoy-never-matches",
    DECOY_SALT,
    DECOY_ITERATIONS,
    DECOY_KEY_LENGTH,
  ),
)
