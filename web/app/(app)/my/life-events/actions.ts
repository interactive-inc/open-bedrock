"use server"

import { revalidatePath } from "next/cache"
import { approveLifeEvent } from "@/lib/api/approve-life-event"
import { cancelLifeEvent } from "@/lib/api/cancel-life-event"
import { createLifeEvent } from "@/lib/api/create-life-event"
import { getMe } from "@/lib/api/get-me"
import { rejectLifeEvent } from "@/lib/api/reject-life-event"
import { updateLifeEvent } from "@/lib/api/update-life-event"
import type { LifeEventType } from "@/lib/api/types/life-event-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { toOptionalText } from "@/lib/form/to-optional-text"
import { toRequiredIsoDate } from "@/lib/form/to-required-iso-date"
import { toRequiredText } from "@/lib/form/to-required-text"
import { canManageLifeEvents } from "@/lib/life-event/can-manage-life-events"
import { requireAuth } from "@/lib/auth/require-auth"

const LIFE_EVENT_TYPES: ReadonlyArray<LifeEventType> = [
  "marriage",
  "divorce",
  "childbirth",
  "relocation",
  "dependent_added",
  "dependent_removed",
]

const RELOCATION_REASON_LABELS: Record<string, string> = {
  relocation: "転居",
  resident_registration_change: "住民票の異動",
}

const CHILD_RELATIONSHIP_LABELS: Record<string, string> = {
  eldest_son: "長男",
  eldest_daughter: "長女",
  second_son: "次男",
  second_daughter: "次女",
  third_son: "三男",
  third_daughter: "三女",
}

const DEPENDENT_ADDED_REASON_LABELS: Record<string, string> = {
  marriage: "対象者との結婚",
  resignation: "対象者の退職",
  income_decrease: "対象者の収入減少",
}

const DEPENDENT_REMOVED_REASON_LABELS: Record<string, string> = {
  employment: "対象者の就職",
  divorce: "対象者との離婚",
  death: "対象者の死亡",
}

const DEPENDENT_RELATIONSHIP_LABELS: Record<string, string> = {
  husband: "夫",
  wife: "妻",
  eldest_son: "長男",
  eldest_daughter: "長女",
  second_son: "次男",
  second_daughter: "次女",
  father: "実父",
  mother: "実母",
  father_in_law: "義父",
  mother_in_law: "義母",
}

const DEPENDENT_OCCUPATION_LABELS: Record<string, string> = {
  unemployed: "無職",
  company_employee: "会社員",
  self_employed: "自営業",
}

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type LifeEventActionState = {
  ok: boolean
  error: string | null
}

/**
 * 人事がライフイベント届出を承認する Server Action。life_event_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function approveLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const id = toLifeEventIdText(formData.get("life_event_id"))

  if (id === null) {
    return { ok: false, error: "届出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageLifeEvents(currentUser.permissions) === false) {
    return { ok: false, error: "ライフイベント届出を管理する権限がありません" }
  }

  const approved = await approveLifeEvent(id)

  if (approved instanceof Error) {
    return { ok: false, error: approved.message }
  }

  revalidatePath("/organization/life-events")

  return { ok: true, error: null }
}

/**
 * 人事がライフイベント届出を却下する Server Action。life_event_id 必須。
 * permission を確認してから API を叩き、成功時は admin 一覧を revalidate する。
 */
export async function rejectLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  const id = toLifeEventIdText(formData.get("life_event_id"))

  if (id === null) {
    return { ok: false, error: "届出を特定できませんでした" }
  }

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageLifeEvents(currentUser.permissions) === false) {
    return { ok: false, error: "ライフイベント届出を管理する権限がありません" }
  }

  const rejected = await rejectLifeEvent(id)

  if (rejected instanceof Error) {
    return { ok: false, error: rejected.message }
  }

  revalidatePath("/organization/life-events")

  return { ok: true, error: null }
}

/** id 用の FormData 値を取り出す。未入力は null。 */
function toLifeEventIdText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

/**
 * ライフイベント届出作成 Server Action。event_type/event_date 必須、detail は任意。
 * 成功時は /life-events を revalidate して一覧へ反映する。
 */
