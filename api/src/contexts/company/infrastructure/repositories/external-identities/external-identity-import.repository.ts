import type {
  ExternalIdentityImportEntity,
  ExternalIdentityImportItem,
} from "@/contexts/company/domain/entities/external-identity-import.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CompanyWorkforceResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-workforce-resource-projection.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  SystemMachineOperationAuthorizationAdapter,
  type SystemMachineOperationActor,
} from "@system/infrastructure/adapters/iam/system-machine-operation-authorization.adapter"
import { SystemAccountProvisioningAdapter } from "@system/infrastructure/adapters/identity/system-account-provisioning.adapter"
import { SystemIdentityAttachmentAdapter } from "@system/infrastructure/adapters/identity/system-identity-attachment.adapter"
import { SystemIdentityByEmailAdapter } from "@system/infrastructure/adapters/identity/system-identity-by-email.adapter"
import { SystemProvisionedIdentityAdapter } from "@system/infrastructure/adapters/identity/system-provisioned-identity.adapter"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"

const organizationId = "organization:default"
const summarySchema = z
  .object({
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  })
  .strict()
type Summary = z.output<typeof summarySchema>
type Failure =
  | Readonly<{ kind: "conflict"; reason: string }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "invalid"; reason: string }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>
export type ExternalIdentityImportResult =
  | Failure
  | Readonly<{
      kind: "applied"
      summary: Summary
      organizationRevision: number
      replayed: boolean
    }>
type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
type PreparedItem = Readonly<{
  kind: "prepared"
  outcome: "created" | "updated" | "skipped"
  resources: ReadonlyArray<CompanyResourceProps>
  before: ReadonlyArray<D1PreparedStatement>
  after: ReadonlyArray<D1PreparedStatement>
}>
type ItemContext = Readonly<{
  input: ExternalIdentityImportItem
  command: ExternalIdentityImportEntity
  actor: SystemMachineOperationActor
  now: Date
  effectiveOn: CalendarDate
}>
type Source = Readonly<{ source_revision: number; source_digest: string; organization_id: string }>

