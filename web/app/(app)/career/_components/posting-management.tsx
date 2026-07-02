"use client"

import Link from "next/link"
import { useActionState } from "react"
import { deleteCareerPostingAction } from "@/app/(app)/career/actions"
import { Button } from "@/components/ui/button"
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
          render={<Link href={`/career/postings/${props.posting.id}/edit`} />}
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

// 公募を削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeletePostingButton(props: DeleteProps) {
  const [state, formAction, pending] = useActionState(deleteCareerPostingAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="posting_id" value={props.postingId ?? ""} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </form>
  )
}
