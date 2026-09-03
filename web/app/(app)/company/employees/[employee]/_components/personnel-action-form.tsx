"use client"

import { submitPersonnelAction } from "@/app/(app)/company/employees/[employee]/actions"
import type { PersonnelActionFormState } from "@/app/(app)/company/employees/[employee]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { PositionResponse } from "@/lib/api/types/position-types"
import { useActionState, useState } from "react"
import { toast } from "sonner"

const initialState: PersonnelActionFormState = { ok: false, error: null }
const selectClassName =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

const actions = [
  ["primary_assignment_started", "配属"],
  ["transferred", "異動"],
  ["concurrent_assignment_started", "兼務開始"],
  ["assignment_ended", "所属終了"],
  ["position_changed", "役職変更"],
  ["manager_changed", "上司変更"],
  ["department_responsibility_started", "部署責任者就任"],
  ["department_responsibility_ended", "部署責任者退任"],
  ["leave_started", "休職"],
  ["returned", "復職"],
  ["retired", "退職"],
  ["rehire", "再入社"],
] as const

type ActionKind = (typeof actions)[number][0]

export function PersonnelActionForm(props: {
  employeeCode: string
  employeeRevision: number
  organizationRevision: number
  canRequest: boolean
  canApply: boolean
  positions: ReadonlyArray<PositionResponse>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ActionKind>("transferred")
  const [mode, setMode] = useState<"apply" | "request">(props.canApply ? "apply" : "request")
  const needsDepartment = !["leave_started", "returned", "retired"].includes(kind)
  const needsAssignment = ["assignment_ended", "position_changed", "manager_changed"].includes(kind)
  const needsPosition = [
    "primary_assignment_started",
    "transferred",
    "concurrent_assignment_started",
    "position_changed",
    "rehire",
  ].includes(kind)
  const needsManager = [
    "primary_assignment_started",
    "transferred",
    "concurrent_assignment_started",
    "manager_changed",
    "rehire",
  ].includes(kind)
  async function reduce(previous: PersonnelActionFormState, form: FormData) {
    const result = await submitPersonnelAction(previous, form)
    if (result.ok) {
      toast.success(
        form.get("mode") === "apply" ? "人事発令を確定しました" : "人事変更を申請しました",
      )
      setOpen(false)
    } else if (result.error) toast.error(result.error)
    return result
  }
  const [state, action, pending] = useActionState(reduce, initialState)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>人事変更</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overscroll-contain overflow-y-auto">
        <DialogHeader>
          <DialogTitle>人事変更</DialogTitle>
          <DialogDescription>有効日付きの発令として、申請または直接確定します。</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="employee_code" value={props.employeeCode} />
          <input type="hidden" name="employee_revision" value={props.employeeRevision} />
          <input type="hidden" name="organization_revision" value={props.organizationRevision} />
          <FieldGroup>
            <Field>
              <FieldLabel id="personnel-mode-label" htmlFor="personnel-mode">
                処理方法
              </FieldLabel>
              <select
                id="personnel-mode"
                name="mode"
                aria-labelledby="personnel-mode-label"
                className={selectClassName}
                value={mode}
                onChange={(event) => setMode(event.target.value as "apply" | "request")}
              >
                {props.canRequest ? <option value="request">承認を申請</option> : null}
                {props.canApply ? <option value="apply">直接確定</option> : null}
              </select>
            </Field>
            <Field>
              <FieldLabel id="personnel-kind-label" htmlFor="personnel-kind">
                変更種別
              </FieldLabel>
              <select
                id="personnel-kind"
                name="kind"
                aria-labelledby="personnel-kind-label"
                className={selectClassName}
                value={kind}
                onChange={(event) => setKind(event.target.value as ActionKind)}
              >
                {actions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="personnel-date">発令日</FieldLabel>
              <Input id="personnel-date" name="event_on" type="date" autoComplete="off" required />
            </Field>
            {needsDepartment ? (
              <Field>
                <FieldLabel htmlFor="personnel-department">
                  部署コード{kind === "rehire" ? "（任意）" : ""}
                </FieldLabel>
                <Input
                  id="personnel-department"
                  name="department_code"
                  placeholder="例: D003…"
                  autoComplete="off"
                  spellCheck={false}
                  required={kind !== "rehire"}
                />
                <FieldDescription>組織図の変更されない部署コードを指定します。</FieldDescription>
              </Field>
            ) : null}
            {needsAssignment ? (
              <Field>
                <FieldLabel id="personnel-assignment-label" htmlFor="personnel-assignment">
                  所属区分
                </FieldLabel>
                <select
                  id="personnel-assignment"
                  name="assignment_type"
                  aria-labelledby="personnel-assignment-label"
                  className={selectClassName}
                  defaultValue="primary"
                >
                  <option value="primary">主所属</option>
                  <option value="concurrent">兼務</option>
                </select>
              </Field>
            ) : null}
            {needsPosition ? (
              <Field>
                <FieldLabel id="personnel-position-label" htmlFor="personnel-position">
                  役職{kind === "position_changed" ? "" : "（任意）"}
                </FieldLabel>
                <select
                  id="personnel-position"
                  name="position_code"
                  aria-labelledby="personnel-position-label"
                  className={selectClassName}
                  defaultValue=""
                  required={kind === "position_changed"}
                >
                  <option value="">役職なし</option>
                  {props.positions.map((position) => (
                    <option key={position.id} value={position.code}>
                      {position.name}
                    </option>
                  ))}
                </select>
                <FieldDescription>役職マスタから選びます。</FieldDescription>
              </Field>
            ) : null}
            {needsManager ? (
              <Field>
                <FieldLabel htmlFor="personnel-manager">直属上司コード（任意）</FieldLabel>
                <Input
                  id="personnel-manager"
                  name="manager_employee_code"
                  placeholder="例: E004…"
                  autoComplete="off"
                  spellCheck={false}
                />
                {kind === "manager_changed" ? (
                  <FieldDescription>空欄のまま確定すると直属上司を解除します。</FieldDescription>
                ) : null}
              </Field>
            ) : null}
            {kind === "position_changed" ? (
              <Field>
                <FieldLabel id="personnel-change-type-label" htmlFor="personnel-change-type">
                  役職変更区分
                </FieldLabel>
                <select
                  id="personnel-change-type"
                  name="change_type"
                  aria-labelledby="personnel-change-type-label"
                  className={selectClassName}
                  defaultValue="lateral"
                >
                  <option value="promotion">昇格</option>
                  <option value="demotion">降格</option>
                  <option value="lateral">横移動</option>
                  <option value="other">その他</option>
                </select>
              </Field>
            ) : null}
            {state.error ? (
              <div aria-live="polite">
                <FieldError>{state.error}</FieldError>
              </div>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "処理中…" : mode === "apply" ? "人事発令を確定" : "承認を申請"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
