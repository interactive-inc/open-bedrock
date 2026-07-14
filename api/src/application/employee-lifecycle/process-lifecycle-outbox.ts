import type { Context, SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"
import {
  abortWhenPreviousStatementChangedNoRows,
  isAbortedByGuard,
} from "@/lib/d1/batch-abort-guard"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import { z } from "zod"

const payloadSchema = z
  .object({ actionId: z.string().min(1), employeeId: z.number().int().positive() })
  .strict()

type OutboxRow = {
  id: number
  personnel_action_id: string
  effect_type: "hire" | "retired"
  payload_json: string
  attempt_count: number
  employee_id: number
  event_on: string
  template_code: string | null
  template_kind: "join" | "leave" | null
}

function parsePayload(value: string) {
  try {
    return payloadSchema.safeParse(JSON.parse(value))
  } catch (cause) {
    return payloadSchema.safeParse({ cause })
  }
}

export type ProcessLifecycleOutboxResult = {
  processed: number
  skipped: number
  failed: number
}

export class ProcessLifecycleOutbox {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: SessionPayload
    limit?: number
  }): Promise<ProcessLifecycleOutboxResult | ApplicationError> {
    if (
      !hasPermission(command.session, "batch:view") ||
      !hasPermission(command.session, "employee:lifecycle:apply")
    ) {
      return new ForbiddenError("lifecycle outbox processing is forbidden", "forbidden")
    }
    const limit = Math.min(Math.max(command.limit ?? 25, 1), 100)
    const now = Math.floor(Date.parse(this.c.env.NOW ?? new Date().toISOString()) / 1_000)
    let rows: ReadonlyArray<OutboxRow>
    try {
      rows = (
        await this.c.env.DB.prepare(
          `SELECT outbox.id, outbox.personnel_action_id, outbox.effect_type,
                  outbox.payload_json, outbox.attempt_count, action.employee_id, action.event_on,
                  binding.template_code, template.kind AS template_kind
           FROM lifecycle_outbox outbox
           INNER JOIN personnel_actions action ON action.id = outbox.personnel_action_id
           LEFT JOIN lifecycle_effect_template_bindings binding
             ON binding.effect_type = outbox.effect_type
           LEFT JOIN onboarding_templates template ON template.code = binding.template_code
           WHERE outbox.processed_at IS NULL AND outbox.next_attempt_at <= ?1
           ORDER BY outbox.id
           LIMIT ?2`,
        )
          .bind(now, limit)
          .all<OutboxRow>()
      ).results
    } catch (cause) {
      return new UnexpectedError("failed to load lifecycle outbox", { cause })
    }

    const result: ProcessLifecycleOutboxResult = { processed: 0, skipped: 0, failed: 0 }
    for (const row of rows) {
      const payload = parsePayload(row.payload_json)
      const expectedKind = row.effect_type === "hire" ? "join" : "leave"
      const invalidBinding =
        (row.template_code !== null && row.template_kind === null) ||
        (row.template_kind !== null && row.template_kind !== expectedKind)
      const invalidPayload =
        !payload.success ||
        payload.data.actionId !== row.personnel_action_id ||
        payload.data.employeeId !== row.employee_id
      if (invalidPayload || invalidBinding) {
        await this.recordFailure(row, now, "invalid_lifecycle_effect")
        result.failed += 1
        continue
      }
      try {
        const statements: D1PreparedStatement[] = [
          this.c.env.DB.prepare(
            `UPDATE lifecycle_outbox SET attempt_count = attempt_count
               WHERE id = ?1 AND processed_at IS NULL
                 AND (
                   ?2 IS NULL OR EXISTS (
                     SELECT 1
                     FROM lifecycle_effect_template_bindings binding
                     INNER JOIN onboarding_templates template
                       ON template.code = binding.template_code
                     WHERE binding.effect_type = ?3
                       AND binding.template_code = ?2
                       AND template.kind = ?4
                   )
                 )
               RETURNING id`,
          ).bind(row.id, row.template_code, row.effect_type, expectedKind),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ]
        if (row.template_code !== null && row.template_kind !== null) {
          statements.push(
            this.c.env.DB.prepare(
              `INSERT OR IGNORE INTO onboarding_assignments
                   (employee_id, template_code, kind, status, assigned_at)
                 VALUES (?1, ?2, ?3, 'in_progress', ?4)`,
            ).bind(payload.data.employeeId, row.template_code, row.template_kind, row.event_on),
            this.c.env.DB.prepare(
              `INSERT INTO onboarding_tasks
                   (assignment_id, template_task_code, title, sort_order, status, completed_at)
                 SELECT assignment.id, task.code, task.title, task.sort_order, 'pending', NULL
                 FROM onboarding_assignments assignment
                 INNER JOIN onboarding_template_tasks task
                   ON task.template_code = assignment.template_code
                 WHERE assignment.employee_id = ?1 AND assignment.template_code = ?2
                   AND assignment.status != 'completed'
                   AND NOT EXISTS (
                     SELECT 1 FROM onboarding_tasks existing
                     WHERE existing.assignment_id = assignment.id
                   )`,
            ).bind(payload.data.employeeId, row.template_code),
          )
        }
        statements.push(
          this.c.env.DB.prepare(
            `UPDATE lifecycle_outbox
               SET processed_at = ?2, last_error_code = NULL
               WHERE id = ?1 AND processed_at IS NULL RETURNING id`,
          ).bind(row.id, now),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        )
        await this.c.env.DB.batch(statements)
        if (row.template_code === null) result.skipped += 1
        else result.processed += 1
      } catch (cause) {
        if (!isAbortedByGuard(cause)) {
          await this.recordFailure(row, now, "lifecycle_effect_failed")
          result.failed += 1
        }
      }
    }
    return result
  }

  private async recordFailure(row: OutboxRow, now: number, code: string): Promise<void> {
    const delay = Math.min(60 * 2 ** Math.min(row.attempt_count, 10), 86_400)
    await this.c.env.DB.prepare(
      `UPDATE lifecycle_outbox
       SET attempt_count = attempt_count + 1, next_attempt_at = ?2, last_error_code = ?3
       WHERE id = ?1 AND processed_at IS NULL`,
    )
      .bind(row.id, now + delay, code)
      .run()
  }
}
