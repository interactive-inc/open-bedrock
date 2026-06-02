"use server"

import { revalidatePath } from "next/cache"
import { cancelOnboardingAssignment } from "@/lib/api/cancel-onboarding-assignment"
import { postOnboardingAssign } from "@/lib/api/post-onboarding-assign"
import { postOnboardingTaskComplete } from "@/lib/api/post-onboarding-task-complete"
import { postOnboardingTaskUncomplete } from "@/lib/api/post-onboarding-task-uncomplete"
import { updateOnboardingAssignment } from "@/lib/api/update-onboarding-assignment"

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

// タスク完了取り消しの Server Action。task_id を hidden input で受け取る。
// 成功時に自分のタスク画面と社員画面を再検証する。
export async function uncompleteOnboardingTaskAction(
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

  const task = await postOnboardingTaskUncomplete(taskId)

  if (task instanceof Error) {
    return { ok: false, message: "取り消しに失敗しました" }
  }

  revalidatePath("/onboarding/me")

  revalidatePath("/onboarding")

  return { ok: true, message: `「${task.title}」の完了を取り消しました` }
}

export type AssignmentMutationState = {
  ok: boolean
  message: string | null
}

// 割り当ての割当日を変更する Server Action。assignment_id と assigned_at を受け取る。
// 成功時に該当社員の画面を再検証する。
export async function rescheduleOnboardingAssignmentAction(
  previousState: AssignmentMutationState,
  formData: FormData,
): Promise<AssignmentMutationState> {
  const rawId = formData.get("assignment_id")

  const assignedAt = formData.get("assigned_at")

  const employeeCode = formData.get("employee_code")

  if (typeof rawId !== "string" || rawId === "") {
    return { ok: false, message: "割り当てを特定できませんでした" }
  }

  const assignmentId = Number(rawId)

  if (!Number.isInteger(assignmentId)) {
    return { ok: false, message: "割り当てIDが不正です" }
  }

  if (typeof assignedAt !== "string" || assignedAt === "") {
    return { ok: false, message: "割当日を入力してください" }
  }

  const updated = await updateOnboardingAssignment(assignmentId, assignedAt)

  if (updated instanceof Error) {
    return { ok: false, message: "割当日の変更に失敗しました" }
  }

  if (typeof employeeCode === "string" && employeeCode !== "") {
    revalidatePath(`/onboarding/employee/${employeeCode}`)
  }

  revalidatePath("/onboarding")

  return { ok: true, message: "割当日を変更しました" }
}

// 割り当てを取り消す Server Action。assignment_id を受け取り、成功時に社員画面を再検証する。
export async function cancelOnboardingAssignmentAction(
  previousState: AssignmentMutationState,
  formData: FormData,
): Promise<AssignmentMutationState> {
  const rawId = formData.get("assignment_id")

  const employeeCode = formData.get("employee_code")

  if (typeof rawId !== "string" || rawId === "") {
    return { ok: false, message: "割り当てを特定できませんでした" }
  }

  const assignmentId = Number(rawId)

  if (!Number.isInteger(assignmentId)) {
    return { ok: false, message: "割り当てIDが不正です" }
  }

  const cancelled = await cancelOnboardingAssignment(assignmentId)

  if (cancelled instanceof Error) {
    return { ok: false, message: "割り当ての取り消しに失敗しました" }
  }

  if (typeof employeeCode === "string" && employeeCode !== "") {
    revalidatePath(`/onboarding/employee/${employeeCode}`)
  }

  revalidatePath("/onboarding")

  return { ok: true, message: "割り当てを取り消しました" }
}
