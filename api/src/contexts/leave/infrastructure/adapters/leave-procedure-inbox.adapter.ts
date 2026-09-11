import type { Context } from "@/env"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { LeaveProcedureReadAdapter } from "@/contexts/leave/infrastructure/adapters/leave-procedure-read.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { ApplicationError, ForbiddenError, UnexpectedError } from "@/lib/errors"
/** 現在の判断・実行資格を持つ休暇を上限付きで読む。 */
export class LeaveProcedureInboxAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async list(
    input: Readonly<{
      session: CompanyPersonnelSession
      tokenVersion: number
      at: Date
      limit: number
      offset: number
    }>,
  ) {
    const session = input.session,
      at = input.at,
      limit = input.limit,
      offset = input.offset
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: session.accountId,
      tokenVersion: input.tokenVersion,
      permissions: ["leave:approve"],
      now: at,
    })
    if (human === "forbidden")
      return new ForbiddenError("受信箱を参照する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("受信箱の権限を確認できません", { cause: human })
    try {
      const matches =
        await this.c.env.DB.prepare(`SELECT binding.leave_request_id AS id FROM leave_procedure_bindings binding
    JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
    WHERE (workflow_case.status IN ('approved', 'rejected') AND EXISTS (
      SELECT 1 FROM system_human_attestations witness WHERE witness.case_id = binding.case_id
        AND witness.actor_account_id = ?1 AND ((workflow_case.status = 'approved' AND witness.action = 'approve') OR (workflow_case.status = 'rejected' AND witness.action = 'reject'))
    )) OR (workflow_case.status = 'pending' AND EXISTS (
      SELECT 1 FROM system_decision_tasks task JOIN system_decision_task_candidates candidate
        ON candidate.case_id = task.case_id AND candidate.task_key = task.task_key AND candidate.round = task.round
      WHERE task.case_id = binding.case_id AND task.outcome IS NULL
        AND (candidate.candidate_account_id = ?1 OR EXISTS (
          SELECT 1 FROM system_delegations delegation WHERE delegation.delegator_account_id = candidate.candidate_account_id
            AND delegation.delegate_account_id = ?1 AND delegation.starts_at <= ?2 AND delegation.ends_at > ?2
            AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ?2)
        ))
    )) ORDER BY binding.leave_request_id DESC LIMIT ?3 OFFSET ?4`)
          .bind(session.accountId, at.getTime(), limit + 1, offset)
          .all<{ id: number }>()
      const reader = new LeaveProcedureReadAdapter(this.c)
      const data = []
      for (const row of matches.results.slice(0, limit)) {
        const view = await reader.find({
          leaveRequestId: row.id,
          session,
          tokenVersion: input.tokenVersion,
          at,
        })
        if (view instanceof ForbiddenError) continue
        if (view instanceof ApplicationError) return view
        if (view.can_decide || view.can_execute) data.push(view)
      }
      await this.c.env.DB.batch([...human.assertions])
      return { data, next_offset: matches.results.length > limit ? offset + limit : null }
    } catch (cause) {
      return new UnexpectedError("休暇受信箱を取得できません", { cause })
    }
  }
}
