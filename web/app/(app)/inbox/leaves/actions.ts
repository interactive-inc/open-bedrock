"use server"

import { z } from "zod"
import type { LeaveRequestInboxResponse } from "@/lib/api/types/leave-types"
import { revalidatePath } from "next/cache"
import { approveLeaveRequest } from "@/lib/api/approve-leave-request"
import { getMe } from "@/lib/api/get-me"
import { rejectLeaveRequest } from "@/lib/api/reject-leave-request"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canDecideLeave } from "@/lib/leave/can-decide-leave"

export type LeaveDecisionState = {
  ok: boolean
  error: string | null
}

/** 承認処理。コメント任意。 */
async function approve(
  leaveRequestId: number,
  comment: string | null,
  target: LeaveRequestInboxResponse["decision_target"],
): Promise<LeaveDecisionState> {
  const decided = await approveLeaveRequest(leaveRequestId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

/** 却下処理。コメント必須。 */
async function reject(
  leaveRequestId: number,
  comment: string | null,
  target: LeaveRequestInboxResponse["decision_target"],
): Promise<LeaveDecisionState> {
  if (comment === null) {
    return { ok: false, error: "却下理由を入力してください" }
  }

  const decided = await rejectLeaveRequest(leaveRequestId, comment, target)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

/** 承認/却下を 1 つにまとめた Server Action。decision フィールドで分岐し、成功時は inbox を再検証する。 */
export async function decideLeaveRequestAction(
  previousState: LeaveDecisionState,
  formData: FormData,
): Promise<LeaveDecisionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canDecideLeave(currentUser.permissions) === false) {
    return { ok: false, error: "休暇申請を承認・却下する権限がありません" }
  }

  const leaveRequestId = toPositiveIntId(formData.get("leave_request_id"))

  if (leaveRequestId === null) {
    return { ok: false, error: "申請が指定されていません" }
  }

  let target: LeaveRequestInboxResponse["decision_target"]
  try {
    const rawTarget = formData.get("decision_target")
    if (typeof rawTarget !== "string") return { ok: false, error: "申請内容を確認し直してください" }
    target = z
      .object({
        request_id: z.number().int().positive(),
        request_digest: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(JSON.parse(rawTarget))
  } catch {
    return { ok: false, error: "申請内容を確認し直してください" }
  }
  if (target.request_id !== leaveRequestId)
    return { ok: false, error: "申請内容を確認し直してください" }

  const decision = formData.get("decision")

  const rawComment = formData.get("comment")

  const comment =
    typeof rawComment === "string" && rawComment.trim() !== "" ? rawComment.trim() : null

  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: "操作が不正です" }
  }

  let result: LeaveDecisionState
  if (decision === "approve") result = await approve(leaveRequestId, comment, target)
  else result = await reject(leaveRequestId, comment, target)

  if (!result.ok) {
    return result
  }

  revalidatePath("/inbox/leaves")
  revalidatePath("/my/leaves")

  return result
}