export async function createLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

  const fields = toEventFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const created = await createLifeEvent(fields)

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

/** ライフイベント届出変更 Server Action。life_event_id 必須。本人以外の変更は api がエラーを返す。 */
export async function updateLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

  const lifeEventId = formData.get("life_event_id")

  if (typeof lifeEventId !== "string" || lifeEventId === "") {
    return { ok: false, error: "ライフイベント届出を特定できませんでした" }
  }

  const fields = toEventFields(formData)

  if (fields instanceof Error) {
    return { ok: false, error: fields.message }
  }

  const updated = await updateLifeEvent(lifeEventId, fields)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

/** ライフイベント届出取消 Server Action。life_event_id 必須。成功時は /life-events を revalidate する。 */
export async function cancelLifeEventAction(
  previousState: LifeEventActionState,
  formData: FormData,
): Promise<LifeEventActionState> {
  await requireAuth()

  const lifeEventId = formData.get("life_event_id")

  if (typeof lifeEventId !== "string" || lifeEventId === "") {
    return { ok: false, error: "ライフイベント届出を特定できませんでした" }
  }

  const cancelled = await cancelLifeEvent(lifeEventId)

  if (cancelled instanceof Error) {
    return { ok: false, error: cancelled.message }
  }

  revalidatePath("/my/life-events")

  return { ok: true, error: null }
}

type EventFields = {
  event_type: LifeEventType
  event_date: string
  detail: string | null
}

/** FormData からライフイベント届出の共通フィールドを取り出して検証する。不正時は Error。 */
function toEventFields(formData: FormData): EventFields | Error {
  const eventType = toLifeEventType(formData.get("event_type"))

  if (eventType === null) {
    return new Error("種別を選択してください")
  }

  const eventDate = toRequiredIsoDate(
    formData.get("event_date"),
    eventType === "relocation"
      ? "変更日"
      : eventType === "childbirth"
        ? "子の出生日"
        : eventType === "divorce"
          ? "氏名変更日"
          : eventType === "dependent_added" || eventType === "dependent_removed"
            ? "異動日"
            : "発生日",
  )

  if (eventDate instanceof Error) {
    return eventDate
  }

  const detail =
    eventType === "relocation"
      ? toRelocationDetail(formData)
      : eventType === "childbirth"
        ? toChildbirthDetail(formData)
        : eventType === "marriage"
          ? toMarriageDetail(formData)
          : eventType === "divorce"
            ? toDivorceDetail(formData)
            : eventType === "dependent_added" || eventType === "dependent_removed"
              ? toDependentDetail(formData, eventType === "dependent_added")
              : toGeneralDetail(formData)

  if (detail instanceof Error) {
    return detail
  }

  return {
    event_type: eventType,
    event_date: eventDate,
    detail: detail,
  }
}

/** 転居以外の種別の「詳細」欄。任意入力。 */
function toGeneralDetail(formData: FormData): string | null | Error {
  return toOptionalText(formData.get("detail"), {
    label: "詳細",
    max: FORM_CONSTRAINTS.lifeEvent.detailMax,
  })
}

/** 転居の変更理由・郵便番号・新住所・電話番号を1つの「詳細」文字列に合成する。 */
function toRelocationDetail(formData: FormData): string | Error {
  const reasonValue = formData.get("relocation_reason")

  const reasonLabel =
    typeof reasonValue === "string" ? RELOCATION_REASON_LABELS[reasonValue] : undefined

  const reason =
    reasonLabel ??
    toRequiredText(formData.get("relocation_reason_other"), { label: "その他の理由", max: 200 })

  if (reason instanceof Error) {
    return reason
  }

  const postalCode = toRequiredText(formData.get("postal_code"), { label: "郵便番号", max: 20 })

  if (postalCode instanceof Error) {
    return postalCode
  }

  const newAddress = toRequiredText(formData.get("new_address"), { label: "新住所", max: 500 })

  if (newAddress instanceof Error) {
    return newAddress
  }

  const phoneNumber = toRequiredText(formData.get("phone_number"), { label: "電話番号", max: 30 })

  if (phoneNumber instanceof Error) {
    return phoneNumber
  }

  return [
    `変更理由: ${reason}`,
    `郵便番号: ${postalCode}`,
    `新住所: ${newAddress}`,
    `電話番号: ${phoneNumber}`,
  ].join("\n")
}

