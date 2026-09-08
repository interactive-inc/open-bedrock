import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { toLeaveDecisionSnapshot } from "@/contexts/leave/domain/definitions/to-leave-decision-snapshot.definition"
import type { LeaveDecisionTarget } from "@/contexts/leave/domain/definitions/leave-decision-target.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

/** 確認した休暇申請の本人・内容・状態を、Systemのcanonical JSONとdigestに固定する。 */
export class LeaveDecisionTargetValue {
  private constructor(private readonly props: LeaveDecisionTarget) {
    Object.freeze(this)
  }

  static async create(request: LeaveRequest): Promise<LeaveDecisionTargetValue | null | Error> {
    if (request.id === null || request.status !== "pending") return null
    const canonical = CanonicalSystemJsonValue.create({
      schemaVersion: 1,
      subjectType: "leave_request",
      request: toLeaveDecisionSnapshot(request),
    })
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new LeaveDecisionTargetValue({
      request_id: request.id,
      request_digest: digest.toString(),
    })
  }

  matches(target: LeaveDecisionTarget): boolean {
    return (
      this.props.request_id === target.request_id &&
      this.props.request_digest === target.request_digest
    )
  }

  toJSON(): LeaveDecisionTarget {
    return { ...this.props }
  }
}
