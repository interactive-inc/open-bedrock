"use server"

import { revalidatePath } from "next/cache"
import { createGoal } from "@/lib/api/create-goal"
import { createGoalEvaluation } from "@/lib/api/create-goal-evaluation"
import { deleteGoal } from "@/lib/api/delete-goal"
import type { GoalEvaluationKind } from "@/lib/api/types/goal-types"
import { updateGoal } from "@/lib/api/update-goal"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type GoalActionState = {
  ok: boolean
  error: string | null
}

// 目標作成 Server Action。period/title 必須、weight/kpi は任意。
// 成功時は /goals を revalidate して一覧へ反映する。
export async function createGoalAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const period = formData.get("period")

  const title = formData.get("title")

  if (typeof period !== "string" || period === "") {
    return { ok: false, error: "期間を入力してください" }
  }

  if (typeof title !== "string" || title === "") {
    return { ok: false, error: "タイトルを入力してください" }
  }

  const weight = toWeight(formData.get("weight"))

  const kpiValue = formData.get("kpi")

  const kpi = typeof kpiValue === "string" && kpiValue !== "" ? kpiValue : undefined

  const goal = await createGoal({ period, title, weight, kpi })

  if (goal instanceof Error) {
    return { ok: false, error: "目標の作成に失敗しました" }
  }

  revalidatePath("/goals")

  return { ok: true, error: null }
}

// 目標変更 Server Action。goalId/period/title 必須、weight/kpi は任意。
// 本人以外や確定評価済みは api がエラーを返す。成功時は /goals を revalidate する。
export async function updateGoalAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toGoalId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const period = formData.get("period")

  const title = formData.get("title")

  if (typeof period !== "string" || period === "") {
    return { ok: false, error: "期間を入力してください" }
  }

  if (typeof title !== "string" || title === "") {
    return { ok: false, error: "タイトルを入力してください" }
  }

  const weight = toWeight(formData.get("weight"))

  const kpiValue = formData.get("kpi")

  const kpi = typeof kpiValue === "string" && kpiValue !== "" ? kpiValue : undefined

  const goal = await updateGoal(goalId, { period, title, weight, kpi })

  if (goal instanceof Error) {
    return { ok: false, error: "目標の変更に失敗しました" }
  }

  revalidatePath("/goals")

  return { ok: true, error: null }
}

// 目標削除 Server Action。goalId 必須。成功時は /goals を revalidate する。
export async function deleteGoalAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toGoalId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const deleted = await deleteGoal(goalId)

  if (deleted instanceof Error) {
    return { ok: false, error: "目標の削除に失敗しました" }
  }

  revalidatePath("/goals")

  return { ok: true, error: null }
}

// 評価登録 Server Action。kind 必須、score/comment は任意。goalId は hidden で渡す。
// 成功時は /goals を revalidate して一覧のステータスへ反映する。
export async function createGoalEvaluationAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toGoalId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const kind = formData.get("kind")

  if (typeof kind !== "string" || !isEvaluationKind(kind)) {
    return { ok: false, error: "評価種別を選択してください" }
  }

  const score = toScore(formData.get("score"))

  const commentValue = formData.get("comment")

  const comment = typeof commentValue === "string" && commentValue !== "" ? commentValue : null

  const evaluation = await createGoalEvaluation({
    goalId,
    request: { kind, score: score ?? undefined, comment: comment ?? undefined },
  })

  if (evaluation instanceof Error) {
    return { ok: false, error: "評価の登録に失敗しました" }
  }

  revalidatePath("/goals")

  return { ok: true, error: null }
}

// weight の FormData 値を数値へ。未入力や不正値は api 既定の 10 を使う。
function toWeight(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || value === "") {
    return 10
  }

  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return 10
  }

  return parsed
}

// score の FormData 値を数値へ。未入力や不正値は null。
function toScore(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}

// goalId の FormData 値を整数へ。不正値は null。
function toGoalId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value === "") {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed)) {
    return null
  }

  return parsed
}

// 評価種別が許可値かを判定する型ガード。
function isEvaluationKind(value: string): value is GoalEvaluationKind {
  return value === "self" || value === "manager" || value === "final"
}
