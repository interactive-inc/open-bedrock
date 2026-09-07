import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{ env: Readonly<{ DB: D1Database }> }>

/** 入退社の配送と受領結果を読み、同じ発令を保持して失敗したjobを再投入する。 */
export class OnboardingLifecycleDeliveryRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany() {
    try {
      const rows =
        await this.c.env.DB.prepare(`SELECT delivery.job_id, delivery.action_id, delivery.outcome, delivery.assignment_id, delivery.processed_at,
        job.status, job.attempt, job.max_attempts, job.available_at, job.last_error_code,
        dead.id AS dead_letter_id, dead.requeued_job_id
        FROM onboarding_lifecycle_deliveries delivery JOIN system_jobs job ON job.id = delivery.job_id
        LEFT JOIN system_dead_letters dead ON dead.source_type = 'job' AND dead.source_id = job.id
        ORDER BY delivery.created_at DESC, delivery.job_id LIMIT 100`).all<{
          job_id: string
          action_id: string
          outcome: string | null
          assignment_id: number | null
          processed_at: number | null
          status: string
          attempt: number
          max_attempts: number
          available_at: number
          last_error_code: string | null
          dead_letter_id: string | null
          requeued_job_id: string | null
        }>()
      return rows.success ? rows.results : new Error("failed to list onboarding deliveries")
    } catch (cause) {
      return new Error("failed to list onboarding deliveries", { cause })
    }
  }

  async findFailure(jobId: string) {
    const source =
      await this.c.env.DB.prepare(`SELECT delivery.action_id, dead.id AS dead_letter_id FROM onboarding_lifecycle_deliveries delivery
      JOIN system_dead_letters dead ON dead.source_type = 'job' AND dead.source_id = delivery.job_id WHERE delivery.job_id = ?1`)
        .bind(jobId)
        .first<{ action_id: string; dead_letter_id: string }>()
    if (source === null) return null
    const job = await new SystemDeliveryRepository(this.c).find("job", jobId)
    if (job === null || job instanceof Error) return job
    if (job.handlerKey !== "onboarding.lifecycle" || job.status !== "dead_letter") return null
    return { job, actionId: source.action_id, deadLetterId: source.dead_letter_id }
  }

  async requeue(
    input: Readonly<{
      sourceJobId: string
      deadLetterId: string
      actionId: string
      job: SystemDeliveryEntity
      accountId: AccountId
      tokenVersion: number
      now: Date
    }>,
  ) {
    const proof = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: input.accountId,
      tokenVersion: input.tokenVersion,
      permissions: ["onboarding:manage", "batch:write", "system:admin"],
      now: input.now,
    })
    if (proof instanceof Error || proof === "forbidden") return proof
    const event = SystemAuditEventEntity.create({
      actorAccountId: input.accountId,
      action: "onboarding.lifecycle.requeued",
      targetType: "onboarding:lifecycle_delivery",
      targetId: input.job.id,
      outcome: "succeeded",
      reasonCode: "operator.retry",
      authorizationJson: JSON.stringify({ principalId: proof.principalId }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        sourceJobId: input.sourceJobId,
        actionId: input.actionId,
        deadLetterId: input.deadLetterId,
      }),
      occurredAt: input.now,
    })
    if (event instanceof Error) return event
    return new SystemDeliveryRepository(this.c).requeueDeadLetter(
      input.deadLetterId,
      input.job,
      input.accountId,
      [
        ...proof.assertions,
        this.c.env.DB.prepare(`INSERT INTO onboarding_lifecycle_deliveries (job_id, action_id, created_at)
        SELECT ?1, action_id, ?2 FROM onboarding_lifecycle_deliveries WHERE job_id = ?3 AND action_id = ?4`).bind(
          input.job.id,
          input.now.getTime(),
          input.sourceJobId,
          input.actionId,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('{}', 'onboarding_lifecycle_source_changed') END AS ok",
        ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(event),
      ],
    )
  }
}
