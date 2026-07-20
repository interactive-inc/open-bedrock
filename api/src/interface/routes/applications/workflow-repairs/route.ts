import { factory } from "@/interface/utils/factory"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { workflowReachableApprovalCountSql } from "@/infrastructure/application/application-workflow-repository"
import { activateDueWorkflowEscalations } from "@/lib/application/ensure-workflow-step-escalation"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

type RepairRow = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (
      session.hasPermission("application:read:all") === false ||
      session.hasPermission("application_template:manage") === false
    ) {
      throw new ForbiddenError()
    }

    const escalation = await activateDueWorkflowEscalations({
      c,
      now: c.env.NOW ?? new Date().toISOString(),
    })
    if (escalation instanceof Error) {
      throw new InternalError("failed to activate due workflow escalations")
    }

    const query = c.req.valid("query")
    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const repairCondition = `application.status = 'pending'
    AND application.current_step = workflow_instance.current_step_key
    AND (
      snapshot.application_id IS NULL
      OR (${workflowReachableApprovalCountSql({
        applicationId: "workflow_instance.application_id",
        stepKey: "workflow_instance.current_step_key",
        round: "workflow_instance.current_round",
      })}) < snapshot.required_approvals
    )`

    try {
      const [rows, total] = await Promise.all([
        c.env.DB.prepare(
          `SELECT application.id,
                template.code AS template_code,
                template.name AS template_name,
                applicant.name AS applicant_name,
                workflow_instance.current_step_key AS step_key,
                workflow_instance.current_round AS round,
                CASE WHEN snapshot.application_id IS NULL
                  THEN 'snapshot_missing' ELSE 'inactive_candidates' END AS reason,
                workflow_instance.started_at
         FROM applications application
         INNER JOIN application_workflow_instances workflow_instance
           ON workflow_instance.application_id = application.id
         INNER JOIN application_templates template ON template.id = application.template_id
         LEFT JOIN employees applicant ON applicant.id = application.applicant_id
         LEFT JOIN application_workflow_step_snapshots snapshot
           ON snapshot.application_id = workflow_instance.application_id
          AND snapshot.step_key = workflow_instance.current_step_key
          AND snapshot.round = workflow_instance.current_round
         WHERE ${repairCondition}
         ORDER BY workflow_instance.started_at ASC, application.id ASC
         LIMIT ?1 OFFSET ?2`,
        )
          .bind(limit, offset)
          .all<RepairRow>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) AS total
         FROM applications application
         INNER JOIN application_workflow_instances workflow_instance
           ON workflow_instance.application_id = application.id
         LEFT JOIN application_workflow_step_snapshots snapshot
           ON snapshot.application_id = workflow_instance.application_id
          AND snapshot.step_key = workflow_instance.current_step_key
          AND snapshot.round = workflow_instance.current_round
         WHERE ${repairCondition}`,
        ).first<number>("total"),
      ])

      return c.json({ data: rows.results, total: total ?? 0 }, 200)
    } catch {
      throw new InternalError("failed to list workflow repairs")
    }
  },
)
