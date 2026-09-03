"use server"

import { revalidatePath } from "next/cache"
import { registerRegulation } from "@/lib/api/register-regulation"
import { addRegulationVersion } from "@/lib/api/add-regulation-version"
import { archiveRegulation } from "@/lib/api/archive-regulation"
import { getMe } from "@/lib/api/get-me"
import { canManageRegulations } from "@/lib/regulation/can-manage-regulations"

export type RegulationActionState = {
  ok: boolean
  error: string | null
}

/** 規程の新規登録 Server Action。code/title/body_md/effective_on 必須。 */
export async function registerRegulationAction(
  previousState: RegulationActionState,
  formData: FormData,
): Promise<RegulationActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRegulations(currentUser.permissions) === false) {
    return { ok: false, error: "規程を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  const title = toText(formData.get("title"))

  const bodyMd = toText(formData.get("body_md"))

  const effectiveOn = toText(formData.get("effective_on"))

  if (code === null || title === null || bodyMd === null || effectiveOn === null) {
    return { ok: false, error: "コード・タイトル・本文・施行日を入力してください" }
  }

  const registered = await registerRegulation({
    code: code,
    title: title,
    body_md: bodyMd,
    effective_on: effectiveOn,
    category: toOptional(formData.get("category")),
    note: toOptional(formData.get("note")),
  })

  if (registered instanceof Error) {
    return { ok: false, error: registered.message }
  }

  revalidatePath("/regulation/regulations")

  return { ok: true, error: null }
}

/** 規程へ新版を追加する Server Action。code は hidden。body_md/effective_on 必須。 */
export async function addRegulationVersionAction(
  previousState: RegulationActionState,
  formData: FormData,
): Promise<RegulationActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRegulations(currentUser.permissions) === false) {
    return { ok: false, error: "規程を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  const bodyMd = toText(formData.get("body_md"))

  const effectiveOn = toText(formData.get("effective_on"))

  if (code === null || bodyMd === null || effectiveOn === null) {
    return { ok: false, error: "本文・施行日を入力してください" }
  }

  const added = await addRegulationVersion(code, {
    body_md: bodyMd,
    effective_on: effectiveOn,
    note: toOptional(formData.get("note")),
  })

  if (added instanceof Error) {
    return { ok: false, error: added.message }
  }

  revalidatePath("/regulation/regulations")

  revalidatePath(`/regulation/regulations/${code}`)

  return { ok: true, error: null }
}

/** 規程アーカイブ Server Action。code は hidden。 */
export async function archiveRegulationAction(
  previousState: RegulationActionState,
  formData: FormData,
): Promise<RegulationActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageRegulations(currentUser.permissions) === false) {
    return { ok: false, error: "規程を管理する権限がありません" }
  }

  const code = toText(formData.get("code"))

  if (code === null) {
    return { ok: false, error: "規程を特定できませんでした" }
  }

  const archived = await archiveRegulation(code)

  if (archived instanceof Error) {
    return { ok: false, error: archived.message }
  }

  revalidatePath("/regulation/regulations")

  revalidatePath(`/regulation/regulations/${code}`)

  return { ok: true, error: null }
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}

function toOptional(value: FormDataEntryValue | null): string | undefined {
  const text = toText(value)

  return text === null ? undefined : text
}
