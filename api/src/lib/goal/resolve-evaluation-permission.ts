import { canEvaluateAsManager } from "@/lib/goal/goal-access"
import type { Forbidden } from "@/lib/goal/goal-access"
import type { GoalEvaluationKind } from "@/domain/goal/goal-evaluation.entity"
import type { SessionPayload } from "@/env"

export type Props = {
  kind: GoalEvaluationKind
  goalEmployeeId: number
  viewerEmployeeId: number
  viewerSession: SessionPayload
}

/** self は本人のみ、manager/final は特権ロールのみ許可する。 */
export function resolveEvaluationPermission(props: Props): null | Forbidden {
  if (props.kind === "self") {
    const isOwner = props.goalEmployeeId === props.viewerEmployeeId

    return isOwner ? null : { reason: "forbidden" }
  }

  return canEvaluateAsManager(props.viewerSession) ? null : { reason: "forbidden" }
}
