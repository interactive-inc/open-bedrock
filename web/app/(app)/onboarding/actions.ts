"use server"

import { revalidatePath } from "next/cache"
import { postOnboardingAssign } from "@/lib/api/post-onboarding-assign"
import { postOnboardingTaskComplete } from "@/lib/api/post-onboarding-task-complete"

export type AssignState = {
  ok: boolean
  message: string | null
}

// オンボーディング割当の Server Action。useActionState から呼ばれる。
// 成功時は employee 画面を再検証し、結果メッセージを state に返す。
export async function assignOnboardingAction(
  previousState: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const employeeCode = formData.get("employee_code")

  const templateCode = formData.get("template_code")

  if (typeof employeeCode !== "string" || employeeCode === "") {
    return { ok: false, message: "社員コードを入力してください" }
  }

  if (typeof templateCode !== "string" || templateCode === "") {
    return { ok: false, message: "テンプレートを選択してください" }
  }

  const assignment = await postOnboardingAssign({ employeeCode, templateCode })

  if (assignment instanceof Error) {
    return { ok: false, message: "割当に失敗しました" }
  }

  revalidatePath(`/onboarding/employee/${employeeCode}`)

  revalidatePath("/onboarding")

  return { ok: true, message: `${assignment.employee_name} に割り当てました` }
}

export type CompleteState = {
  ok: boolean
  message: string | null
}

// タスク完了の Server Action。useActionState から呼ばれる。
// taskId は hidden input で受け取り、成功時に自分のタスク画面を再検証する。
export async function completeOnboardingTaskAction(
  previousState: CompleteState,
  formData: FormData,
): Promise<CompleteState> {
  const rawTaskId = formData.get("task_id")

  if (typeof rawTaskId !== "string" || rawTaskId === "") {
    return { ok: false, message: "タスクが不明です" }
  }

  const taskId = Number(rawTaskId)

  if (!Number.isInteger(taskId)) {
    return { ok: false, message: "タスクIDが不正です" }
  }

  const task = await postOnboardingTaskComplete(taskId)

  if (task instanceof Error) {
    return { ok: false, message: "完了処理に失敗しました" }
  }

  revalidatePath("/onboarding/me")

  revalidatePath("/onboarding")

  return { ok: true, message: `「${task.title}」を完了しました` }
}
