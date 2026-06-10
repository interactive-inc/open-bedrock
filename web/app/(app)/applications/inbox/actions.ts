"use server"

import { revalidatePath } from "next/cache"
import { approveApplication } from "@/lib/api/approve-application"
import { getMe } from "@/lib/api/get-me"
import { rejectApplication } from "@/lib/api/reject-application"
import { canDecideApplication } from "@/lib/application/can-decide-application"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type DecisionState = {
  ok: boolean
  error: string | null
}

// 承認処理。コメント任意。
async function approve(applicationId: number, comment: string | null): Promise<DecisionState> {
  const decided = await approveApplication(applicationId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: "承認に失敗しました" }
  }

  return { ok: true, error: null }
}

// 却下処理。コメント必須。
async function reject(applicationId: number, comment: string | null): Promise<DecisionState> {
  if (comment === null) {
    return { ok: false, error: "却下理由を入力してください" }
  }

  const decided = await rejectApplication(applicationId, comment)

  if (decided instanceof Error) {
    return { ok: false, error: "却下に失敗しました" }
  }

  return { ok: true, error: null }
}

// 承認/却下を 1 つにまとめた Server Action。decision フィールドで分岐し、成功時は inbox を再検証する。
// Server Action は直接呼べるため getMe のロールで二重に弾く（defense-in-depth）。
export async function decideApplicationAction(
  previousState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const me = await getMe()

  if (me instanceof Error || !canDecideApplication(me.role)) {
    return { ok: false, error: "権限がありません" }
  }

  const applicationId = toPositiveIntId(formData.get("application_id"))

  if (applicationId === null) {
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
      ? await approve(applicationId, comment)
      : await reject(applicationId, comment)

  if (!result.ok) {
    return result
  }

  revalidatePath("/applications/inbox")

  return result
}
