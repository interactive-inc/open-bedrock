import { CompanyPersonnelEventRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-event.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/entities/onboarding-template-task.entity"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemManagedJobRunnerAdapter } from "@system/infrastructure/adapters/events/system-managed-job-runner.adapter"
import { SystemServiceOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-service-operation-authorization.adapter"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

type Context = Readonly<{
  env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }>
  accountId: AccountId
  recordedSince: Date
  clock: () => Date
}>
const handlerKey = "onboarding.lifecycle"
const templateSelection = `SELECT template.id, template.code, template.name, template.kind, template.description,
 binding.updated_at AS binding_updated_at,
 (SELECT json_group_array(json_object('code', code, 'title', title, 'order', sort_order, 'ownerRole', owner_role))
   FROM (SELECT * FROM onboarding_template_tasks WHERE template_code = template.code ORDER BY sort_order, code)) AS tasks_json
 FROM company_lifecycle_effect_template_bindings binding JOIN onboarding_templates template ON template.code = binding.template_code
 WHERE binding.effect_type = ?1`
const templateSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.enum(["join", "leave"]),
  description: z.string().nullable(),
  binding_updated_at: z.number().int(),
  tasks_json: z.string(),
})
const tasksSchema = z
  .array(
    z.object({
      code: z.string(),
      title: z.string(),
      order: z.number().int(),
      ownerRole: z.string().nullable(),
    }),
  )
  .min(1)
  .max(200)

/** 発効した入退社を、対応する雇用とテンプレートを再検査してチェックリストへ引き渡す。 */
export class OnboardingLifecycleDeliveryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(limit: number) {
    const now = this.c.clock()
    if (!Number.isSafeInteger(now.getTime())) return new Error("invalid lifecycle delivery time")
    const observedOn = resolveCompanyBusinessDate({
      now: now.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (observedOn instanceof Error) return observedOn
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(this.c.recordedSince.getTime()) ||
      this.c.recordedSince.getTime() < 0
    )
      return new Error("invalid lifecycle delivery window")
    try {
      const authorization = await this.authorize(now)
      if (authorization instanceof Error) return authorization
      const candidates =
        await this.c.env.DB.prepare(`SELECT action.id, action.payload_fingerprint FROM company_personnel_actions action
        WHERE action.recorded_at >= ?1 AND action.recorded_at <= ?2
          AND (action.kind IN ('hire', 'rehire', 'retired') OR (action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementKind') IN ('hire', 'rehire', 'retired')))
          AND (CASE
            WHEN action.kind = 'retired' THEN date(action.event_on, '+1 day')
            WHEN action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementKind') = 'retired' THEN date(json_extract(action.summary_json, '$.replacementEventOn'), '+1 day')
            WHEN action.kind = 'corrected' THEN json_extract(action.summary_json, '$.replacementEventOn')
            ELSE action.event_on END <= ?3
            OR (action.kind = 'corrected' AND json_extract(action.summary_json, '$.replacementEventOn') IS NULL))
          AND NOT EXISTS (SELECT 1 FROM onboarding_lifecycle_deliveries delivery WHERE delivery.action_id = action.id)
        ORDER BY action.rowid LIMIT ?4`)
          .bind(
            Math.ceil(this.c.recordedSince.getTime() / 1000),
            Math.floor(now.getTime() / 1000),
            observedOn,
            limit,
          )
          .all<{ id: string; payload_fingerprint: string }>()
      if (!candidates.success) return new Error("failed to list lifecycle deliveries")
      for (const candidate of candidates.results) {
        const queued = await this.enqueue(
          candidate.id,
          candidate.payload_fingerprint,
          now,
          authorization.assertions,
        )
        if (queued instanceof Error) return queued
      }
      return new SystemManagedJobRunnerAdapter({
        env: this.c.env,
        handlerKey,
        workerAccountId: this.c.accountId,
        clock: this.c.clock,
        prepare: (job, at) => this.prepare(job, at),
      }).run(limit)
    } catch (cause) {
      return new Error("lifecycle delivery is unavailable", { cause })
    }
  }

  private async authorize(now: Date) {
    const tokenVersion = await this.c.env.DB.prepare(
      "SELECT token_version FROM system_accounts WHERE id = ?1",
    )
      .bind(this.c.accountId)
      .first<number>("token_version")
    if (tokenVersion === null) return new Error("lifecycle Service is unavailable")
    const proof = await new SystemServiceOperationAuthorizationAdapter(this.c).prepare({
      accountId: this.c.accountId,
      tokenVersion,
      permissions: ["batch:execute", "employee:read", "onboarding:manage"],
      now,
    })
    return proof === "forbidden" ? new Error("lifecycle Service is not authorized") : proof
  }

