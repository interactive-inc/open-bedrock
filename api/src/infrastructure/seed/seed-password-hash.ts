import { derivePbkdf2 } from "@/lib/auth/derive-pbkdf2"
import { formatPbkdf2 } from "@/lib/auth/format-pbkdf2"

/** サンプル用パスワード。seed の全ユーザーで共通（実運用では使わない）。 */
const SEED_PLAIN_PASSWORD = "password"

/**
 * seed では再現性のために固定ソルトを使う（dev データのみ・本番ユーザーには適用されない）。
 * 本番のハッシュ生成（toPasswordHash）はユーザー毎にランダムソルトを発行する。
 */
const SEED_SALT = new TextEncoder().encode("seed-salt-open-karte-dev-only")

const SEED_ITERATIONS = 100_000

const SEED_KEY_LENGTH = 32

/**
 * PBKDF2 でハッシュ化したサンプル用ハッシュ。テストや seed SQL から参照する。
 * 平文は "password" 固定。top-level await で起動時に 1 回だけ計算する。
 */
export const seedPasswordHash: string = formatPbkdf2(
  SEED_ITERATIONS,
  SEED_SALT,
  await derivePbkdf2(SEED_PLAIN_PASSWORD, SEED_SALT, SEED_ITERATIONS, SEED_KEY_LENGTH),
)
