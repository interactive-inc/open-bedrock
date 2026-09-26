import { testDerivedId } from "@system/test/system-test-id.test-support"
import { publishTestAccountEmployeeLink } from "@tests/api/support/company/publish-test-account-employee-link"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type TestEmployeeResources = Readonly<{
  employeeId: string
  employmentId: string
  officialName: string
  employeeCode: string | null
  email?: string | null
  employmentType: "FULL_TIME" | "PART_TIME"
  employmentStatus: "ACTIVE" | "ON_LEAVE" | "TERMINATED"
  effectiveFrom: string
  effectiveTo?: string | null
  recordedAt: number
}>

/** APIテストのCompany正本を旧台帳と同じ人物・雇用で初期化する。 */
export async function publishTestEmployeeResources(
  db: D1Database,
  input: TestEmployeeResources,
): Promise<void> {
  const published = await db
    .prepare(
      `SELECT 1 FROM company_workforce_resource_bindings
       WHERE resource_type = 'employee' AND employee_id = ?1 LIMIT 1`,
    )
    .bind(input.employeeId)
    .first()
  if (published !== null) return

  await db
    .prepare(
      `INSERT OR IGNORE INTO company_organizations
       (id, revision, name, representative_name, created_at, updated_at)
       VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 1, 'Example Company', '', 0, 0)`,
    )
    .run()
  await db
    .prepare(
      `UPDATE company_organizations SET revision = 1
       WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND revision = 0`,
    )
    .run()
  const organizationRevision = await db
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  if (organizationRevision === null) throw new Error("test Company organization is missing")

  const personId = testDerivedId("person", input.employeeId)
  const resources = [
    {
      type: "person",
      id: personId,
      attributes: { officialName: input.officialName, email: input.email ?? null, phone: null },
    },
    {
      type: "employee",
      id: input.employeeId,
      attributes: { personId, employeeCode: input.employeeCode },
    },
    {
      type: "employment",
      id: input.employmentId,
      attributes: {
        employeeId: input.employeeId,
        employmentType: input.employmentType,
        officialName: input.officialName,
        status: input.employmentStatus,
      },
    },
  ] as const
  const statements: D1PreparedStatement[] = []
  for (const resource of resources) {
    const attributes = JSON.stringify(resource.attributes)
    statements.push(
      db
        .prepare(
          `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, effective_to, attributes_json, command_id,
            actor_account_id, reason, recorded_at)
           VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, 1, ?3, 'active', ?4, ?5,
                   ?6, ?7, 'system:test', 'Initialize Company test employee', ?8)`,
        )
        .bind(
          resource.type,
          resource.id,
          organizationRevision,
          input.effectiveFrom,
          input.effectiveTo ?? null,
          attributes,
          `test:publish:${input.employeeId}`,
          input.recordedAt,
        ),
      db
        .prepare(
          `INSERT INTO company_resource_heads
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, effective_to, attributes_json, updated_at)
           VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, 1, ?3, 'active', ?4, ?5, ?6, ?7)`,
        )
        .bind(
          resource.type,
          resource.id,
          organizationRevision,
          input.effectiveFrom,
          input.effectiveTo ?? null,
          attributes,
          input.recordedAt,
        ),
    )
  }
  for (const resource of resources.slice(1)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_workforce_resource_bindings
           (resource_type, resource_id, organization_id, employee_id, resource_revision,
            lifecycle_revision, last_action_id)
           VALUES (?1, ?2, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?3, 1, 0, NULL)`,
        )
        .bind(resource.type, resource.id, input.employeeId),
    )
  }
  const results = await db.batch(statements)
  if (results.length !== statements.length || results.some((result) => !result.success)) {
    throw new Error(`test Company employee ${input.employeeId} was not published`)
  }
  const accountLinks = await db
    .prepare(`SELECT account_id FROM company_account_employee_links WHERE employee_id = ?1`)
    .bind(input.employeeId)
    .all<{ account_id: string }>()
  if (!accountLinks.success || accountLinks.results.length > 1)
    throw new Error(`test Company employee ${input.employeeId} has ambiguous Account links`)
  const accountLink = accountLinks.results[0]
  if (accountLink !== undefined) {
    await publishTestAccountEmployeeLink(db, {
      accountId: accountLink.account_id,
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
      recordedAt: input.recordedAt,
    })
  }
}
