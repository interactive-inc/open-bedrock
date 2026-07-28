"use client"

import Link from "next/link"
import { deleteCareerPostingAction } from "@/app/(app)/my/career/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { FieldError } from "@/components/ui/field"
import type { CareerPosting } from "@/lib/api/types/career-types"

type Props = {
  posting: CareerPosting
}

/**
 * 公募の管理操作（編集ページ導線と削除）。管理ロールにのみ表示する。
 */
export function PostingManagement(props: Props) {
  return (
    <div className="flex items-center gap-2">
      {props.posting.id !== null ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/organization/job-postings/${props.posting.id}/edit`} />}
        >
          編集
        </Button>
      ) : null}

      <DeletePostingButton postingId={props.posting.id} />
    </div>
  )
}

type DeleteProps = {
  postingId: number | null
}

/** 公募を削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。 */
function DeletePostingButton(props: DeleteProps) {
  const [state, formAction, pending] = useFormAction(
    deleteCareerPostingAction,
    {
      ok: false,
      error: null,
    },
    "公募を削除しました",
  )

  return (
    <div className="flex flex-col gap-1">
      <ConfirmActionDialog
        action={formAction}
        triggerLabel="削除"
        title="この社内公募を削除しますか？"
        description="公募の記録は元に戻せません。"
        confirmLabel="公募を削除"
        pending={pending}
      >
        <input type="hidden" name="posting_id" value={props.postingId ?? ""} />
      </ConfirmActionDialog>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </div>
  )
}
