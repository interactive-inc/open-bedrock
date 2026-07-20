"use server"

import { revalidatePath } from "next/cache"
import { createMeeting } from "@/lib/api/create-meeting"
import { createMeetingMinutes } from "@/lib/api/create-meeting-minutes"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type MeetingActionState = {
  ok: boolean
  error: string | null
}

/** 会議体作成 Server Action。code/name 必須、cadence/description は任意。meeting:manage が無いと api が 403。 */
export async function createMeetingAction(
  previousState: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const code = toText(formData.get("code"))

  const name = toText(formData.get("name"))

  if (code === null || name === null) {
    return { ok: false, error: "コードと名称を入力してください" }
  }

  const created = await createMeeting({
    code: code,
    name: name,
    cadence: toText(formData.get("cadence")),
    description: toText(formData.get("description")),
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/meetings")

  return { ok: true, error: null }
}

/** 議事録記録 Server Action。meeting_code/held_on/title/body_md 必須。書けるのは全認証者。 */
export async function createMeetingMinutesAction(
  previousState: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const code = toText(formData.get("meeting_code"))

  const heldOn = toText(formData.get("held_on"))

  const title = toText(formData.get("title"))

  const bodyMd = toText(formData.get("body_md"))

  if (code === null || heldOn === null || title === null || bodyMd === null) {
    return { ok: false, error: "会議体・開催日・タイトル・本文を入力してください" }
  }

  const created = await createMeetingMinutes(code, {
    held_on: heldOn,
    title: title,
    attendees: toText(formData.get("attendees")),
    body_md: bodyMd,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath(`/organization/meetings/${code}`)

  return { ok: true, error: null }
}

/** FormData 値を文字列へ。未入力や空白のみは null。 */
function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
