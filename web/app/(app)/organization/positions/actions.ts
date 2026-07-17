"use server"

import { revalidatePath } from "next/cache"
import { createPosition } from "@/lib/api/create-position"
import { deletePosition } from "@/lib/api/delete-position"
import { getMe } from "@/lib/api/get-me"
import { updatePosition } from "@/lib/api/update-position"
import {
  FORM_CONSTRAINTS,
  toOptionalText,
  toRequiredIntInRange,
  toRequiredText,
} from "@/lib/form/constraints"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"
import { canManagePositions } from "@/lib/position/can-manage-positions"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type PositionActionState = {
  ok: boolean
  error: string | null
}

// フォーム入力を検証済みの PositionCreateRequest 相当へ変換する。失敗時は Error。
function toPositionInput(formData: FormData) {
  const code = toRequiredText(formData.get("code"), {
    label: "コード",
    max: FORM_CONSTRAINTS.position.codeMax,
  })

  if (code instanceof Error) {
    return code
  }

  const name = toRequiredText(formData.get("name"), {
    label: "名称",
    max: FORM_CONSTRAINTS.position.nameMax,
  })

  if (name instanceof Error) {
    return name
  }

  const rank = toRequiredIntInRange(formData.get("rank"), {
    label: "ランク",
    min: FORM_CONSTRAINTS.position.rankMin,
    max: FORM_CONSTRAINTS.position.rankMax,
  })

  if (rank instanceof Error) {
    return rank
  }

  const description = toOptionalText(formData.get("description"), {
    label: "説明",
    max: FORM_CONSTRAINTS.position.descriptionMax,
  })

  if (description instanceof Error) {
    return description
  }

  return { code, name, rank, description: description ?? undefined }
}

// 役職作成 Server Action。code/name/rank 必須、description は任意。
export async function createPositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePositions(currentUser.permissions) === false) {
    return { ok: false, error: "役職を管理する権限がありません" }
  }

  const input = toPositionInput(formData)

  if (input instanceof Error) {
    return { ok: false, error: input.message }
  }

  const position = await createPosition(input)

  if (position instanceof Error) {
    return { ok: false, error: position.message }
  }

  revalidatePath("/organization/positions")

  return { ok: true, error: null }
}

// 役職変更 Server Action。positionId 必須。
export async function updatePositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePositions(currentUser.permissions) === false) {
    return { ok: false, error: "役職を管理する権限がありません" }
  }

  const positionId = toPositiveIntId(formData.get("positionId"))

  if (positionId === null) {
    return { ok: false, error: "役職 ID が不正です" }
  }

  const input = toPositionInput(formData)

  if (input instanceof Error) {
    return { ok: false, error: input.message }
  }

  const position = await updatePosition(positionId, input)

  if (position instanceof Error) {
    return { ok: false, error: position.message }
  }

  revalidatePath("/organization/positions")

  return { ok: true, error: null }
}

// 役職削除 Server Action。positionId 必須。
export async function deletePositionAction(
  previousState: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManagePositions(currentUser.permissions) === false) {
    return { ok: false, error: "役職を管理する権限がありません" }
  }

  const positionId = toPositiveIntId(formData.get("positionId"))

  if (positionId === null) {
    return { ok: false, error: "役職 ID が不正です" }
  }

  const deleted = await deletePosition(positionId)

  if (deleted instanceof Error) {
    return { ok: false, error: deleted.message }
  }

  revalidatePath("/organization/positions")

  return { ok: true, error: null }
}