/** 外部の版、Companyの版、System identity、公開人事正本、監査を一つの同期として確定する。 */
export class ExternalIdentityImportRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async apply(
    command: ExternalIdentityImportEntity,
    actor: SystemMachineOperationActor,
    now: Date,
  ): Promise<ExternalIdentityImportResult> {
    try {
      const effectiveOn = resolveCompanyBusinessDate({
        now: now.toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (effectiveOn instanceof Error) return { kind: "unavailable", cause: effectiveOn }
      const authorization = await new SystemMachineOperationAuthorizationAdapter(this.c).prepare({
        actor,
        resource: { type: "system:identity_provider", id: "oidc" },
        permissions: ["account:manage", "employee:write", "iam:write"],
        now,
      })
      if (authorization instanceof Error) return { kind: "unavailable", cause: authorization }
      if (authorization === "forbidden") return { kind: "forbidden" }
      const fingerprint = await command.fingerprint(actor.accountId)
      if (fingerprint instanceof Error) return { kind: "unavailable", cause: fingerprint }
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      if ((await this.revision()) !== command.props.expectedRevision)
        return { kind: "conflict", reason: "organization_revision" }
      const prepared: PreparedItem[] = []
      for (const input of command.props.identities) {
        const item = await this.prepareItem({ input, command, actor, now, effectiveOn })
        if (item.kind !== "prepared") return item
        prepared.push(item)
      }
      const resources = prepared.flatMap((item) => item.resources)
      const summary = { created: 0, updated: 0, skipped: 0 }
      for (const item of prepared) summary[item.outcome] += 1
      const statements: D1PreparedStatement[] = [
        ...authorization,
        ...prepared.flatMap((item) => item.before),
      ]
      const database = this.c.env.DB
      if (resources.length > 0) {
        const change = CompanyResourceChangeEntity.create({
          commandId: `external-identity:${command.props.commandId}`,
          expectedRevision: command.props.expectedRevision,
          actorAccountId: actor.accountId,
          reason: command.props.reason,
          recordedAt: now.getTime(),
          resources,
        })
        if (change instanceof Error) return { kind: "invalid", reason: "resources" }
        const journal = await new CompanyResourceJournalAdapter({
          database: drizzle(database),
          d1: database,
        }).prepare(change)
        if (journal instanceof Error) return { kind: "unavailable", cause: journal }
        const projection = await new CompanyWorkforceResourceProjectionAdapter(database).prepare(
          change,
          journal.fingerprint,
        )
        if (projection instanceof Error) return { kind: "unavailable", cause: projection }
        statements.push(
          ...journal.statements,
          ...projection,
          ...prepared.flatMap((item) => item.after),
          ...authorization,
          journal.commit,
        )
      } else {
        statements.push(
          ...prepared.flatMap((item) => item.after),
          ...authorization,
          database
            .prepare(
              "UPDATE company_organizations SET revision = revision + 1, updated_at = ?2 WHERE id = ?1 AND revision = ?3",
            )
            .bind(organizationId, now.getTime(), command.props.expectedRevision),
        )
      }
      statements.push(
        database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
      )
      statements.push(
        database
          .prepare(`INSERT INTO company_external_identity_imports
        (organization_id, command_id, fingerprint, organization_revision, result_json, recorded_at,
          actor_account_id, machine_credential_id, reason, expected_revision)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
          .bind(
            organizationId,
            command.props.commandId,
            fingerprint,
            command.props.expectedRevision + 1,
            JSON.stringify(summary),
            now.getTime(),
            actor.accountId,
            actor.credentialId,
            command.props.reason,
            command.props.expectedRevision,
          ),
      )
      try {
        const written = await database.batch(statements)
        if (written.length !== statements.length || written.some((part) => !part.success))
          return { kind: "unavailable", cause: new Error("external import batch failed") }
      } catch (cause) {
        const concurrentReplay = await this.replay(command.props.commandId, fingerprint)
        if (concurrentReplay !== null) return concurrentReplay
        if ((await this.revision()) !== command.props.expectedRevision)
          return { kind: "conflict", reason: "organization_revision" }
        return { kind: "unavailable", cause }
      }
      return {
        kind: "applied",
        summary,
        organizationRevision: command.props.expectedRevision + 1,
        replayed: false,
      }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }

  private async prepareItem(context: ItemContext): Promise<PreparedItem | Failure> {
    const input = context.input
    const identityAdapter = new SystemProvisionedIdentityAdapter(this.c)
    const current = await identityAdapter.find("oidc", input.subject)
    if (current instanceof Error) return { kind: "unavailable", cause: current }
    if (
      current !== null &&
      (current.accountStatus !== "active" ||
        current.activatedAt === null ||
        current.activatedAt > context.now.getTime() ||
        current.revokedAt !== null ||
        (current.principalKind !== null && current.principalKind !== "human"))
    ) {
      return { kind: "conflict", reason: "identity_inactive" }
    }
    if (current !== null && input.accountId !== null && input.accountId !== current.accountId)
      return { kind: "conflict", reason: "identity_owner" }
    const canonical = CanonicalSystemJsonValue.create({
      subject: input.subject,
      email: input.email,
      name: input.name,
      accountId: input.accountId,
      initialRoleId: input.initialRoleId,
      newEmployee: input.newEmployee,
    })
    if (canonical instanceof Error) return { kind: "invalid", reason: "identity" }
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return { kind: "unavailable", cause: digest }
    const source =
      current === null
        ? null
        : await this.c.env.DB.prepare(
            "SELECT source_revision, source_digest, organization_id FROM company_external_identity_sources WHERE identity_id = ?1",
          )
            .bind(current.identityId)
            .first<Source>()
    if (source !== null && source.organization_id !== organizationId) return { kind: "forbidden" }
    if (source !== null && input.sourceRevision <= source.source_revision) {
      if (
        input.sourceRevision === source.source_revision &&
        digest.toString() === source.source_digest
      ) {
        return { kind: "prepared", outcome: "skipped", resources: [], before: [], after: [] }
      }
      return { kind: "conflict", reason: "source_revision" }
    }
    if (current === null && input.accountId === null)
      return this.prepareNew(context, digest.toString())

    const accountId = current?.accountId ?? input.accountId
    if (accountId === null) return { kind: "invalid", reason: "account" }
    const account = await new SystemAccountRepository({ database: this.c.env.DB }).find(accountId)
    if (account instanceof Error) return { kind: "unavailable", cause: account }
    if (account === null || account.status !== "active")
      return { kind: "conflict", reason: "account_inactive" }
    const principal = await new SystemPrincipalRepository(this.c).find({ accountId })
    if (principal instanceof Error) return { kind: "unavailable", cause: principal }
    if (principal !== null && principal.kind !== "human") return { kind: "forbidden" }
    const link = await this.c.env.DB.prepare(`SELECT binding.resource_id AS employee_id,
      json_extract(employee.attributes_json, '$.personId') AS person_id
      FROM company_account_employee_links link
      JOIN company_workforce_resource_bindings binding ON binding.employee_id = link.employee_id AND binding.resource_type = 'employee'
      JOIN company_resource_heads employee ON employee.organization_id = binding.organization_id
        AND employee.resource_type = 'employee' AND employee.resource_id = binding.resource_id AND employee.state = 'active'
      WHERE link.account_id = ?1 AND binding.organization_id = ?2`)
      .bind(accountId, organizationId)
      .first<{ employee_id: string; person_id: string }>()
    if (link === null) return { kind: "conflict", reason: "unbound_workforce" }
    const people = await new D1CompanyResourceRepository(this.c.env.DB).findMany({
      organizationId,
      types: ["person"],
      ids: [link.person_id],
    })
    if (!people.ok) return { kind: "unavailable", cause: people.cause }
    const person = people.resources[0]
    if (
      person === undefined ||
      person.effectiveFrom > context.effectiveOn ||
      (person.effectiveTo !== null && person.effectiveTo <= context.effectiveOn)
    )
      return { kind: "conflict", reason: "person_period" }
    const before: D1PreparedStatement[] = [
      identityAdapter.prepareTargetGuard(accountId, account.tokenVersion),
    ]
    const attachment =
      current === null
        ? new SystemIdentityAttachmentAdapter(this.c).prepare({
            actorAccountId: context.actor.accountId,
            accountId,
            provider: "oidc",
            subject: input.subject,
            email: input.email,
            now: context.now,
          })
        : null
    if (attachment instanceof Error) return { kind: "unavailable", cause: attachment }
    const identityId = current?.identityId ?? attachment?.identityId
    if (identityId === undefined) return { kind: "invalid", reason: "identity" }
    if (attachment !== null) before.push(...attachment.statements)
    if (current !== null)
      before.push(
        ...identityAdapter.prepareUpdate({ current, email: input.email, now: context.now }),
      )
    const resources: CompanyResourceProps[] = []
    if (
      person.readText("officialName") !== input.name ||
      person.readNullableText("email") !== input.email
    ) {
      resources.push({
        organizationId,
        type: "person",
        id: person.id,
        revision: person.revision + 1,
        state: "active",
        effectiveFrom: context.effectiveOn,
        effectiveTo: person.effectiveTo,
        attributes: { ...person.attributes, officialName: input.name, email: input.email },
      })
    }
    const audit = this.audit(context, identityId, current?.email ?? null)
    if (audit instanceof Error) return { kind: "unavailable", cause: audit }
    return {
      kind: "prepared",
      outcome: current === null ? "created" : "updated",
      resources,
      before,
      after: [
        ...this.sourceStatements(
          identityId,
          input.sourceRevision,
          digest.toString(),
          source?.source_revision ?? null,
          context.now,
        ),
        ...audit,
      ],
    }
  }

  private async prepareNew(
    context: ItemContext,
    sourceDigest: string,
  ): Promise<PreparedItem | Failure> {
    const input = context.input
    if (input.newEmployee === null || input.initialRoleId === null)
      return { kind: "invalid", reason: "employment_and_role_required" }
    const existingEmail = await new SystemIdentityByEmailAdapter(this.c).execute(input.email)
    if (existingEmail instanceof Error) return { kind: "unavailable", cause: existingEmail }
    if (existingEmail !== null)
      return { kind: "conflict", reason: "explicit_account_link_required" }
    const roles = await new SystemRoleCatalogRepository(this.c).findMany()
    if (roles instanceof Error) return { kind: "unavailable", cause: roles }
    const role = roles.find(
      (candidate) => candidate.id === input.initialRoleId && candidate.resourceType === null,
    )
    if (role === undefined) return { kind: "invalid", reason: "initial_role" }
    const canGrant = await new SystemAccountProvisioningAdapter(this.c).canGrantInitialRole(
      context.actor.accountId,
      role,
      context.now,
    )
    if (canGrant instanceof Error) return { kind: "unavailable", cause: canGrant }
    if (!canGrant) return { kind: "forbidden" }
    const account = new SystemAccountProvisioningAdapter(this.c).prepare({
      actorAccountId: context.actor.accountId,
      provider: "oidc",
      subject: input.subject,
      email: input.email,
      passwordHash: null,
      roleId: role.id,
      now: context.now,
    })
    if (account instanceof Error) return { kind: "unavailable", cause: account }
    const employeeId = crypto.randomUUID()
    const employmentId = crypto.randomUUID()
    const personId = `person:${employeeId}`
    const effectiveFrom = restoreCalendarDate(input.newEmployee.hireDate)
    const resources: CompanyResourceProps[] = [
      {
        organizationId,
        type: "person",
        id: personId,
        revision: 1,
        state: "active",
        effectiveFrom,
        effectiveTo: null,
        attributes: { officialName: input.name, email: input.email, phone: null },
      },
      {
        organizationId,
        type: "employee",
        id: employeeId,
        revision: 1,
        state: "active",
        effectiveFrom,
        effectiveTo: null,
        attributes: { personId, employeeCode: null },
      },
      {
        organizationId,
        type: "employment",
        id: employmentId,
        revision: 1,
        state: "active",
        effectiveFrom,
        effectiveTo: null,
        attributes: {
          employeeId,
          employmentType: input.newEmployee.employmentType,
          status: "ACTIVE",
        },
      },
    ]
    const audit = this.audit(context, account.identityId, null)
    if (audit instanceof Error) return { kind: "unavailable", cause: audit }
    return {
      kind: "prepared",
      outcome: "created",
      resources,
      before: [account.accountStatement, ...account.identityStatements],
      after: [
        this.c.env.DB.prepare(
          "INSERT INTO company_account_employee_links (account_id, employee_id) VALUES (?1, ?2)",
        ).bind(account.accountId, employeeId),
        this.c.env.DB.prepare(`INSERT INTO company_account_profiles
          (organization_id, account_id, display_name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)`).bind(
          organizationId,
          account.accountId,
          input.name,
          context.now.getTime(),
        ),
        ...this.sourceStatements(
          account.identityId,
          input.sourceRevision,
          sourceDigest,
          null,
          context.now,
        ),
        ...audit,
      ],
    }
  }

  private sourceStatements(
    identityId: IdentityId,
    revision: number,
    digest: string,
    previous: number | null,
    now: Date,
  ): ReadonlyArray<D1PreparedStatement> {
    return [
      this.c.env.DB.prepare(`INSERT INTO company_external_identity_sources
      (identity_id, organization_id, source_revision, source_digest, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(identity_id) DO UPDATE SET source_revision = excluded.source_revision,
        source_digest = excluded.source_digest, updated_at = excluded.updated_at
      WHERE company_external_identity_sources.source_revision = ?6 AND company_external_identity_sources.organization_id = ?2`).bind(
        identityId,
        organizationId,
        revision,
        digest,
        now.getTime(),
        previous,
      ),
      this.c.env.DB.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
    ]
  }

  private audit(
    context: ItemContext,
    identityId: IdentityId,
    previousEmail: string | null,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.actor.accountId,
      action: "company.external_identity.imported",
      targetType: "system:identity",
      targetId: identityId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: JSON.stringify({ email: previousEmail }),
      afterJson: JSON.stringify({ email: context.input.email, name: context.input.name }),
      metadataJson: JSON.stringify({
        command_id: context.command.props.commandId,
        source_revision: context.input.sourceRevision,
        machine_credential_id: context.actor.credentialId,
        reason: context.command.props.reason,
      }),
      occurredAt: context.now,
    })
    return event instanceof Error
      ? event
      : new SystemAuditEventRepository(this.c).prepareAppend(event)
  }

  private async revision(): Promise<number | null> {
    return this.c.env.DB.prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
  }

  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<ExternalIdentityImportResult | null> {
    const receipt = await this.c.env.DB.prepare(
      "SELECT fingerprint, organization_revision, result_json FROM company_external_identity_imports WHERE organization_id = ?1 AND command_id = ?2",
    )
      .bind(organizationId, commandId)
      .first<{ fingerprint: string; organization_revision: number; result_json: string }>()
    if (receipt === null) return null
    if (receipt.fingerprint !== fingerprint) return { kind: "conflict", reason: "command_id" }
    return {
      kind: "applied",
      summary: summarySchema.parse(JSON.parse(receipt.result_json)),
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }
}
