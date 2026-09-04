"use client"

import { useActionState } from "react"
import {
  archiveAnnouncementAction,
  publishAnnouncementAction,
} from "@/app/(app)/announcement/announcements/actions"
import type { AnnouncementActionState } from "@/app/(app)/announcement/announcements/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

const initialState: AnnouncementActionState = { ok: false, error: null }

type Props = {
  announcementId: number
  status: string
}

/**
 * アナウンスの公開・アーカイブ操作。管理者にのみ表示される。
 * 公開ボタンは draft のときだけ、アーカイブは archived 以外のときだけ出す。
 */
export function AnnouncementManageActions(props: Props) {
  const publish = useActionState(publishAnnouncementAction, initialState)

  const archive = useActionState(archiveAnnouncementAction, initialState)

  const publishState = publish[0]

  const publishAction = publish[1]

  const publishPending = publish[2]

  const archiveState = archive[0]

  const archiveAction = archive[1]

  const archivePending = archive[2]

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card border p-4">
      <div className="flex flex-wrap gap-4">
        {props.status === "draft" ? (
          <form action={publishAction}>
            <input type="hidden" name="announcement_id" value={props.announcementId} />

            <Button type="submit" disabled={publishPending}>
              {publishPending ? "公開中..." : "公開して全社へ通知"}
            </Button>
          </form>
        ) : null}

        {props.status === "archived" ? null : (
          <form action={archiveAction}>
            <input type="hidden" name="announcement_id" value={props.announcementId} />

            <Button type="submit" variant="secondary" disabled={archivePending}>
              {archivePending ? "アーカイブ中..." : "アーカイブ"}
            </Button>
          </form>
        )}
      </div>

      {publishState.error === null ? null : <FieldError>{publishState.error}</FieldError>}

      {archiveState.error === null ? null : <FieldError>{archiveState.error}</FieldError>}
    </div>
  )
}
