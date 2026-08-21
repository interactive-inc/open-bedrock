import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service.repository"

/** サンプル用パスワード。seed の全ユーザーで共通（実運用では使わない）。 */
const SEED_PLAIN_PASSWORD = "password"

/** test/local seed 専用。公開環境の PEPPER_SECRET には使わない。 */
export const seedPepperSecret = "open-bedrock-test-seed-pepper"

/**
 * canonical System の pepper 付き PBKDF2 でハッシュ化したサンプル用ハッシュ。
 * 平文は "password" 固定。起動時に一度だけ生成する。
 */
export const seedPasswordHash = await PasswordHashService.hash(
  SEED_PLAIN_PASSWORD,
  seedPepperSecret,
)
