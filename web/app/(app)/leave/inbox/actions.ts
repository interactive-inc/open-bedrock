"use server"

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

// 承認処理。コメント任意。
async function approve(
  leaveRequestId: number,
  comment: string | null,
): Promise<LeaveDecisionState> {
  const decided = await approveLeaveRequest(leaveRequestId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

// 却下処理。コメント必須。
async function reject(leaveRequestId: number, comment: string | null): Promise<LeaveDecisionState> {
  if (comment === null) {
    return { ok: false, error: "却下理由を入力してください" }
  }

  const decided = await rejectLeaveRequest(leaveRequestId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

// 承認/却下を 1 つにまとめた Server Action。decision フィールドで分岐し、成功時は inbox を再検証する。
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

  const decision = formData.get("decision")

  const rawComment = formData.get("comment")

  const comment =
    typeof rawComment === "string" && rawComment.trim() !== "" ? rawComment.trim() : null

  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: "操作が不正です" }
  }

  const result =
    decision === "approve"
      ? await approve(leaveRequestId, comment)
      : await reject(leaveRequestId, comment)

  if (!result.ok) {
    return result
  }

  revalidatePath("/leave/inbox")
  revalidatePath("/leave")

  return result
}
