"use server"

import { revalidatePath } from "next/cache"
import { approveApplication } from "@/lib/api/approve-application"
import { rejectApplication } from "@/lib/api/reject-application"

export type DecisionState = {
  ok: boolean
  error: string | null
}

// applicationId フォーム値を正の整数へ変換する。無効なら null。
function toApplicationId(rawId: FormDataEntryValue | null): number | null {
  if (typeof rawId !== "string") {
    return null
  }

  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
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
export async function decideApplicationAction(
  previousState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const applicationId = toApplicationId(formData.get("application_id"))

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
