"use server"

import { revalidatePath } from "next/cache"
import { cancelOnboardingAssignment } from "@/lib/api/cancel-onboarding-assignment"
import { createOnboardingTemplate } from "@/lib/api/create-onboarding-template"
import { deleteOnboardingTemplate } from "@/lib/api/delete-onboarding-template"
import { postOnboardingAssign } from "@/lib/api/post-onboarding-assign"
import { postOnboardingTaskComplete } from "@/lib/api/post-onboarding-task-complete"
import { postOnboardingTaskUncomplete } from "@/lib/api/post-onboarding-task-uncomplete"
import { updateOnboardingAssignment } from "@/lib/api/update-onboarding-assignment"
import { updateOnboardingTemplate } from "@/lib/api/update-onboarding-template"
import {
  type LifecycleEffect,
  removeLifecycleTemplateBinding,
  updateLifecycleTemplateBinding,
} from "@/lib/api/update-lifecycle-template-binding"
import type { OnboardingKind } from "@/lib/api/types/onboarding-types"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { requireAuth } from "@/lib/auth/require-auth"

export type AssignState = {
  ok: boolean
  message: string | null
}

// オンボーディング割当の Server Action。useActionState から呼ばれる。
// 成功時は employee 画面を再検証し、結果メッセージを state に返す。
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function assignOnboardingAction(
  previousState: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

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
    return { ok: false, message: assignment.message }
  }

  revalidatePath(`/onboarding/employee/${employeeCode}`)

  revalidatePath("/onboarding")

  revalidatePath("/onboarding/assignments/new")

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
  await requireAuth()

  const rawTaskId = formData.get("task_id")

  if (typeof rawTaskId !== "string" || rawTaskId === "") {
    return { ok: false, message: "タスクが不明です" }
  }

  const taskId = toPositiveIntId(rawTaskId)

  if (taskId === null) {
    return { ok: false, message: "タスクIDが不正です" }
  }

  const task = await postOnboardingTaskComplete(taskId)

  if (task instanceof Error) {
    return { ok: false, message: task.message }
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
  await requireAuth()

  const rawTaskId = formData.get("task_id")

  if (typeof rawTaskId !== "string" || rawTaskId === "") {
    return { ok: false, message: "タスクが不明です" }
  }

  const taskId = toPositiveIntId(rawTaskId)

  if (taskId === null) {
    return { ok: false, message: "タスクIDが不正です" }
  }

  const task = await postOnboardingTaskUncomplete(taskId)

  if (task instanceof Error) {
    return { ok: false, message: task.message }
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
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function rescheduleOnboardingAssignmentAction(
  previousState: AssignmentMutationState,
  formData: FormData,
): Promise<AssignmentMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const rawId = formData.get("assignment_id")

  const assignedAt = formData.get("assigned_at")

  const employeeCode = formData.get("employee_code")

  if (typeof rawId !== "string" || rawId === "") {
    return { ok: false, message: "割り当てを特定できませんでした" }
  }

  const assignmentId = toPositiveIntId(rawId)

  if (assignmentId === null) {
    return { ok: false, message: "割り当てIDが不正です" }
  }

  if (typeof assignedAt !== "string" || assignedAt === "") {
    return { ok: false, message: "割当日を入力してください" }
  }

  const updated = await updateOnboardingAssignment(assignmentId, assignedAt)

  if (updated instanceof Error) {
    return { ok: false, message: updated.message }
  }

  if (typeof employeeCode === "string" && employeeCode !== "") {
    revalidatePath(`/onboarding/employee/${employeeCode}`)
  }

  revalidatePath("/onboarding")

  return { ok: true, message: "割当日を変更しました" }
}

// 割り当てを取り消す Server Action。assignment_id を受け取り、成功時に社員画面を再検証する。
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function cancelOnboardingAssignmentAction(
  previousState: AssignmentMutationState,
  formData: FormData,
): Promise<AssignmentMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const rawId = formData.get("assignment_id")

  const employeeCode = formData.get("employee_code")

  if (typeof rawId !== "string" || rawId === "") {
    return { ok: false, message: "割り当てを特定できませんでした" }
  }

  const assignmentId = toPositiveIntId(rawId)

  if (assignmentId === null) {
    return { ok: false, message: "割り当てIDが不正です" }
  }

  const cancelled = await cancelOnboardingAssignment(assignmentId)

  if (cancelled instanceof Error) {
    return { ok: false, message: cancelled.message }
  }

  if (typeof employeeCode === "string" && employeeCode !== "") {
    revalidatePath(`/onboarding/employee/${employeeCode}`)
  }

  revalidatePath("/onboarding")

  return { ok: true, message: "割り当てを取り消しました" }
}

