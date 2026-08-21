import type { AccountId } from "@system/domain/values/account-id.schema"

export type CompanyBootstrapResult = Readonly<{
  employeeId: string | null
  state: "created" | "already_initialized" | "company_exists_without_account_link"
}>

type CompanyBootstrapWrite = Readonly<{
  accountId: AccountId
  employeeCode: string
  employeeName: string
  organizationName: string
  effectiveOn: string
  occurredAt: Date
}>

/** 空のCompanyを、System rootに対応する最初のEmployeeと正規resourceまで原子的に初期化する。 */
export class CompanyBootstrapRepository {
  constructor(private readonly database: D1Database) {
    Object.freeze(this)
  }

  async provision(write: CompanyBootstrapWrite): Promise<CompanyBootstrapResult | Error> {
    const existing = await this.readExisting(write.accountId)
    if (existing instanceof Error || existing !== null) {
      return existing ?? new Error("Company bootstrap state is unavailable")
    }

    const companyExists = await this.hasAnyEmployee()
    if (companyExists instanceof Error) return companyExists
    if (companyExists) {
      return Object.freeze({
        employeeId: null,
        state: "company_exists_without_account_link" as const,
      })
    }

    const subjectId = crypto.randomUUID()
    const employeeId = `employee:${subjectId}`
    const personId = `person:${subjectId}`
    const actionId = `bootstrap:employee:${employeeId}`
    const employmentPeriodId = `bootstrap:employment:${employeeId}`
    const commandId = `bootstrap:${write.accountId}`
    const recordedAt = write.occurredAt.getTime()
    const actorAccountId = `account:${write.accountId}`
    const resources = [
      {
        type: "legal-entity",
        id: "legal-entity:default",
        attributes: { officialName: write.organizationName },
      },
      {
        type: "company-profile",
        id: "company-profile:default",
        attributes: { displayName: write.organizationName },
      },
      {
        type: "person",
        id: personId,
        attributes: { officialName: write.employeeName, phone: null },
      },
      {
        type: "employee",
        id: employeeId,
        attributes: {
          personId,
          employeeCode: write.employeeCode,
          status: "active",
        },
      },
      {
        type: "employment",
        id: `employment:${employmentPeriodId}`,
        attributes: { employeeId, status: "active" },
      },
      {
        type: "organization-unit",
        id: "company:root:initial",
        attributes: {
          organizationUnitId: "company:root",
          code: "COMPANY",
          officialName: write.organizationName,
          kind: "COMPANY",
          parentOrganizationUnitId: null,
        },
      },
      {
        type: "account-employee-link",
        id: `link:${write.accountId}`,
        attributes: { accountId: write.accountId, employeeId },
      },
      {
        type: "personnel-action",
        id: actionId,
        attributes: {
          actionType: "initial_state",
          employeeId,
          sourceType: "system",
          correctsActionId: null,
          summary: {
            kind: "initial_state",
            eventOn: write.effectiveOn,
            department: null,
            positionTitle: null,
            managerEmployeeCode: null,
            status: "active",
          },
        },
      },
    ] as const

    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO company_account_profiles
             (organization_id, account_id, display_name, created_at, updated_at)
           VALUES ('organization:default', ?1, ?2, ?3, ?3)`,
        )
        .bind(write.accountId, write.employeeName, recordedAt),
      this.database
        .prepare(
          `INSERT INTO company_command_receipts
             (organization_id, command_id, fingerprint, expected_revision,
              organization_revision, recorded_at)
           VALUES ('organization:default', ?1, ?2, 0, 1, ?3)`,
        )
        .bind(commandId, "0".repeat(64), recordedAt),
    ]

    for (const resource of resources) {
      const attributesJson = JSON.stringify(resource.attributes)
      statements.push(
        this.database
          .prepare(
            `INSERT INTO company_resource_revisions
               (organization_id, resource_type, resource_id, revision, organization_revision,
                state, effective_from, effective_to, attributes_json, command_id,
                actor_account_id, reason, recorded_at)
             VALUES ('organization:default', ?1, ?2, 1, 1, 'active', ?3, NULL, ?4,
                     ?5, ?6, 'Initialize Company', ?7)`,
          )
          .bind(
            resource.type,
            resource.id,
            write.effectiveOn,
            attributesJson,
            commandId,
            actorAccountId,
            recordedAt,
          ),
        this.database
          .prepare(
            `INSERT INTO company_resource_heads
               (organization_id, resource_type, resource_id, revision, organization_revision,
                state, effective_from, effective_to, attributes_json, updated_at)
             VALUES ('organization:default', ?1, ?2, 1, 1, 'active', ?3, NULL, ?4, ?5)`,
          )
          .bind(resource.type, resource.id, write.effectiveOn, attributesJson, recordedAt),
      )
    }

    statements.push(
      this.database
        .prepare(
          `UPDATE company_organizations
           SET revision = 1, name = ?1, representative_name = ?2, updated_at = ?3
           WHERE id = 'organization:default' AND revision = 0`,
        )
        .bind(write.organizationName, write.employeeName, recordedAt),
    )

    try {
      const results = await this.database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("Company bootstrap batch did not succeed")
      }
    } catch (cause) {
      const raced = await this.readExisting(write.accountId)
      if (raced instanceof Error || raced !== null) {
        return raced ?? new Error("Company bootstrap state is unavailable")
      }
      return cause instanceof Error ? cause : new Error("Company bootstrap failed")
    }

    return Object.freeze({ employeeId, state: "created" as const })
  }

  private async readExisting(accountId: string): Promise<CompanyBootstrapResult | null | Error> {
    try {
      const employeeId = await this.database
        .prepare(
          `SELECT json_extract(attributes_json, '$.employeeId') AS employee_id
           FROM company_resource_heads
           WHERE organization_id = 'organization:default'
             AND resource_type = 'account-employee-link'
             AND state = 'active'
             AND json_extract(attributes_json, '$.accountId') = ?1
           LIMIT 1`,
        )
        .bind(accountId)
        .first<string>("employee_id")
      return employeeId === null
        ? null
        : Object.freeze({ employeeId, state: "already_initialized" as const })
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company bootstrap state")
    }
  }

  private async hasAnyEmployee(): Promise<boolean | Error> {
    try {
      return (
        (await this.database
          .prepare(
            `SELECT resource_id
             FROM company_resource_heads
             WHERE organization_id = 'organization:default'
               AND resource_type = 'employee'
               AND state = 'active'
             LIMIT 1`,
          )
          .first<string>("resource_id")) !== null
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read Company Employee state")
    }
  }
}
