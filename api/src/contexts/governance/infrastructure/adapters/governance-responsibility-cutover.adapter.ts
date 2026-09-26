import { openCompanyResponsibilitySourceLedger } from "@/contexts/company/interface/operations/open-company-responsibility-source-ledger"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import {
  governanceResponsibilityCutoverReceiptSchema,
  governanceResponsibilityManifestEntrySchema,
} from "@/contexts/governance/domain/schemas/governance-responsibility-cutover.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const governanceResponsibilitySource = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  sourceContext: "governance",
  sourceKind: "org-role-assignment",
} as const

type Audit = Readonly<{ eventId: string; statements: ReadonlyArray<D1PreparedStatement> }>
type Context = Readonly<{
  database: D1Database
  now?: string | number
  sourceNamespace?: string
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.migration_completed"
    targetType: "governance_org_role"
    targetId: string
    metadata: Readonly<Record<string, string | number>>
  }) => Audit
}>

export type GovernanceResponsibilityCutoverResult =
  | Readonly<{
      kind: "completed"
      replayed: boolean
      freeze_id: string
      source_count: number
      adopted_count: number
      source_manifest_digest: string
      completed_at: number
    }>
  | Readonly<{
      kind:
        | "source_namespace_missing"
        | "source_not_frozen"
        | "receipt_conflict"
        | "coverage_incomplete"
    }>
  | Readonly<{ kind: "unavailable"; cause?: unknown }>

/** 旧責務台帳の移行網羅性と改変不能な完了証跡を永続化境界で確定する。 */
export class GovernanceResponsibilityCutoverAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: {
    session: CompanySessionValue
    freezeId: string
  }): Promise<GovernanceResponsibilityCutoverResult> {
    const sourceNamespace = this.c.sourceNamespace
    if (sourceNamespace === undefined) return { kind: "source_namespace_missing" }
    const freeze = await this.c.database
      .prepare(`SELECT id FROM system_record_source_freezes
      WHERE id = ?1 AND source_namespace = ?2 AND owner_context = 'governance' AND revision = 1`)
      .bind(props.freezeId, sourceNamespace)
      .first()
    if (freeze === null) return { kind: "source_not_frozen" }
    const sourceCount = await this.c.database
      .prepare("SELECT count(*) AS total FROM governance_org_role_assignments")
      .first<number>("total")
    const ledger = openCompanyResponsibilitySourceLedger(this.c.database)
    const rows = await ledger.listAdoptedSources({
      ...governanceResponsibilitySource,
      sourceNamespace,
      freezeId: props.freezeId,
    })
    const entries = z.array(governanceResponsibilityManifestEntrySchema).safeParse(rows)
    if (sourceCount === null || !entries.success) return { kind: "unavailable" }
    const manifest = CanonicalSystemJsonValue.create(entries.data)
    if (manifest instanceof Error) return { kind: "unavailable", cause: manifest }
    const digest = await ProposalDigestValue.create(manifest)
    if (digest instanceof Error) return { kind: "unavailable", cause: digest }
    const existing = await ledger.findCutover(governanceResponsibilitySource)
    if (existing !== null) {
      const receipt = governanceResponsibilityCutoverReceiptSchema.safeParse(existing)
      if (
        !receipt.success ||
        receipt.data.freeze_id !== props.freezeId ||
        receipt.data.source_count !== sourceCount ||
        receipt.data.adopted_count !== entries.data.length ||
        receipt.data.source_manifest_digest !== digest.toString()
      )
        return { kind: "receipt_conflict" }
      return Object.freeze({ kind: "completed", replayed: true, ...receipt.data })
    }
    const completedAt = new Date(this.c.now ?? Date.now()).getTime()
    const audit = this.c.prepareAudit({
      session: props.session,
      action: "governance.org_role.migration_completed",
      targetType: "governance_org_role",
      targetId: props.freezeId,
      metadata: {
        source_context: "governance",
        source_kind: "org-role-assignment",
        source_count: sourceCount,
        source_manifest_digest: digest.toString(),
      },
    })
    const insert = ledger.prepareCutover({
      ...governanceResponsibilitySource,
      sourceNamespace,
      freezeId: props.freezeId,
      sourceCount,
      manifestDigest: digest.toString(),
      manifestJson: manifest.toString(),
      auditEventId: audit.eventId,
      actorAccountId: props.session.accountId,
      completedAt,
    })
    try {
      const statements = [...audit.statements, insert]
      const results = await this.c.database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        throw new Error("governance responsibility cutover batch failed")
      return Object.freeze({
        kind: "completed",
        replayed: false,
        freeze_id: props.freezeId,
        source_count: sourceCount,
        adopted_count: entries.data.length,
        source_manifest_digest: digest.toString(),
        completed_at: completedAt,
      })
    } catch (cause) {
      if (cause instanceof Error && /cutover_coverage_invalid/.test(cause.message))
        return { kind: "coverage_incomplete" }
      return { kind: "unavailable", cause }
    }
  }
}