  private async enqueue(
    actionId: string,
    digest: string,
    now: Date,
    assertions: ReadonlyArray<D1PreparedStatement>,
  ) {
    const job = SystemDeliveryEntity.create({
      id: crypto.randomUUID(),
      kind: "job",
      handlerKey,
      operationKey: handlerKey,
      payloadDigest: digest,
      idempotencyKey: `action:${actionId}`,
      status: "queued",
      attempt: 0,
      maxAttempts: 5,
      availableAt: now,
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    if (job instanceof Error) return job
    const audit = this.audit(job.id, "queued", { actionId }, now)
    if (audit instanceof Error) return audit
    const saved = await new SystemDeliveryRepository(this.c).create(job, this.c.accountId, null, [
      ...assertions,
      this.c.env.DB.prepare(
        "INSERT INTO onboarding_lifecycle_deliveries (job_id, action_id, created_at) VALUES (?1, ?2, ?3)",
      ).bind(job.id, actionId, now.getTime()),
      ...audit,
    ])
    return saved === "conflict" ? new Error("lifecycle job identity conflict") : saved
  }

  private async prepare(
    job: SystemDeliveryEntity,
    at: Date,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const authorization = await this.authorize(at)
    if (authorization instanceof Error) return authorization
    const actionId = await this.c.env.DB.prepare(
      "SELECT action_id FROM onboarding_lifecycle_deliveries WHERE job_id = ?1 AND outcome IS NULL",
    )
      .bind(job.id)
      .first<string>("action_id")
    if (actionId === null) return new Error("lifecycle source is unavailable")
    const observedOn = resolveCompanyBusinessDate({
      now: at.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (observedOn instanceof Error) return observedOn
    const company = new CompanyPersonnelEventRepository(this.c)
    const source = await company.findEmploymentEffect(actionId, observedOn)
    if (source === null || source instanceof Error)
      return new Error("lifecycle source cannot be verified", { cause: source })
    if (source.event.props.fingerprint !== job.payloadDigest)
      return new Error("lifecycle source digest changed")
    const guards = [...authorization.assertions, company.prepareGuard(source)]
    if (source.status === "obsolete" || source.status === "superseded") {
      const audit = this.audit(job.id, source.status, { actionId }, at)
      if (audit instanceof Error) return audit
      return [...guards, ...this.receipt(job.id, source.status, at), ...audit]
    }
    if (source.status !== "ready" || source.effect === null)
      return new Error("lifecycle effect is not ready")
    const effectType = source.effect.kind === "retired" ? "retired" : "hire"
    const row = templateSchema.safeParse(
      await this.c.env.DB.prepare(templateSelection).bind(effectType).first(),
    )
    if (!row.success) return new Error("lifecycle template is unavailable")
    const tasks = tasksSchema.safeParse(JSON.parse(row.data.tasks_json))
    if (!tasks.success) return new Error("lifecycle template tasks are invalid")
    if (row.data.kind !== (effectType === "retired" ? "leave" : "join"))
      return new Error("lifecycle template kind changed")
    const template = new OnboardingTemplate({
      ...row.data,
      tasks: tasks.data.map((task) => new OnboardingTemplateTask(task)),
    })
    const employeeId = zEmployeeId.safeParse(source.event.props.employeeId)
    if (!employeeId.success) return new Error("lifecycle employee identity is invalid")
    const assignment = OnboardingAssignment.create({
      employeeId: employeeId.data,
      template,
      assignedAt: at.toISOString(),
    })
    const audit = this.audit(
      job.id,
      "assigned",
      {
        actionId,
        employeeId: assignment.employeeId,
        templateCode: template.code,
        employmentId: source.period?.period_id,
      },
      at,
    )
    if (audit instanceof Error) return audit
    return [
      ...guards,
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM (${templateSelection}) current
        WHERE current.code = ?2 AND current.kind = ?3 AND current.binding_updated_at = ?4 AND current.tasks_json = ?5)
        THEN 1 ELSE json_extract('{}', 'onboarding_lifecycle_template_changed') END AS ok`).bind(
        effectType,
        template.code,
        template.kind,
        row.data.binding_updated_at,
        row.data.tasks_json,
      ),
      this.c.env.DB.prepare(`INSERT INTO onboarding_assignments (employee_id, template_code, kind, status, assigned_at, lifecycle_action_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(
        assignment.employeeId,
        assignment.templateCode,
        assignment.kind,
        assignment.status,
        assignment.assignedAt,
        actionId,
      ),
      this.c.env.DB.prepare(`INSERT INTO onboarding_tasks (assignment_id, template_task_code, title, sort_order, status, completed_at)
        SELECT (SELECT id FROM onboarding_assignments WHERE lifecycle_action_id = ?1), json_extract(value, '$.templateTaskCode'),
          json_extract(value, '$.title'), json_extract(value, '$.order'), 'pending', NULL FROM json_each(?2)`).bind(
        actionId,
        JSON.stringify(
          assignment.tasks.map((task) => ({
            templateTaskCode: task.templateTaskCode,
            title: task.title,
            order: task.order,
          })),
        ),
      ),
      ...this.receipt(job.id, "assigned", at),
      ...audit,
    ]
  }

  private receipt(jobId: string, outcome: "assigned" | "obsolete" | "superseded", at: Date) {
    return [
      this.c.env.DB.prepare(`UPDATE onboarding_lifecycle_deliveries SET outcome = ?2, processed_at = ?3,
      assignment_id = CASE WHEN ?2 = 'assigned' THEN (SELECT id FROM onboarding_assignments WHERE lifecycle_action_id = action_id) ELSE NULL END
      WHERE job_id = ?1 AND outcome IS NULL`).bind(jobId, outcome, at.getTime()),
      this.c.env.DB.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('{}', 'onboarding_lifecycle_delivery_changed') END AS ok",
      ),
    ]
  }

  private audit(jobId: string, action: string, metadata: unknown, at: Date) {
    const event = SystemAuditEventEntity.create({
      actorAccountId: this.c.accountId,
      action: `onboarding.lifecycle.${action}`,
      targetType: "onboarding:lifecycle_delivery",
      targetId: jobId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permissions: ["batch:execute", "employee:read", "onboarding:manage"],
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify(metadata),
      occurredAt: at,
    })
    if (event instanceof Error) return event
    return new SystemAuditEventRepository(this.c).prepareAppend(event)
  }
}
