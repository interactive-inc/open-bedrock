type TestAccountEmployeeLink = Readonly<{
  accountId: string
  employeeId: string
  effectiveFrom: string
  recordedAt: number
}>

/** APIテストの本人対応をCompany公開履歴へ接続する。 */
export async function publishTestAccountEmployeeLink(
  db: D1Database,
  input: TestAccountEmployeeLink,
): Promise<void> {
  const existing = await db
    .prepare(`SELECT account_id, employee_id FROM company_account_employee_resource_bindings
      WHERE account_id = ?1 OR employee_id = ?2`)
    .bind(input.accountId, input.employeeId)
    .all<{ account_id: string; employee_id: string }>()
  if (!existing.success) throw new Error("test Company Account correspondence is unavailable")
  if (existing.results.length > 0) {
    if (
      existing.results.length !== 1 ||
      existing.results[0]?.account_id !== input.accountId ||
      existing.results[0]?.employee_id !== input.employeeId
    ) {
      throw new Error("test Company Account correspondence conflicts with published history")
    }
    return
  }
  const publishedEmployee = await db
    .prepare(`SELECT 1 FROM company_workforce_resource_bindings
      WHERE resource_type = 'employee' AND employee_id = ?1`)
    .bind(input.employeeId)
    .first()
  if (publishedEmployee === null) return
  const organizationRevision = await db
    .prepare(`SELECT revision FROM company_organizations WHERE id = 'organization:default'`)
    .first<number>("revision")
  if (organizationRevision === null || organizationRevision < 1)
    throw new Error("test Company organization is missing")
  const resourceId = `test:${input.accountId}:account-link`
  const attributes = JSON.stringify({ accountId: input.accountId, employeeId: input.employeeId })
  const statements = [
    db
      .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, command_id,
         actor_account_id, reason, recorded_at)
        VALUES ('organization:default', 'account-employee-link', ?1, 1, ?2,
          'active', ?3, NULL, ?4, ?5, 'system:test',
          'Initialize Company test Account correspondence', ?6)`)
      .bind(
        resourceId,
        organizationRevision,
        input.effectiveFrom,
        attributes,
        `test:account-link:${input.accountId}`,
        input.recordedAt,
      ),
    db
      .prepare(`INSERT INTO company_resource_heads
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, updated_at)
        VALUES ('organization:default', 'account-employee-link', ?1, 1, ?2,
          'active', ?3, NULL, ?4, ?5)`)
      .bind(resourceId, organizationRevision, input.effectiveFrom, attributes, input.recordedAt),
    db
      .prepare(`INSERT INTO company_account_employee_resource_bindings
        (resource_id, organization_id, account_id, employee_id, recorded_at)
        VALUES (?1, 'organization:default', ?2, ?3, ?4)`)
      .bind(resourceId, input.accountId, input.employeeId, input.recordedAt),
  ]
  const results = await db.batch(statements)
  if (results.length !== statements.length || results.some((result) => !result.success))
    throw new Error("test Company Account correspondence was not published")
}
