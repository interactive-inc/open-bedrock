import type { Session } from "@/lib/auth/session"
import { canEvaluateGoalOf } from "@/lib/goal/can-evaluate-goal-of"
import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { GoalEvaluationKind } from "@/domain/goal/goal-evaluation.entity"

export type Forbidden = { reason: "forbidden" }

export type Props = {
  kind: GoalEvaluationKind
  goalEmployeeId: number
  viewerEmployeeId: number
  session: Session
  relation: EmployeeRelation
}

/** self は本人のみ、manager/final は評価スコープ(all/reports)で許可する。本人による自己承認は禁止する。 */
export function resolveEvaluationPermission(props: Props): null | Forbidden {
  if (props.kind === "self") {
    const isOwner = props.goalEmployeeId === props.viewerEmployeeId

    return isOwner ? null : { reason: "forbidden" }
  }

  // 上長・確定評価は本人による自己承認を禁止する。
  if (props.goalEmployeeId === props.viewerEmployeeId) {
    return { reason: "forbidden" }
  }

  return canEvaluateGoalOf(props.session, props.relation) ? null : { reason: "forbidden" }
}
