"use server"

import { revalidatePath } from "next/cache"
import { createAnnouncement } from "@/lib/api/create-announcement"
import { publishAnnouncement } from "@/lib/api/publish-announcement"
import { archiveAnnouncement } from "@/lib/api/archive-announcement"
import { getMe } from "@/lib/api/get-me"
import { canManageAnnouncements } from "@/lib/announcement/can-manage-announcements"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type AnnouncementActionState = {
  ok: boolean
  error: string | null
}

/** 社内アナウンス作成 Server Action。title/body_md 必須。成功時は /announcements を revalidate。 */
export async function createAnnouncementAction(
  previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAnnouncements(currentUser.permissions) === false) {
    return { ok: false, error: "アナウンスを管理する権限がありません" }
  }

  const title = toText(formData.get("title"))

  const bodyMd = toText(formData.get("body_md"))

  if (title === null || bodyMd === null) {
    return { ok: false, error: "タイトルと本文を入力してください" }
  }

  const created = await createAnnouncement({ title: title, body_md: bodyMd })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  revalidatePath("/organization/announcements")

  return { ok: true, error: null }
}

/** アナウンス公開 Server Action。id は hidden。成功時は全社通知が飛ぶ。 */
export async function publishAnnouncementAction(
  previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAnnouncements(currentUser.permissions) === false) {
    return { ok: false, error: "アナウンスを管理する権限がありません" }
  }

  const announcementId = toPositiveIntId(formData.get("announcement_id"))

  if (announcementId === null) {
    return { ok: false, error: "アナウンスを特定できませんでした" }
  }

  const published = await publishAnnouncement(announcementId)

  if (published instanceof Error) {
    return { ok: false, error: published.message }
  }

  revalidatePath("/organization/announcements")

  revalidatePath(`/organization/announcements/${announcementId}`)

  return { ok: true, error: null }
}

/** アナウンスアーカイブ Server Action。id は hidden。 */
export async function archiveAnnouncementAction(
  previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageAnnouncements(currentUser.permissions) === false) {
    return { ok: false, error: "アナウンスを管理する権限がありません" }
  }

  const announcementId = toPositiveIntId(formData.get("announcement_id"))

  if (announcementId === null) {
    return { ok: false, error: "アナウンスを特定できませんでした" }
  }

  const archived = await archiveAnnouncement(announcementId)

  if (archived instanceof Error) {
    return { ok: false, error: archived.message }
  }

  revalidatePath("/organization/announcements")

  revalidatePath(`/organization/announcements/${announcementId}`)

  return { ok: true, error: null }
}

function toText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  return value.trim()
}
