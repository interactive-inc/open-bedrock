"use server"

import { revalidatePath } from "next/cache"
import { advanceRecruitmentCandidate } from "@/lib/api/advance-recruitment-candidate"
import type { CandidateStage } from "@/lib/api/advance-recruitment-candidate"
import { createRecruitmentCandidate } from "@/lib/api/create-recruitment-candidate"
import { createRecruitmentPosition } from "@/lib/api/create-recruitment-position"

// useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。
export type RecruitmentActionState = {
  ok: boolean
  error: string | null
}

const STAGES: ReadonlyArray<CandidateStage> = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
]

// 募集ポジションの作成 Server Action。title 必須。recruitment:manage が無いと api が 403。
export async function createPositionAction(
  previousState: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const title = toText(formData.get("title"))

  if (title === null) {
    return { ok: false, error: "募集タイトルを入力してください" }
  }

  const created = await createRecruitmentPosition({
    title: title,
    department_code: toText(formData.get("department_code")),
    note: toText(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/recruitments")

  return { ok: true, error: null }
}

// 応募者の登録 Server Action。position_id/name 必須。recruitment:manage が無いと api が 403。
export async function createCandidateAction(
  previousState: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const positionId = toPositiveInt(formData.get("position_id"))

  const name = toText(formData.get("name"))

  if (positionId === null || name === null) {
    return { ok: false, error: "応募者名を入力してください" }
  }

  const created = await createRecruitmentCandidate({
    positionId: positionId,
    name: name,
    email: toText(formData.get("email")),
    source: toText(formData.get("source")),
    note: toText(formData.get("note")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath(`/organization/recruitments/${positionId}`)

  return { ok: true, error: null }
}

// 選考ステージの前進 Server Action。candidate_id/stage 必須。不正遷移は api が 409。
export async function advanceCandidateAction(
  previousState: RecruitmentActionState,
  formData: FormData,
): Promise<RecruitmentActionState> {
  const candidateId = toPositiveInt(formData.get("candidate_id"))

  const positionId = toPositiveInt(formData.get("position_id"))

  const stage = toStage(formData.get("stage"))

  if (candidateId === null || stage === null) {
    return { ok: false, error: "遷移先のステージが不正です" }
  }

  const advanced = await advanceRecruitmentCandidate({ candidateId: candidateId, stage: stage })

  if (advanced instanceof Error) {
    return { ok: false, error: advanced.message }
  }

  if (positionId !== null) {
    revalidatePath(`/organization/recruitments/${positionId}`)
  }

  return { ok: true, error: null }
}

// FormData 値を文字列へ。未入力や空白のみは null。
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

// FormData 値を正の整数へ。不正値は null。
function toPositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = Number.parseInt(value, 10)

  if (Number.isInteger(parsed) === false || parsed <= 0) {
    return null
  }

  return parsed
}

// FormData 値を許容ステージへ。未知値は null。
function toStage(value: FormDataEntryValue | null): CandidateStage | null {
  if (typeof value !== "string") {
    return null
  }

  const found = STAGES.find((stage) => stage === value)

  return found ?? null
}
