"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import {
  updateApplicationAction,
  withdrawApplicationAction,
} from "@/app/(app)/applications/actions"
import type { ApplicationActionState } from "@/app/(app)/applications/actions"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApplicationListItem } from "@/lib/api/types/application-types"

type Props = {
  applications: ReadonlyArray<ApplicationListItem>
}

// 自分の申請一覧。承認待ちの申請には変更（Dialog フォーム）と取り下げボタンを置く表示コンポーネント。
export function MyApplicationsList(props: Props) {
  if (props.applications.length === 0) {
    return <p className="text-sm text-muted-foreground">提出済みの申請はまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>申請 ID</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>現在のステップ</TableHead>
          <TableHead>申請日</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell>
              <Link
                href={`/applications/${application.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {application.id}
              </Link>
            </TableCell>

            <TableCell>
              <ApplicationStatusBadge status={application.status} />
            </TableCell>

            <TableCell className="text-muted-foreground">
              {application.current_step ?? "-"}
            </TableCell>

            <TableCell className="text-muted-foreground">{application.created_at}</TableCell>

            <TableCell>
              <ApplicationRowActions application={application} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 承認待ちのときだけ変更・取り下げ操作を表示する。審査済みや未採番は操作不可。
function ApplicationRowActions(props: { application: ApplicationListItem }) {
  const applicationId = props.application.id

  if (props.application.status !== "pending" || applicationId === null) {
    return <span className="block text-right text-xs text-muted-foreground">操作不可</span>
  }

  return (
    <div className="flex justify-end gap-2">
      <UpdateApplicationDialog application={props.application} applicationId={applicationId} />

      <WithdrawApplicationButton applicationId={applicationId} />
    </div>
  )
}

// 申請内容の更新フォームを Dialog で開く。payload を JSON テキストで編集して送信する。
function UpdateApplicationDialog(props: {
  application: ApplicationListItem
  applicationId: number
}) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: ApplicationActionState,
    formData: FormData,
  ): Promise<ApplicationActionState> {
    const result = await updateApplicationAction(previousState, formData)

    if (result.ok) {
      setOpen(false)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>申請内容を変更</DialogTitle>

          <DialogDescription>申請内容（JSON）を編集します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="application_id" value={props.applicationId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_payload">申請内容（JSON）</FieldLabel>

              <Textarea
                id="update_payload"
                name="payload"
                rows={8}
                defaultValue={JSON.stringify(props.application.payload, null, 2)}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 申請取り下げボタン。Server Action を呼び、成功時はリストが revalidate される。
function WithdrawApplicationButton(props: { applicationId: number }) {
  const [_state, formAction, pending] = useActionState(withdrawApplicationAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="application_id" value={props.applicationId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取り下げ
      </Button>
    </form>
  )
}