/**
 * 出産の子の氏名・続柄・扶養義務・特別休暇/育児休業の取得意向を1つの「詳細」文字列に合成する。
 * 母子手帳・マイナンバー資料の添付は未対応（ファイルアップロード機能が無いため別途紙面/メールで提出）。
 */
function toChildbirthDetail(formData: FormData): string | Error {
  const nameKanji = toRequiredText(formData.get("child_name_kanji"), {
    label: "子の氏名（漢字）",
    max: 100,
  })

  if (nameKanji instanceof Error) {
    return nameKanji
  }

  const nameKana = toRequiredText(formData.get("child_name_kana"), {
    label: "子の氏名（フリガナ）",
    max: 100,
  })

  if (nameKana instanceof Error) {
    return nameKana
  }

  const relationshipValue = formData.get("child_relationship")

  const relationshipLabel =
    typeof relationshipValue === "string" ? CHILD_RELATIONSHIP_LABELS[relationshipValue] : undefined

  const relationship =
    relationshipLabel ??
    toRequiredText(formData.get("child_relationship_other"), { label: "続柄（その他）", max: 100 })

  if (relationship instanceof Error) {
    return relationship
  }

  const isDependent = formData.get("child_dependent") === "yes"

  const dependent = isDependent ? "あり" : "なし"

  const specialLeave =
    formData.get("childbirth_special_leave") === "yes" ? "取得する" : "取得しない"

  const childcareLeaveIntent = formData.get("childcare_leave_intent") === "yes" ? "ある" : "ない"

  const benefitMethod = isDependent
    ? formData.get("childbirth_benefit_method") === "direct_payment_used"
      ? "直接支払制度を利用した"
      : "直接支払制度を利用しなかった"
    : null

  const lines = [
    `子の氏名（漢字）: ${nameKanji}`,
    `子の氏名（フリガナ）: ${nameKana}`,
    `続柄: ${relationship}`,
    `子の扶養義務: ${dependent}`,
  ]

  if (benefitMethod !== null) {
    lines.push(`出産育児一時金の受給方法: ${benefitMethod}`)
  }

  lines.push(`出生に伴う特別休暇: ${specialLeave}`, `育児休業の取得希望: ${childcareLeaveIntent}`)

  return lines.join("\n")
}

/**
 * 結婚の変更後戸籍氏名（漢字・フリガナ、姓が変わる場合のみ任意入力）を「詳細」文字列に合成する。
 * 証明書の提出は不要（提出省略の合意済み）。両方未入力なら null。
 */
function toMarriageDetail(formData: FormData): string | null | Error {
  const nameKanji = toOptionalText(formData.get("marriage_new_name_kanji"), {
    label: "変更後 戸籍氏名（漢字）",
    max: 100,
  })

  if (nameKanji instanceof Error) {
    return nameKanji
  }

  const nameKana = toOptionalText(formData.get("marriage_new_name_kana"), {
    label: "変更後 戸籍氏名（フリガナ）",
    max: 100,
  })

  if (nameKana instanceof Error) {
    return nameKana
  }

  if (nameKanji === null && nameKana === null) {
    return null
  }

  const lines = []

  if (nameKanji !== null) {
    lines.push(`変更後 戸籍氏名（漢字）: ${nameKanji}`)
  }

  if (nameKana !== null) {
    lines.push(`変更後 戸籍氏名（フリガナ）: ${nameKana}`)
  }

  return lines.join("\n")
}

