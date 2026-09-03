"use client"

import { submitPersonnelAction } from "@/app/(app)/company/employees/[employee]/actions"
import type { PersonnelActionFormState } from "@/app/(app)/company/employees/[employee]/actions"
import {
  getAssignmentBaseRevisionsAction,
  searchTeamMemberCandidatesAction,
} from "@/app/(app)/teams/[team]/actions"
import type { AssignmentBaseRevisions } from "@/app/(app)/teams/[team]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { EmployeeCombobox } from "@/components/ui/employee-combobox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"
import type { PositionResponse } from "@/lib/api/types/position-types"
import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import { toast } from "sonner"

type Props = {
  teamCode: string
  positions: ReadonlyArray<PositionResponse>
}

const initialState: PersonnelActionFormState = { ok: false, error: null }

const selectClassName =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

/**
 * 部署ページから既存従業員をこの部署へ配属（主配属・兼務）する人事発令フォーム。
 * 対象部署は固定し、既存の直接発令 action（mode=apply）へ送る。
 */
export function TeamMemberAddForm(props: Props) {
  const router = useRouter()

  const [open, setOpen] = useState(false)

  const [employee, setEmployee] = useState<EmployeeListItem | null>(null)

  const [revisions, setRevisions] = useState<AssignmentBaseRevisions | null>(null)

  const handleEmployeeChange = (selected: EmployeeListItem | null) => {
    setEmployee(selected)

    setRevisions(null)

    if (selected !== null && selected.code !== null) {
      getAssignmentBaseRevisionsAction(selected.code)
        .then((revisions) => {
          setRevisions(revisions)
        })
        .catch(() => {
          toast.error("配属基準リビジョンの取得に失敗しました")
        })
    }
  }

  const reduce = async (previous: PersonnelActionFormState, formData: FormData) => {
    const result = await submitPersonnelAction(previous, formData)

    if (result.ok) {
      toast.success("配属の発令を登録しました")

      setOpen(false)

      setEmployee(null)

      router.refresh()
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const [state, formAction, isPending] = action

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">メンバーを追加</Button>} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>この部署へ配属する</DialogTitle>

          <DialogDescription>
            既存の従業員をこの部署へ配属する人事発令を登録します。新しい従業員の入社は従業員登録から行います。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <FieldGroup>
            <input type="hidden" name="mode" value="apply" />

            <input type="hidden" name="department_code" value={props.teamCode} />

            <input type="hidden" name="employee_code" value={employee?.code ?? ""} />

            <input
              type="hidden"
              name="employee_revision"
              value={revisions?.employeeRevision ?? ""}
            />

            <input
              type="hidden"
              name="organization_revision"
              value={revisions?.organizationRevision ?? ""}
            />

            <Field>
              <FieldLabel htmlFor="team-member-employee">対象の従業員</FieldLabel>

              <EmployeeCombobox
                id="team-member-employee"
                value={employee}
                onValueChange={handleEmployeeChange}
                searchEmployees={searchTeamMemberCandidatesAction}
                placeholder="氏名・コードで検索"
                disabled={isPending}
              />
            </Field>

            <Field>
              <FieldLabel id="team-member-kind-label" htmlFor="team-member-kind">
                配属の種別
              </FieldLabel>

              <select
                id="team-member-kind"
                name="kind"
                aria-labelledby="team-member-kind-label"
                className={selectClassName}
                defaultValue="primary_assignment_started"
              >
                <option value="primary_assignment_started">主配属</option>

                <option value="concurrent_assignment_started">兼務</option>
              </select>

              <FieldDescription>
                主所属を移す異動は従業員詳細の人事変更から行います。
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="team-member-event-on">発効日</FieldLabel>

              <Input id="team-member-event-on" name="event_on" type="date" required />
            </Field>

            <Field>
              <FieldLabel id="team-member-position-label" htmlFor="team-member-position">
                役職（任意）
              </FieldLabel>

              <select
                id="team-member-position"
                name="position_code"
                aria-labelledby="team-member-position-label"
                className={selectClassName}
                defaultValue=""
              >
                <option value="">役職なし</option>

                {props.positions.map((position) => (
                  <option key={position.id} value={position.code}>
                    {position.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="team-member-manager">直属上司コード（任意）</FieldLabel>

              <Input id="team-member-manager" name="manager_employee_code" placeholder="例: E004" />
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" disabled={isPending || employee === null || revisions === null}>
              配属を登録
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
