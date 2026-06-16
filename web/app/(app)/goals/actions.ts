"use server"

import { revalidatePath } from "next/cache"
import { createGoal } from "@/lib/api/create-goal"
import { createGoalEvaluation } from "@/lib/api/create-goal-evaluation"
import { deleteGoal } from "@/lib/api/delete-goal"
import type { GoalEvaluationKind } from "@/lib/api/types/goal-types"
import { updateGoal } from "@/lib/api/update-goal"
import {
  FORM_CONSTRAINTS,
  toOptionalIntInRange,
  toOptionalText,
  toRequiredText,
} from "@/lib/form/constraints"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

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
  const period = toRequiredText(formData.get("period"), {
    label: "期間",
    max: FORM_CONSTRAINTS.goal.periodMax,
  })

  if (period instanceof Error) {
    return { ok: false, error: period.message }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.goal.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const weight = toOptionalIntInRange(formData.get("weight"), {
    label: "ウェイト",
    min: FORM_CONSTRAINTS.goal.weightMin,
    max: FORM_CONSTRAINTS.goal.weightMax,
  })

  if (weight instanceof Error) {
    return { ok: false, error: weight.message }
  }

  const kpi = toOptionalText(formData.get("kpi"), {
    label: "KPI",
    max: FORM_CONSTRAINTS.goal.kpiMax,
  })

  if (kpi instanceof Error) {
    return { ok: false, error: kpi.message }
  }

  const goal = await createGoal({ period, title, weight: weight ?? 10, kpi: kpi ?? undefined })

  if (goal instanceof Error) {
    return { ok: false, error: goal.message }
  }

  revalidatePath("/goals")
  revalidatePath("/goals/[id]", "page")

  return { ok: true, error: null }
}

// 目標変更 Server Action。goalId/period/title 必須、weight/kpi は任意。
// 本人以外や確定評価済みは api がエラーを返す。成功時は /goals を revalidate する。
export async function updateGoalAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toPositiveIntId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const period = toRequiredText(formData.get("period"), {
    label: "期間",
    max: FORM_CONSTRAINTS.goal.periodMax,
  })

  if (period instanceof Error) {
    return { ok: false, error: period.message }
  }

  const title = toRequiredText(formData.get("title"), {
    label: "タイトル",
    max: FORM_CONSTRAINTS.goal.titleMax,
  })

  if (title instanceof Error) {
    return { ok: false, error: title.message }
  }

  const weight = toOptionalIntInRange(formData.get("weight"), {
    label: "ウェイト",
    min: FORM_CONSTRAINTS.goal.weightMin,
    max: FORM_CONSTRAINTS.goal.weightMax,
  })

  if (weight instanceof Error) {
    return { ok: false, error: weight.message }
  }

  const kpi = toOptionalText(formData.get("kpi"), {
    label: "KPI",
    max: FORM_CONSTRAINTS.goal.kpiMax,
  })

  if (kpi instanceof Error) {
    return { ok: false, error: kpi.message }
  }

  const goal = await updateGoal(goalId, {
    period,
    title,
    weight: weight ?? 10,
    kpi: kpi ?? undefined,
  })

  if (goal instanceof Error) {
    return { ok: false, error: goal.message }
  }

  revalidatePath("/goals")
  revalidatePath("/goals/[id]", "page")

  return { ok: true, error: null }
}

// 目標削除 Server Action。goalId 必須。成功時は /goals を revalidate する。
export async function deleteGoalAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toPositiveIntId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const deleted = await deleteGoal(goalId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/goals")
  revalidatePath("/goals/[id]", "page")

  return { ok: true, error: null }
}

// 評価登録 Server Action。kind 必須、score/comment は任意。goalId は hidden で渡す。
// 成功時は /goals を revalidate して一覧のステータスへ反映する。
export async function createGoalEvaluationAction(
  previousState: GoalActionState,
  formData: FormData,
): Promise<GoalActionState> {
  const goalId = toPositiveIntId(formData.get("goalId"))

  if (goalId === null) {
    return { ok: false, error: "目標 ID が不正です" }
  }

  const kind = formData.get("kind")

  if (typeof kind !== "string" || !isEvaluationKind(kind)) {
    return { ok: false, error: "評価種別を選択してください" }
  }

  const score = toOptionalIntInRange(formData.get("score"), {
    label: "スコア",
    min: FORM_CONSTRAINTS.goal.scoreMin,
    max: FORM_CONSTRAINTS.goal.scoreMax,
  })

  if (score instanceof Error) {
    return { ok: false, error: score.message }
  }

  const comment = toOptionalText(formData.get("comment"), {
    label: "コメント",
    max: FORM_CONSTRAINTS.goal.commentMax,
  })

  if (comment instanceof Error) {
    return { ok: false, error: comment.message }
  }

  const evaluation = await createGoalEvaluation({
    goalId,
    request: { kind, score: score ?? undefined, comment: comment ?? undefined },
  })

  if (evaluation instanceof Error) {
    return { ok: false, error: evaluation.message }
  }

  revalidatePath("/goals")
  revalidatePath("/goals/[id]", "page")

  return { ok: true, error: null }
}

// 評価種別が許可値かを判定する型ガード。
function isEvaluationKind(value: string): value is GoalEvaluationKind {
  return value === "self" || value === "manager" || value === "final"
}