/** 離婚の変更後戸籍氏名（漢字・フリガナ、両方必須）を「詳細」文字列に合成する。 */
function toDivorceDetail(formData: FormData): string | Error {
  const nameKanji = toRequiredText(formData.get("divorce_new_name_kanji"), {
    label: "変更後 戸籍氏名（漢字）",
    max: 100,
  })

  if (nameKanji instanceof Error) {
    return nameKanji
  }

  const nameKana = toRequiredText(formData.get("divorce_new_name_kana"), {
    label: "変更後 戸籍氏名（フリガナ）",
    max: 100,
  })

  if (nameKana instanceof Error) {
    return nameKana
  }

  return [`変更後 戸籍氏名（漢字）: ${nameKanji}`, `変更後 戸籍氏名（フリガナ）: ${nameKana}`].join(
    "\n",
  )
}

/**
 * 扶養対象家族の追加/削除（扶養異動理由・対象家族の氏名・続柄・生年月日、追加時のみ資格確認書・職業・年収）
 * を1つの「詳細」文字列に合成する。
 */
function toDependentDetail(formData: FormData, isAdded: boolean): string | Error {
  const reasonValue = formData.get("dependent_reason")

  const reasonLabels = isAdded ? DEPENDENT_ADDED_REASON_LABELS : DEPENDENT_REMOVED_REASON_LABELS

  const reasonLabel = typeof reasonValue === "string" ? reasonLabels[reasonValue] : undefined

  const reason =
    reasonLabel ??
    toRequiredText(formData.get("dependent_reason_other"), {
      label: "扶養異動理由（その他）",
      max: 200,
    })

  if (reason instanceof Error) {
    return reason
  }

  const nameKanji = toRequiredText(formData.get("dependent_family_name_kanji"), {
    label: "対象家族の氏名（漢字）",
    max: 100,
  })

  if (nameKanji instanceof Error) {
    return nameKanji
  }

  const nameKana = toRequiredText(formData.get("dependent_family_name_kana"), {
    label: "対象家族の氏名（フリガナ）",
    max: 100,
  })

  if (nameKana instanceof Error) {
    return nameKana
  }

  const relationshipValue = formData.get("dependent_relationship")

  const relationshipLabel =
    typeof relationshipValue === "string"
      ? DEPENDENT_RELATIONSHIP_LABELS[relationshipValue]
      : undefined

  const relationship =
    relationshipLabel ??
    toRequiredText(formData.get("dependent_relationship_other"), {
      label: "続柄（その他）",
      max: 100,
    })

  if (relationship instanceof Error) {
    return relationship
  }

  const birthDate = toRequiredIsoDate(formData.get("dependent_birth_date"), "対象家族の生年月日")

  if (birthDate instanceof Error) {
    return birthDate
  }

  const lines = [
    `扶養異動理由: ${reason}`,
    `対象家族の氏名（漢字）: ${nameKanji}`,
    `対象家族の氏名（フリガナ）: ${nameKana}`,
    `続柄: ${relationship}`,
    `対象家族の生年月日: ${birthDate}`,
  ]

  if (isAdded) {
    const certificateNeeded =
      formData.get("dependent_certificate_needed") === "needed" ? "必要" : "不要"

    const occupationValue = formData.get("dependent_occupation")

    const occupationLabel =
      typeof occupationValue === "string" ? DEPENDENT_OCCUPATION_LABELS[occupationValue] : undefined

    const occupationOther = toOptionalText(formData.get("dependent_occupation_other"), {
      label: "扶養対象となる方の職業（その他）",
      max: 100,
    })

    if (occupationOther instanceof Error) {
      return occupationOther
    }

    const occupation = occupationLabel ?? occupationOther ?? "未回答"

    const annualIncome = toOptionalText(formData.get("dependent_annual_income"), {
      label: "扶養対象となる方の年収",
      max: 100,
    })

    if (annualIncome instanceof Error) {
      return annualIncome
    }

    lines.push(
      `健康保険 資格確認書の発行: ${certificateNeeded}`,
      `扶養対象となる方の職業: ${occupation}`,
    )

    if (annualIncome !== null) {
      lines.push(`扶養対象となる方の年収: ${annualIncome}`)
    }
  }

  return lines.join("\n")
}

/** event_type の FormData 値を許可値へ。不正値は null。 */
function toLifeEventType(value: FormDataEntryValue | null): LifeEventType | null {
  return LIFE_EVENT_TYPES.find((eventType) => eventType === value) ?? null
}
