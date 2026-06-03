"use client"

import { useActionState, useState } from "react"
import {
  cancelAntisocialCheckAction,
  updateAntisocialCheckAction,
} from "@/app/(app)/antisocial-checks/actions"
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
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AntisocialCheckResponse } from "@/lib/api/types/antisocial-check-types"

type Props = {
  antisocialChecks: ReadonlyArray<AntisocialCheckResponse>
}

// 自分の反社チェック申請一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。
export function MyAntisocialChecksList(props: Props) {
  if (props.antisocialChecks.length === 0) {
    return <p className="text-sm text-muted-foreground">反社チェック申請はありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>取引先名</TableHead>
          <TableHead>所在地</TableHead>
          <TableHead>代表者名</TableHead>
          <TableHead>判定結果</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.antisocialChecks.map((antisocialCheck) => (
          <TableRow key={antisocialCheck.id}>
            <TableCell className="font-medium">{antisocialCheck.partner_name}</TableCell>

            <TableCell>{antisocialCheck.partner_address ?? "-"}</TableCell>

            <TableCell>{antisocialCheck.representative_name ?? "-"}</TableCell>

            <TableCell>{antisocialCheck.result ?? "-"}</TableCell>

            <TableCell>{antisocialCheck.status}</TableCell>

            <TableCell>
              <div className="flex justify-end gap-2">
                <UpdateAntisocialCheckDialog antisocialCheck={antisocialCheck} />

                <CancelAntisocialCheckButton antisocialCheckId={antisocialCheck.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// 反社チェック申請変更フォームを Dialog で開く。取引先情報と判定結果を編集して送信する。
function UpdateAntisocialCheckDialog(props: { antisocialCheck: AntisocialCheckResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateAntisocialCheckAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>反社チェック申請を変更</DialogTitle>

          <DialogDescription>取引先情報と判定結果を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="antisocial_check_id" value={props.antisocialCheck.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_partner_name">取引先名</FieldLabel>

              <Input
                id="update_partner_name"
                name="partner_name"
                defaultValue={props.antisocialCheck.partner_name}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_partner_address">所在地</FieldLabel>

              <Input
                id="update_partner_address"
                name="partner_address"
                defaultValue={props.antisocialCheck.partner_address ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_representative_name">代表者名</FieldLabel>

              <Input
                id="update_representative_name"
                name="representative_name"
                defaultValue={props.antisocialCheck.representative_name ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_result">判定結果</FieldLabel>

              <Input
                id="update_result"
                name="result"
                defaultValue={props.antisocialCheck.result ?? ""}
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

// 反社チェック申請取消ボタン。Server Action を呼び、成功時はリストが revalidate される。
function CancelAntisocialCheckButton(props: { antisocialCheckId: string }) {
  const [state, formAction, pending] = useActionState(cancelAntisocialCheckAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="antisocial_check_id" value={props.antisocialCheckId} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        取消
      </Button>
    </form>
  )
}
