import { formatDateTime } from "@/lib/format-date-time"
import type { LeaveProcedureRequestResponse } from "@/lib/api/types/leave-types"

const actionLabels = { approve: "承認", reject: "却下", return: "差戻し" }

/** 判断者、委任元、確認日時とコメントを案件の履歴として表示する。 */
export function LeaveDecisionHistory(
  props: Pick<LeaveProcedureRequestResponse, "decisions" | "approvals" | "required_approvals">,
) {
  return (
    <section className="flex flex-col gap-3">
      <h2>判断の記録</h2>
      <p>
        {props.approvals} / {props.required_approvals ?? "—"} 名の承認
      </p>
      {props.decisions.length === 0 ? (
        <p>判断はまだ記録されていません。</p>
      ) : (
        <ul>
          {props.decisions.map((decision) => (
            <li key={`${decision.task_key}:${decision.task_round}:${decision.actor_account_id}`}>
              {actionLabels[decision.action]}：{decision.actor_name ?? decision.actor_account_id}
              {decision.represented_account_id !== decision.actor_account_id
                ? `（${decision.represented_name ?? decision.represented_account_id}の代理）`
                : ""}
              ・{formatDateTime(decision.decided_at)}・{decision.comment ?? "コメントなし"}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
