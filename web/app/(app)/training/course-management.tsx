"use client"

import { useActionState, useState } from "react"
import {
  archiveTrainingCourseAction,
  updateTrainingCourseAction,
} from "@/app/(app)/training/actions"
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
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

type Props = {
  course: TrainingCourseResponse
}

// コース詳細の管理操作（変更 Dialog とアーカイブ）。特権ロールにのみ表示する。
export function CourseManagement(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <UpdateCourseDialog course={props.course} />

      {props.course.status === "active" ? <ArchiveCourseButton code={props.course.code} /> : null}
    </div>
  )
}

// コース変更フォームを Dialog で開く。タイトル・カテゴリ・説明・所要時間・必須を編集する。
function UpdateCourseDialog(props: { course: TrainingCourseResponse }) {
  const [open, setOpen] = useState(false)

  const [state, formAction, pending] = useActionState(updateTrainingCourseAction, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>コースを変更</DialogTitle>

          <DialogDescription>コードと状態は変更されません。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.course.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_title">コース名</FieldLabel>

              <Input id="update_title" name="title" defaultValue={props.course.title} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_category">カテゴリ</FieldLabel>

              <Input id="update_category" name="category" defaultValue={props.course.category} />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_description">説明</FieldLabel>

              <Input
                id="update_description"
                name="description"
                defaultValue={props.course.description ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_duration">所要時間（分）</FieldLabel>

              <Input
                id="update_duration"
                name="duration_minutes"
                type="number"
                defaultValue={props.course.duration_minutes ?? ""}
              />
            </Field>

            <Field orientation="horizontal">
              <input
                id="update_required"
                name="is_required"
                type="checkbox"
                className="size-4"
                defaultChecked={props.course.is_required}
              />

              <FieldLabel htmlFor="update_required">必須コースにする</FieldLabel>
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

// コースをアーカイブするボタン。Server Action を呼び、成功時は detail が revalidate される。
function ArchiveCourseButton(props: { code: string }) {
  const [state, formAction, pending] = useActionState(archiveTrainingCourseAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        アーカイブ
      </Button>

      {state.error === null ? null : <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}
