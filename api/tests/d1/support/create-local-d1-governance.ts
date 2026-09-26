import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

async function runAll(database: D1Database, statements: ReadonlyArray<string>): Promise<void> {
  await database.batch(statements.map((statement) => database.prepare(statement)))
}

/**
 * migration済みのローカルD1へ、公開Companyの入社登録と合議体の責務規程を作成する。
 * Company側のfixtureと同じ手順を、互換ラッパーを使わずに組み立てる。
 * 業務の手続testは、この合議体を判断資格として案件を作る。
 */
export async function createLocalD1Governance(database: D1Database) {
  const now = new Date()
  const accountId = zAccountId.parse("external-import-service")
  const credentialId = "external-import-credential"
  const hash = await new SystemPrincipalSecretService().hashRawSecret("1".repeat(64))
  if (hash instanceof Error) throw hash
  await runAll(database, [
    `INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at)
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', 0, 'Example organization', 'Example representative', 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}')`,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('external-import-service', 'active', 0, 0, 0)`,
    `INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('external-import-principal', 'external-import-service', 'service', 'Directory synchronization', NULL, 1, 0, 0)`,
    `INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
      VALUES ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'custom:import-global', 'custom', NULL, 'Account grants', 0, 0),
        ('8ca6d30f-174b-40e1-870b-df888721f554', 'custom:import-provider', 'custom', 'system:identity_provider', 'Provider writer', 0, 0),
        ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'custom:import-member', 'custom', NULL, 'Imported member', 0, 0)`,
    `INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'iam:write'), ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'org:read'), ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'employee:read'),
        ('8ca6d30f-174b-40e1-870b-df888721f554', 'account:manage'), ('8ca6d30f-174b-40e1-870b-df888721f554', 'employee:write'),
        ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'org:read'), ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'employee:read')`,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('b63cf0e2-c63e-4834-8bc0-840f72f13aa4', 'external-import-service', 'ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', NULL, NULL, 0, NULL)`,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('721e4694-365f-47cd-8983-0743ec63c76d', 'external-import-service', '8ca6d30f-174b-40e1-870b-df888721f554', 'system:identity_provider', 'oidc', 0, NULL)`,
  ])
  await database
    .prepare(`INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at)
    VALUES (?1, 'external-import-principal', 'Primary', ?2, 'active', 0, 0)`)
    .bind(credentialId, hash)
    .run()
  // 同期主体の機械sessionを正規routeで発行し、Company同期がその発行記録を確認できるようにする。
  const response = await systemFactory
    .createApp()
    .post("/system/machine-sessions", ...POST)
    .request(
      "/system/machine-sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential_id: credentialId, secret: "1".repeat(64) }),
      },
      { DB: database, JWT_SECRET: "local-d1-governance-secret", NOW: now.toISOString() },
    )
  if (response.status !== 201)
    throw new Error(`machine session failed: ${response.status} ${await response.text()}`)
  const organizationRevision = await database
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  if (organizationRevision === null) throw new Error("missing organization")
  const actor = { accountId, tokenVersion: 0, credentialId, issuedAtMs: now.getTime() }
  const applied = await new ApplyExternalIdentities({
    repository: new ExternalIdentityImportRepository({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    }),
    actor,
    now: () => now,
  }).execute({
    commandId: "import:first",
    expectedRevision: organizationRevision,
    reason: "Confirmed directory update",
    identities: [0, 1, 2, 3].map((index) => ({
      subject: `member-${index}`,
      sourceRevision: 1,
      email: `member-${index}@example.com`,
      name: `Member ${index}`,
      accountId: null,
      initialRoleId: iamRoleIdSchema.parse("1f178fc9-9b4d-4247-8dc8-8f1344bf445d"),
      newEmployee: { hireDate: "2026-01-01", employmentType: "PART_TIME" as const },
    })),
  })
  if (applied.kind !== "applied") throw new Error(`identity setup failed: ${applied.kind}`)
  const people = (
    await database
      .prepare(`SELECT employee.id, link.account_id FROM company_employees employee
    JOIN company_account_employee_links link ON link.employee_id = employee.id ORDER BY employee.official_name`)
      .all<{ id: string; account_id: string }>()
  ).results.map((row) => ({
    employeeId: restoreWorkforceId("employee", row.id),
    accountId: zAccountId.parse(row.account_id),
  }))
  const creator = people[0]
  if (creator === undefined) throw new Error("creator fixture is missing")
  const date = resolveCompanyBusinessDate({ now: now.toISOString(), timeZone: "Asia/Tokyo" })
  if (date instanceof Error) throw date
  const base = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    revision: 1,
    effectiveFrom: restoreCalendarDate(date),
    effectiveTo: null,
  }
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      state: "active",
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
    {
      ...base,
      state: "active",
      type: "authority-scope",
      id: "scope:amount",
      attributes: {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1000,
      },
    },
    {
      ...base,
      state: "active",
      type: "collective-body",
      id: "body:committee",
      attributes: {
        code: "COMMITTEE",
        officialName: "Committee",
        quorumType: "count",
        quorumValue: 2,
        decisionRule: "majority",
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility-assignment",
      id: "assignment:approve",
      attributes: {
        responsibilityId: "responsibility:approve",
        holderType: "collective-body",
        holderId: "body:committee",
        authorityScopeId: "scope:amount",
        delegationAllowed: false,
      },
    },
    ...people.slice(1).map(
      (person, index): CompanyResourceProps => ({
        ...base,
        state: "active",
        type: "collective-body-membership",
        id: `membership:${index}`,
        attributes: {
          collectiveBodyId: "body:committee",
          employeeId: person.employeeId,
          role: "member",
          voting: true,
        },
      }),
    ),
  ]
  const write = async (changes: ReadonlyArray<CompanyResourceProps>) => {
    const revision = await database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    if (revision === null) throw new Error("organization is missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: revision,
      actorAccountId: actor.accountId,
      reason: "Update decision policy",
      recordedAt: now.getTime(),
      resources: changes,
    })
    if (change instanceof Error) throw change
    const saved = await new D1CompanyResourceRepository({ database }).write(change)
    if (saved.kind !== "applied")
      throw new Error(`governance setup failed: ${saved.kind}`, { cause: saved })
  }
  await write(resources)
  const accountLinks = await new D1CompanyResourceRepository({ database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["account-employee-link"],
  })
  if (!accountLinks.ok) throw accountLinks.cause
  resources.push(...accountLinks.resources)
  const step: ApplicationWorkflowStep = {
    key: "governance-review",
    name: "Committee review",
    approvers: [],
    approval_mode: "any",
    condition_mode: "all",
    conditions: [],
    due_days: null,
    escalation_approvers: [],
    rejection_behavior: "reject",
    allow_delegation: true,
    governance_authority: {
      organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
      responsibility_code: "APPROVE",
      scope: { scope_type: "amount", currency_code: "JPY", amount_field: "amount" },
    },
  }
  const context: CompanyContext = {
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: now.toISOString() },
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "governance-test",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  return { database, creator, people, resources, write, step, context, at: now }
}
