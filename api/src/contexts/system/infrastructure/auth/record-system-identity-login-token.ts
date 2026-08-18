import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

/** 外部Identity tokenのjtiを原子的に記録してreplayを検知する。 */
export async function recordSystemIdentityLoginToken(
  context: SystemD1Context,
  input: Readonly<{ jti: string; expiresAt: Date; usedAt: Date }>,
): Promise<"recorded" | "replayed" | Error> {
  try {
    const result = await context.env.DB.prepare(
      `INSERT INTO system_identity_login_tokens (jti, expires_at, used_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(jti) DO NOTHING`,
    )
      .bind(input.jti, input.expiresAt.getTime(), input.usedAt.getTime())
      .run()
    return result.meta.changes > 0 ? "recorded" : "replayed"
  } catch (caught) {
    return caught instanceof Error
      ? caught
      : new Error("failed to record System identity login token")
  }
}
