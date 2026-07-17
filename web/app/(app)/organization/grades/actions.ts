"use server"

import { revalidatePath } from "next/cache"
import { createGrade } from "@/lib/api/create-grade"
import { deleteGrade } from "@/lib/api/delete-grade"
import { getMe } from "@/lib/api/get-me"
import { updateGrade } from "@/lib/api/update-grade"
import {
  FORM_CONSTRAINTS,
  toOptionalText,
  toRequiredIntInRange,
  toRequiredText,
} from "@/lib/form/constraints"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManageGrades } from "@/lib/grade/can-manage-grades"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type GradeActionState = {
  ok: boolean
  error: string | null
}

// フォーム入力を検証済みの GradeCreateRequest 相当へ変換する。失敗時は Error。
function toGradeInput(formData: FormData) {
  const code = toRequiredText(formData.get("code"), {
    label: "コード",
    max: FORM_CONSTRAINTS.grade.codeMax,
  })

  if (code instanceof Error) {
    return code
  }

  const name = toRequiredText(formData.get("name"), {
    label: "名称",
    max: FORM_CONSTRAINTS.grade.nameMax,
  })

  if (name instanceof Error) {
    return name
  }

  const rank = toRequiredIntInRange(formData.get("rank"), {
    label: "ランク",
    min: FORM_CONSTRAINTS.grade.rankMin,
    max: FORM_CONSTRAINTS.grade.rankMax,
  })

  if (rank instanceof Error) {
    return rank
  }

  const description = toOptionalText(formData.get("description"), {
    label: "説明",
    max: FORM_CONSTRAINTS.grade.descriptionMax,
  })

  if (description instanceof Error) {
    return description
  }

  return { code, name, rank, description: description ?? undefined }
}

// 等級作成 Server Action。code/name/rank 必須、description は任意。
export async function createGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageGrades(currentUser.permissions) === false) {
    return { ok: false, error: "等級を管理する権限がありません" }
  }

  const input = toGradeInput(formData)

  if (input instanceof Error) {
    return { ok: false, error: input.message }
  }

  const grade = await createGrade(input)

  if (grade instanceof Error) {
    return { ok: false, error: grade.message }
  }

  revalidatePath("/organization/grades")

  return { ok: true, error: null }
}

// 等級変更 Server Action。gradeId 必須。
export async function updateGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageGrades(currentUser.permissions) === false) {
    return { ok: false, error: "等級を管理する権限がありません" }
  }

  const gradeId = toPositiveIntId(formData.get("gradeId"))

  if (gradeId === null) {
    return { ok: false, error: "等級 ID が不正です" }
  }

  const input = toGradeInput(formData)

  if (input instanceof Error) {
    return { ok: false, error: input.message }
  }

  const grade = await updateGrade(gradeId, input)

  if (grade instanceof Error) {
    return { ok: false, error: grade.message }
  }

  revalidatePath("/organization/grades")

  return { ok: true, error: null }
}

// 等級削除 Server Action。gradeId 必須。
export async function deleteGradeAction(
  previousState: GradeActionState,
  formData: FormData,
): Promise<GradeActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageGrades(currentUser.permissions) === false) {
    return { ok: false, error: "等級を管理する権限がありません" }
  }

  const gradeId = toPositiveIntId(formData.get("gradeId"))

  if (gradeId === null) {
    return { ok: false, error: "等級 ID が不正です" }
  }

  const deleted = await deleteGrade(gradeId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/organization/grades")

  return { ok: true, error: null }
}
