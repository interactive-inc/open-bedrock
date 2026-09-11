"use client"

import { startTransition, useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { releaseLicenseAssignmentAction } from "@/app/(app)/software-license/licenses/[license]/actions"
import type { LicenseActionState } from "@/app/(app)/software-license/licenses/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = { assignmentId: string; employeeName: string; serviceName: string }
const initial: LicenseActionState = { ok: false, error: null }

/** 対象者とサービスを確認して解除を記録し、利用開始の記録は保持する。 */
export function ReleaseAssignmentDialog(props: Props) {
  const open = useState(false)
  const reason = useState("")
  const router = useRouter()
  const action = useActionState(async (previous: LicenseActionState, form: FormData) => {
    const recorded = await releaseLicenseAssignmentAction(previous, form)
    if (recorded.ok) {
      open[1](false)
      toast.success("利用解除を記録しました")
      router.refresh()
    }
    return recorded
  }, initial)
  return (
    <Dialog open={open[0]} onOpenChange={open[1]}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>利用解除を記録</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>利用解除を記録</DialogTitle>
          <DialogDescription>
            {props.employeeName}さんの「{props.serviceName}
            」の利用解除を記録します。外部サービスのアカウントは変更されません。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            startTransition(() => action[1](form))
          }}
        >
          <input type="hidden" name="id" value={props.assignmentId} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`release-reason-${props.assignmentId}`}>解除理由</FieldLabel>
              <Textarea
                id={`release-reason-${props.assignmentId}`}
                name="reason"
                value={reason[0]}
                onChange={(event) => reason[1](event.target.value)}
                required
                maxLength={1000}
                disabled={action[2]}
              />
            </Field>
            {action[0].error === null ? null : <FieldError>{action[0].error}</FieldError>}
            <Field orientation="horizontal">
              <Button type="submit" disabled={action[2]}>
                {action[2] ? "記録中..." : "解除を記録する"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={action[2]}
                onClick={() => open[1](false)}
              >
                キャンセル
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
