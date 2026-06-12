"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/review/actions"
import {
  closeReviewCycleAction,
  deleteReviewCycleAction,
  openReviewCycleAction,
} from "@/app/(app)/review/actions"
import { ReviewCycleEditForm } from "@/app/(app)/review/_components/review-cycle-edit-form"
import { toCycleStatusLabel } from "@/app/(app)/review/_lib/to-cycle-status-label"
import { toCycleStatusVariant } from "@/app/(app)/review/_lib/to-cycle-status-variant"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"

type Props = {
  cycles: Array<ReviewCycleResponse>
  canAdminister: boolean
}

const initialState: ReviewFormState = { ok: false, error: null }

// 評価サイクル一覧。各サイクルを Card で並べる。特権ロールには draft→open / open→closed の操作を出す。
// 開閉・削除の結果は action のラッパ内で toast() 通知する（レンダー本体・useEffect は使わない）。
export function ReviewCycleList(props: Props) {
  // 開始フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const openAction = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await openReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("サイクルを開始しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const openDispatch = openAction[1]

  const isOpening = openAction[2]

  // 終了フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const closeAction = useActionState(async (previousState: ReviewFormState, formData: FormData) => {
    const next = await closeReviewCycleAction(previousState, formData)

    if (next.ok) {
      toast.success("サイクルを終了しました")
    } else if (next.error !== null) {
      toast.error(next.error)
    }

    return next
  }, initialState)

  const closeDispatch = closeAction[1]

  const isClosing = closeAction[2]

  // 削除フォームのラッパ。action を1回だけ実行し、結果を toast して次状態を返す。
  const deleteAction = useActionState(
    async (previousState: ReviewFormState, formData: FormData) => {
      const next = await deleteReviewCycleAction(previousState, formData)

      if (next.ok) {
        toast.success("サイクルを削除しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const deleteDispatch = deleteAction[1]

  const isDeleting = deleteAction[2]

  if (props.cycles.length === 0) {
    return <p className="text-sm text-muted-foreground">評価サイクルはありません</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {props.cycles.map((cycle) => (
        <Card key={cycle.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{cycle.title}</span>

                <Badge variant={toCycleStatusVariant(cycle.status)}>
                  {toCycleStatusLabel(cycle.status)}
                </Badge>
              </div>

              <span className="text-xs text-muted-foreground">{cycle.period}</span>
            </div>
          </CardHeader>

          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">締切: {cycle.due_date ?? "-"}</span>

            {props.canAdminister ? (
              <div className="flex gap-2">
                {cycle.status === "draft" ? (
                  <form action={openDispatch}>
                    <input type="hidden" name="cycle_id" value={cycle.id} />

                    <Button type="submit" variant="secondary" size="sm" disabled={isOpening}>
                      開始する
                    </Button>
                  </form>
                ) : null}

                {cycle.status === "open" ? (
                  <form action={closeDispatch}>
                    <input type="hidden" name="cycle_id" value={cycle.id} />

                    <Button type="submit" variant="outline" size="sm" disabled={isClosing}>
                      終了する
                    </Button>
                  </form>
                ) : null}

                <Dialog>
                  <DialogTrigger
                    render={<Button type="button" variant="outline" size="sm" data-icon="edit" />}
                  >
                    編集
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>評価サイクルを編集</DialogTitle>
                    </DialogHeader>

                    <ReviewCycleEditForm cycle={cycle} />
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        data-icon="trash"
                        disabled={isDeleting}
                      />
                    }
                  >
                    削除
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>評価サイクルを削除しますか？</AlertDialogTitle>

                      <AlertDialogDescription>
                        この操作は取り消せません。サイクル「{cycle.title}」を削除します。
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>

                      <form action={deleteDispatch}>
                        <input type="hidden" name="cycle_id" value={cycle.id} />

                        <AlertDialogAction type="submit">削除する</AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
