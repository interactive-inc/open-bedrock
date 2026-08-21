import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

/** System Identity profile の email 更新statementを作る。 */
export class PrepareSystemIdentityProfileUpdate {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  prepare(identityId: IdentityId, email: string, updatedAt: Date): D1PreparedStatement {
    return this.context.env.DB.prepare(
      `UPDATE system_identity_profiles
       SET email = ?2, updated_at = max(updated_at + 1, ?3)
       WHERE identity_id = ?1`,
    ).bind(identityId, email, updatedAt.getTime())
  }
}
