import { canEvaluateGoal } from "@/lib/goal/can-evaluate-goal"
import type { GoalEvaluationKind } from "@/domain/goal/goal-evaluation.entity"
import type { SessionPayload } from "@/env"

export type Forbidden = { reason: "forbidden" }

export type Props = {
  kind: GoalEvaluationKind
  goalEmployeeId: number
  viewerEmployeeId: number
  session: SessionPayload
}

/** self は本人のみ、manager/final は goal:evaluate 権限のみ許可する。 */
export function resolveEvaluationPermission(props: Props): null | Forbidden {
  if (props.kind === "self") {
    const isOwner = props.goalEmployeeId === props.viewerEmployeeId

    return isOwner ? null : { reason: "forbidden" }
  }

  return canEvaluateGoal(props.session) ? null : { reason: "forbidden" }
}
