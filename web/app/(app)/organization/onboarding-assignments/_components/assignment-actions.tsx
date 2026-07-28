"use client"

import {
  cancelOnboardingAssignmentAction,
  rescheduleOnboardingAssignmentAction,
} from "@/app/(app)/organization/onboarding-assignments/actions"
import type { AssignmentMutationState } from "@/app/(app)/organization/onboarding-assignments/actions"
import { useFormAction } from "@/hooks/use-form-action"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"

type Props = {
  assignmentId: number
  employeeCode: string
  assignedAt: string
}

const initialState: AssignmentMutationState = { ok: false, message: null }

/** 割り当ての割当日変更と取り消しを行う操作群。特権ロールの社員画面で使う。 */
export function AssignmentActions(props: Props) {
  const reschedule = useFormAction(
    rescheduleOnboardingAssignmentAction,
    initialState,
    (state) => state.message ?? "割当日を変更しました",
  )

  const cancel = useFormAction(
    cancelOnboardingAssignmentAction,
    initialState,
    (state) => state.message ?? "割り当てを取り消しました",
  )

  return (
    <div className="flex flex-col gap-3">
      <form action={reschedule[1]} className="flex flex-col gap-2">
        <input type="hidden" name="assignment_id" value={props.assignmentId} />

        <input type="hidden" name="employee_code" value={props.employeeCode} />

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`assigned_at_${props.assignmentId}`}>割当日</FieldLabel>

            <Input
              id={`assigned_at_${props.assignmentId}`}
              name="assigned_at"
              defaultValue={props.assignedAt}
              required
            />
          </Field>

          {reschedule[0].ok === false && reschedule[0].message !== null ? (
            <FieldError>{reschedule[0].message}</FieldError>
          ) : null}

          {reschedule[0].ok && reschedule[0].message !== null ? (
            <p className="text-sm text-muted-foreground">{reschedule[0].message}</p>
          ) : null}

          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={reschedule[2]}
            className="w-fit"
          >
            {reschedule[2] ? "変更中..." : "割当日を変更"}
          </Button>
        </FieldGroup>
      </form>

      <AlertDialog>
        <AlertDialogTrigger
          render={<Button size="sm" variant="destructive" className="w-fit" disabled={cancel[2]} />}
        >
          割り当てを取り消す
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>割り当てを取り消しますか？</AlertDialogTitle>

            <AlertDialogDescription>
              この割り当てと配下のタスクがすべて削除されます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <form action={cancel[1]}>
              <input type="hidden" name="assignment_id" value={props.assignmentId} />

              <input type="hidden" name="employee_code" value={props.employeeCode} />

              <AlertDialogAction type="submit">取り消す</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cancel[0].ok === false && cancel[0].message !== null ? (
        <span className="text-xs text-destructive">{cancel[0].message}</span>
      ) : null}
    </div>
  )
}
