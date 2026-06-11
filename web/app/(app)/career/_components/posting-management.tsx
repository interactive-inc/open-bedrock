"use client"

import { useActionState, useState } from "react"
import { deleteCareerPostingAction, updateCareerPostingAction } from "@/app/(app)/career/actions"
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
import type { CareerPosting } from "@/lib/api/types/career-types"

type Props = {
  posting: CareerPosting
}

// 公募の管理操作（変更 Dialog と削除）。管理ロールにのみ表示する。
export function PostingManagement(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <UpdatePostingDialog posting={props.posting} />

      <DeletePostingButton postingId={props.posting.id} />
    </div>
  )
}

// 公募変更フォームを Dialog で開く。title・部署・必要スキル・状態を編集する。
function UpdatePostingDialog(props: { posting: CareerPosting }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateCareerPostingAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>公募を変更</DialogTitle>

          <DialogDescription>内容と状態を更新します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="posting_id" value={props.posting.id ?? ""} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_posting_title">公募名</FieldLabel>

              <Input id="update_posting_title" name="title" defaultValue={props.posting.title} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_posting_dept_id">部署ID</FieldLabel>

              <Input
                id="update_posting_dept_id"
                name="dept_id"
                type="number"
                defaultValue={props.posting.dept_id ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_posting_dept_name">部署名</FieldLabel>

              <Input
                id="update_posting_dept_name"
                name="dept_name"
                defaultValue={props.posting.dept_name ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_posting_skills">必要スキル</FieldLabel>

              <Input
                id="update_posting_skills"
                name="required_skills"
                defaultValue={props.posting.required_skills ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_posting_status">状態</FieldLabel>

              <select
                id="update_posting_status"
                name="status"
                defaultValue={props.posting.status}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="open">募集中</option>

                <option value="closed">締切</option>
              </select>
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

// 公募を削除するボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeletePostingButton(props: { postingId: number | null }) {
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

      {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