export type TemplateMutationState = {
  ok: boolean
  message: string | null
}

// kind の文字列を join / leave に正規化する。不正値は null。
function parseKind(value: FormDataEntryValue | null): OnboardingKind | null {
  if (value === "join") {
    return "join"
  }

  if (value === "leave") {
    return "leave"
  }

  return null
}

// FormData から code / name / kind / description を取り出す。不足時は null。
function readTemplateForm(formData: FormData): {
  code: string
  name: string
  kind: OnboardingKind
  description: string | null
} | null {
  const code = formData.get("code")

  const name = formData.get("name")

  const kind = parseKind(formData.get("kind"))

  const description = formData.get("description")

  if (typeof code !== "string" || code === "" || typeof name !== "string" || name === "") {
    return null
  }

  if (kind === null) {
    return null
  }

  return {
    code,
    name,
    kind,
    description: typeof description === "string" && description !== "" ? description : null,
  }
}

// テンプレート作成の Server Action（管理権限）。成功時に一覧を再検証する。
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function createOnboardingTemplateAction(
  previousState: TemplateMutationState,
  formData: FormData,
): Promise<TemplateMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const input = readTemplateForm(formData)

  if (input === null) {
    return { ok: false, message: "コード・名称・種別を入力してください" }
  }

  const created = await createOnboardingTemplate(input)

  if (created instanceof Error) {
    return { ok: false, message: created.message }
  }

  revalidatePath("/onboarding")

  revalidatePath("/onboarding/templates")

  return { ok: true, message: `${created.name} を作成しました` }
}

// テンプレート変更の Server Action（管理権限）。code は hidden input で受け取り変更しない。
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function updateOnboardingTemplateAction(
  previousState: TemplateMutationState,
  formData: FormData,
): Promise<TemplateMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const input = readTemplateForm(formData)

  if (input === null) {
    return { ok: false, message: "名称・種別を入力してください" }
  }

  const updated = await updateOnboardingTemplate(input.code, {
    name: input.name,
    kind: input.kind,
    description: input.description,
  })

  if (updated instanceof Error) {
    return { ok: false, message: updated.message }
  }

  revalidatePath("/onboarding")

  revalidatePath("/onboarding/templates")

  return { ok: true, message: `${updated.name} を変更しました` }
}

// テンプレート削除の Server Action（管理権限）。code を hidden input で受け取る。
// Server Action は直接呼べるため認証と権限を二重に検査する（defense-in-depth）。
export async function deleteOnboardingTemplateAction(
  previousState: TemplateMutationState,
  formData: FormData,
): Promise<TemplateMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const code = formData.get("code")

  if (typeof code !== "string" || code === "") {
    return { ok: false, message: "テンプレートを特定できませんでした" }
  }

  const deleted = await deleteOnboardingTemplate(code)

  if (deleted instanceof Error) {
    return { ok: false, message: deleted.message }
  }

  revalidatePath("/onboarding")

  revalidatePath("/onboarding/templates")

  return { ok: true, message: "テンプレートを削除しました" }
}

export async function bindLifecycleTemplateAction(
  previousState: TemplateMutationState,
  formData: FormData,
): Promise<TemplateMutationState> {
  const me = await requireAuth()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    return { ok: false, message: "権限がありません" }
  }

  const code = formData.get("code")
  const rawEffect = formData.get("effect")
  const operation = formData.get("operation")
  const effect: LifecycleEffect | null =
    rawEffect === "hire" || rawEffect === "retired" ? rawEffect : null

  if (typeof code !== "string" || code === "" || effect === null) {
    return { ok: false, message: "連携対象を特定できませんでした" }
  }

  if (operation === "remove") {
    const removed = await removeLifecycleTemplateBinding(code)
    if (removed instanceof Error) return { ok: false, message: removed.message }
    revalidatePath("/onboarding/templates")
    revalidatePath("/onboarding")
    return { ok: true, message: `${effect === "hire" ? "入社" : "退職"}連携を解除しました` }
  }

  const binding = await updateLifecycleTemplateBinding(code, effect)

  if (binding instanceof Error) {
    return { ok: false, message: binding.message }
  }

  revalidatePath("/onboarding/templates")
  revalidatePath("/onboarding")

  return {
    ok: true,
    message: `${effect === "hire" ? "入社" : "退職"}イベントと連携しました`,
  }
}
