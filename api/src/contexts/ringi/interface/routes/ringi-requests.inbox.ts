import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zRingiProcedureView } from "@/contexts/ringi/interface/http/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError, ForbiddenError, InternalError } from "@/lib/http/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { RingiProcedureReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-procedure-read.adapter"
import { ApplicationError, ForbiddenError as ReadForbiddenError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"

// @authorization service - 現在の判断・実行資格を持つ案件だけを返す
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", z.object({ limit: z.string().optional(), offset: z.string().optional() })),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const at = new Date(c.env.NOW ?? Date.now())
    const human = await new SystemHumanOperationAuthorizationAdapter(c).prepare({
      accountId: session.accountId,
      tokenVersion: c.var.accountTokenVersion,
      permissions: ["ringi:approve"],
      now: at,
    })
    if (human === "forbidden") throw new ForbiddenError()
    if (human instanceof Error) throw new InternalError("受信箱の権限を確認できません")
    const limit = toBoundedInt({
      raw: c.req.query("limit"),
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: c.req.query("offset"),
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    const matches =
      await c.env.DB.prepare(`SELECT binding.ringi_id AS id FROM ringi_procedure_bindings binding
    JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
    WHERE (workflow_case.status = 'approved' AND EXISTS (
      SELECT 1 FROM system_human_attestations witness WHERE witness.case_id = binding.case_id
        AND witness.actor_account_id = ?1 AND witness.action = 'approve'
    )) OR (workflow_case.status = 'pending' AND EXISTS (
      SELECT 1 FROM system_decision_tasks task JOIN system_decision_task_candidates candidate
        ON candidate.case_id = task.case_id AND candidate.task_key = task.task_key AND candidate.round = task.round
      WHERE task.case_id = binding.case_id AND task.outcome IS NULL
        AND (candidate.candidate_account_id = ?1 OR EXISTS (
          SELECT 1 FROM system_delegations delegation WHERE delegation.delegator_account_id = candidate.candidate_account_id
            AND delegation.delegate_account_id = ?1 AND delegation.starts_at <= ?2 AND delegation.ends_at > ?2
            AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ?2)
        ))
    )) ORDER BY binding.ringi_id DESC LIMIT ?3 OFFSET ?4`)
        .bind(session.accountId, at.getTime(), limit + 1, offset)
        .all<{ id: number }>()
    const reader = new RingiProcedureReadAdapter(c)
    const data = []
    for (const row of matches.results.slice(0, limit)) {
      const view = await reader.find({
        ringiId: row.id,
        session,
        tokenVersion: c.var.accountTokenVersion,
        at,
      })
      if (view instanceof ReadForbiddenError) continue
      if (view instanceof ApplicationError) throw toHttpException(view)
      if (view.can_decide || view.can_execute) data.push(zRingiProcedureView.parse(view))
    }
    await c.env.DB.batch([...human.assertions])
    return c.json(
      { data, next_offset: matches.results.length > limit ? offset + limit : null },
      200,
    )
  },
)
