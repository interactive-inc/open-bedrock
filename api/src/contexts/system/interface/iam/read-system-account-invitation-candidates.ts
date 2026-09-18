export type SystemAccountInvitationCandidate = Readonly<{
  id: string
  token: string
  email: string | null
  roleId: string
  resourceType: string | null
  resourceId: string | null
  relatedResourceId: string | null
  usedBy: string | null
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}>

type InvitationRow = Readonly<{
  id: string
  token: string
  subject: string | null
  role_id: string
  resource_type: string | null
  resource_id: string | null
  related_resource_id: string | null
  accepted_by_account_id: string | null
  expires_at: number
  revoked_at: number | null
  created_at: number
  updated_at: number
}>

/** 保存されたtokenの候補をSystemの公開読み取り境界から取得する。照合方針は呼び出し側が決める。 */
export async function readSystemAccountInvitationCandidates(
  database: D1Database,
  storedTokens: ReadonlyArray<string>,
): Promise<ReadonlyArray<SystemAccountInvitationCandidate> | Error> {
  const tokens = [...new Set(storedTokens)]
  if (
    tokens.length < 1 ||
    tokens.length > 2 ||
    tokens.some((token) => token.length < 1 || token.length > 255)
  ) {
    return new Error("Invalid System account invitation token candidates")
  }

  try {
    const placeholders = tokens.map((_, index) => `?${index + 1}`).join(", ")
    const rows = await database
      .prepare(
        `SELECT id, token, subject, role_id, resource_type, resource_id, related_resource_id,
                accepted_by_account_id, expires_at, revoked_at, created_at, updated_at
         FROM system_account_invitations WHERE token IN (${placeholders}) ORDER BY id`,
      )
      .bind(...tokens)
      .all<InvitationRow>()
    if (!rows.success) return new Error("System account invitation lookup failed")
    if (
      rows.results.some(
        (row) =>
          !Number.isSafeInteger(row.expires_at) ||
          (row.revoked_at !== null && !Number.isSafeInteger(row.revoked_at)) ||
          !Number.isSafeInteger(row.created_at) ||
          !Number.isSafeInteger(row.updated_at),
      )
    ) {
      return new Error("System account invitation has invalid timestamps")
    }

    return rows.results.map((row) => ({
      id: row.id,
      token: row.token,
      email: row.subject,
      roleId: row.role_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      relatedResourceId: row.related_resource_id,
      usedBy: row.accepted_by_account_id,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System account invitation lookup failed")
  }
}
