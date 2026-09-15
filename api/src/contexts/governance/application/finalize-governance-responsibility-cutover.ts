import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { Bindings } from "@/env"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

type Audit = Readonly<{
  eventId: string
  statements: ReadonlyArray<D1PreparedStatement>
}>

type Context = Readonly<{
  context: Readonly<{
    env: Pick<Bindings, "DB" | "NOW"> & Readonly<{ RECORD_SOURCE_NAMESPACE?: string }>
  }>
  prepareAudit: (props: {
    session: CompanySessionValue
    action: "governance.org_role.migration_completed"
    targetType: "governance_org_role"
    targetId: string
    metadata: Readonly<Record<string, string | number>>
  }) => Audit
}>

const receiptSchema = z.object({
  freeze_id: z.string().uuid(),
  source_count: z.number().int().nonnegative(),
  adopted_count: z.number().int().nonnegative(),
  source_manifest_digest: z.string().regex(/^[0-9a-f]{64}$/),
  completed_at: z.number().int().nonnegative(),
})
const manifestEntrySchema = z.object({
  sourceId: z.string().min(1),
  sourceVersion: z.string().regex(/^[0-9a-f]{64}$/),
})

/** 凍結した旧責務台帳の全件移行を検証し、旧台帳廃止の改変不能な証跡を確定する。 */
export class FinalizeGovernanceResponsibilityCutover {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: { session: CompanySessionValue; freezeId: string }) {
    if (!props.session.permissions.has("governance:manage")) {
      return new ForbiddenError("組織責任の移行を完了する権限がありません", "governance_role_forbidden")
    }
    const sourceNamespace = this.c.context.env.RECORD_SOURCE_NAMESPACE
    if (sourceNamespace === undefined) {
      return new UnexpectedError("組織責任の移行元を特定できません")
    }
    const freeze = await this.c.context.env.DB.prepare(`SELECT id
      FROM system_record_source_freezes
      WHERE id = ?1 AND source_namespace = ?2 AND owner_context = 'governance' AND revision = 1`)
      .bind(props.freezeId, sourceNamespace)
      .first()
    if (freeze === null) {
      return new ConflictError(
        "指定した組織責任の元台帳は停止されていません",
        "governance_role_source_not_frozen",
      )
    }

    const sourceCount = await this.c.context.env.DB.prepare(
      "SELECT count(*) AS total FROM governance_org_role_assignments",
    ).first<number>("total")
    const adoptionRows = await this.c.context.env.DB.prepare(`SELECT source_id AS sourceId,
      source_version AS sourceVersion
      FROM company_responsibility_source_adoptions
      WHERE organization_id = 'organization:default'
        AND source_context = 'governance' AND source_kind = 'org-role-assignment'
      ORDER BY CAST(source_id AS INTEGER), source_id`).all()
    const adoptionEntries = z.array(manifestEntrySchema).safeParse(adoptionRows.results)
    if (sourceCount === null || !adoptionEntries.success) {
      return new UnexpectedError("組織責任の移行証跡を検証できません")
    }
    const manifest = CanonicalSystemJsonValue.create(adoptionEntries.data)
    if (manifest instanceof Error) {
      return new UnexpectedError("組織責任の移行一覧を作成できません", { cause: manifest })
    }
    const manifestDigest = await ProposalDigestValue.create(manifest)
    if (manifestDigest instanceof Error) {
      return new UnexpectedError("組織責任の移行一覧を検証できません", { cause: manifestDigest })
    }

    const existing = await this.c.context.env.DB.prepare(`SELECT freeze_id, source_count,
      adopted_count, source_manifest_digest, completed_at
      FROM company_responsibility_source_cutovers
      WHERE organization_id = 'organization:default'
        AND source_context = 'governance' AND source_kind = 'org-role-assignment'`).first()
    if (existing !== null) {
      const receipt = receiptSchema.safeParse(existing)
      if (
        receipt.success &&
        receipt.data.freeze_id === props.freezeId &&
        receipt.data.source_count === sourceCount &&
        receipt.data.adopted_count === adoptionEntries.data.length &&
        receipt.data.source_manifest_digest === manifestDigest.toString()
      ) {
        return Object.freeze({ kind: "completed" as const, replayed: true, ...receipt.data })
      }
      return new ConflictError(
        "組織責任の移行完了証跡が一致しません",
        "governance_role_cutover_conflict",
      )
    }

    const completedAt = new Date(this.c.context.env.NOW ?? Date.now()).getTime()
    const audit = this.c.prepareAudit({
      session: props.session,
      action: "governance.org_role.migration_completed",
      targetType: "governance_org_role",
      targetId: props.freezeId,
      metadata: {
        source_context: "governance",
        source_kind: "org-role-assignment",
        source_count: sourceCount,
        source_manifest_digest: manifestDigest.toString(),
      },
    })
    const insert = this.c.context.env.DB.prepare(`INSERT INTO company_responsibility_source_cutovers
      (organization_id, source_context, source_kind, source_namespace, freeze_id,
       source_count, adopted_count, source_manifest_digest, source_manifest_json,
       audit_event_id, actor_account_id, completed_at)
      VALUES ('organization:default', 'governance', 'org-role-assignment', ?1, ?2,
       ?3, ?3, ?4, ?5, ?6, ?7, ?8)`)
      .bind(
        sourceNamespace,
        props.freezeId,
        sourceCount,
        manifestDigest.toString(),
        manifest.toString(),
        audit.eventId,
        props.session.accountId,
        completedAt,
      )
    try {
      const statements = [...audit.statements, insert]
      const results = await this.c.context.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("governance responsibility cutover batch failed")
      }
      return Object.freeze({
        kind: "completed" as const,
        replayed: false,
        freeze_id: props.freezeId,
        source_count: sourceCount,
        adopted_count: adoptionEntries.data.length,
        source_manifest_digest: manifestDigest.toString(),
        completed_at: completedAt,
      })
    } catch (cause) {
      if (cause instanceof Error && /cutover_coverage_invalid/.test(cause.message)) {
        return new ConflictError(
          "Companyへ移行されていない組織責任があります",
          "governance_role_cutover_incomplete",
        )
      }
      return new UnexpectedError("組織責任の移行を完了できません", { cause })
    }
  }
}
