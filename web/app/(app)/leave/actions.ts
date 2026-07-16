"use server"

import { revalidatePath } from "next/cache"
import { cancelLeaveRequest } from "@/lib/api/cancel-leave-request"
import { createLeaveRequest } from "@/lib/api/create-leave-request"
import { updateLeaveRequest } from "@/lib/api/update-leave-request"
import type { LeaveType } from "@/lib/api/types/leave-types"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { requireAuth } from "@/lib/auth/require-auth"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type LeaveActionState = {
  ok: boolean
  error: string | null
}

// 休暇申請作成 Server Action。leave_type/start_date/end_date 必須、reason は任意。
// 成功時は /leave を revalidate して残日数と一覧へ反映する。
export async function createLeaveRequestAction(
  previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  await requireAuth()

  const leaveType = toLeaveType(formData.get("leave_type"))

  if (leaveType === null) {
    return { ok: false, error: "休暇種別を選択してください" }
  }

  const startDate = formData.get("start_date")

  const endDate = formData.get("end_date")

  if (typeof startDate !== "string" || startDate === "") {
    return { ok: false, error: "開始日を入力してください" }
  }

  if (typeof endDate !== "string" || endDate === "") {
    return { ok: false, error: "終了日を入力してください" }
  }

  if (endDate < startDate) {
    return { ok: false, error: "終了日は開始日以降にしてください" }
  }

  const reasonValue = formData.get("reason")

  const reason =
    typeof reasonValue === "string" && reasonValue.trim() !== "" ? reasonValue.trim() : null

  const created = await createLeaveRequest({
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/leave")

  return { ok: true, error: null }
}

// 休暇申請変更 Server Action。leave_request_id/leave_type/start_date/end_date 必須、reason は任意。
// 成功時は /leave を revalidate して一覧へ反映する。
export async function updateLeaveRequestAction(
  previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  await requireAuth()

  const leaveRequestId = toPositiveIntId(formData.get("leave_request_id"))

  if (leaveRequestId === null) {
    return { ok: false, error: "休暇申請を特定できませんでした" }
  }

  const leaveType = toLeaveType(formData.get("leave_type"))

  if (leaveType === null) {
    return { ok: false, error: "休暇種別を選択してください" }
  }

  const startDate = formData.get("start_date")

  const endDate = formData.get("end_date")

  if (typeof startDate !== "string" || startDate === "") {
    return { ok: false, error: "開始日を入力してください" }
  }

  if (typeof endDate !== "string" || endDate === "") {
    return { ok: false, error: "終了日を入力してください" }
  }

  if (endDate < startDate) {
    return { ok: false, error: "終了日は開始日以降にしてください" }
  }

  const reasonValue = formData.get("reason")

  const reason =
    typeof reasonValue === "string" && reasonValue.trim() !== "" ? reasonValue.trim() : null

  const updated = await updateLeaveRequest(leaveRequestId, {
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
  })

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/leave")

  return { ok: true, error: null }
}

// 休暇申請取り下げ Server Action。leave_request_id 必須。
// 成功時は /leave を revalidate して一覧へ反映する。
export async function cancelLeaveRequestAction(
  previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  await requireAuth()

  const leaveRequestId = toPositiveIntId(formData.get("leave_request_id"))

  if (leaveRequestId === null) {
    return { ok: false, error: "休暇申請を特定できませんでした" }
  }

  const cancelled = await cancelLeaveRequest(leaveRequestId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/leave")

  return { ok: true, error: null }
}

// leave_type の FormData 値を許可値へ。不正値は null。
function toLeaveType(value: FormDataEntryValue | null): LeaveType | null {
  if (value === "annual" || value === "special") {
    return value
  }

  return null
}
