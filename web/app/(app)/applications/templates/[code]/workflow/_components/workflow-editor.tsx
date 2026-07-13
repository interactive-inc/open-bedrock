"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import {
  saveWorkflowAction,
  type WorkflowFormState,
} from "@/app/(app)/applications/templates/[code]/workflow/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  ApplicationWorkflow,
  ApplicationWorkflowStep,
  WorkflowApproverSelector,
} from "@/lib/api/types/application-workflow-types"

const initialState: WorkflowFormState = { ok: false, error: null }
const defaultStep = (index: number): ApplicationWorkflowStep => ({
  key: `approval_${index + 1}`,
  name: `承認ステップ ${index + 1}`,
  approvers: [{ type: "direct_manager" }],
  approval_mode: "any",
  condition_mode: "all",
  conditions: [],
  due_days: null,
  escalation_approvers: [],
  rejection_behavior: "return",
  allow_delegation: true,
})

export function WorkflowEditor(props: { code: string; initial: ApplicationWorkflow }) {
  const [workflow, setWorkflow] = useState(props.initial)
  const [advanced, setAdvanced] = useState(JSON.stringify(props.initial, null, 2))
  const [state, action, pending] = useActionState(
    async (previous: WorkflowFormState, data: FormData) => {
      const next = await saveWorkflowAction(previous, data)
      if (next.ok) toast.success("承認フローを保存しました")
      else if (next.error !== null) toast.error(next.error)
      return next
    },
    initialState,
  )

  function commit(next: ApplicationWorkflow) {
    setWorkflow(next)
    setAdvanced(JSON.stringify(next, null, 2))
  }

  function updateStep(index: number, nextStep: ApplicationWorkflowStep) {
    commit({ ...workflow, steps: workflow.steps.map((step, i) => (i === index ? nextStep : step)) })
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={props.code} />
      <input type="hidden" name="workflow_json" value={advanced} />

      {workflow.steps.map((step, index) => (
        <Card key={`${step.key}-${index}`}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ステップ {index + 1}</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => {
                  const steps = [...workflow.steps]
                  ;[steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]
                  commit({ ...workflow, steps })
                }}
              >
                上へ
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={workflow.steps.length === 1}
                onClick={() =>
                  commit({ ...workflow, steps: workflow.steps.filter((_, i) => i !== index) })
                }
              >
                削除
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>表示名</FieldLabel>
              <Input
                value={step.name}
                onChange={(event) => updateStep(index, { ...step, name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>ステップキー</FieldLabel>
              <Input
                value={step.key}
                pattern="[A-Za-z0-9_-]+"
                onChange={(event) => updateStep(index, { ...step, key: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>完了条件</FieldLabel>
              <NativeSelect
                value={step.approval_mode}
                onChange={(event) =>
                  updateStep(index, {
                    ...step,
                    approval_mode: event.target.value as ApplicationWorkflowStep["approval_mode"],
                  })
                }
              >
                <NativeSelectOption value="any">いずれか1人</NativeSelectOption>
                <NativeSelectOption value="all">全員</NativeSelectOption>
                <NativeSelectOption value="minimum">指定人数</NativeSelectOption>
              </NativeSelect>
            </Field>
            {step.approval_mode === "minimum" ? (
              <Field>
                <FieldLabel>必要人数</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={step.minimum_approvals ?? 1}
                  onChange={(event) =>
                    updateStep(index, { ...step, minimum_approvals: Number(event.target.value) })
                  }
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel>期限（日）</FieldLabel>
              <Input
                type="number"
                min={0}
                max={365}
                value={step.due_days ?? ""}
                placeholder="期限なし"
                onChange={(event) =>
                  updateStep(index, {
                    ...step,
                    due_days: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>否認時</FieldLabel>
              <NativeSelect
                value={step.rejection_behavior}
                onChange={(event) =>
                  updateStep(index, {
                    ...step,
                    rejection_behavior: event.target.value as "reject" | "return",
                  })
                }
              >
                <NativeSelectOption value="return">申請者へ差戻し</NativeSelectOption>
                <NativeSelectOption value="reject">申請を却下</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field orientation="horizontal" className="md:col-span-2">
              <div>
                <FieldLabel htmlFor={`delegation-${index}`}>代理承認</FieldLabel>
                <FieldDescription>期間付き委任をこのステップで利用します。</FieldDescription>
              </div>
              <Switch
                id={`delegation-${index}`}
                checked={step.allow_delegation}
                onCheckedChange={(checked) =>
                  updateStep(index, { ...step, allow_delegation: checked })
                }
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>承認者</FieldLabel>
              <div className="flex flex-col gap-2">
                {step.approvers.map((selector, selectorIndex) => (
                  <ApproverRow
                    key={selectorIndex}
                    selector={selector}
                    onChange={(next) =>
                      updateStep(index, {
                        ...step,
                        approvers: step.approvers.map((item, i) =>
                          i === selectorIndex ? next : item,
                        ),
                      })
                    }
                    onDelete={() =>
                      updateStep(index, {
                        ...step,
                        approvers: step.approvers.filter((_, i) => i !== selectorIndex),
                      })
                    }
                    canDelete={step.approvers.length > 1}
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateStep(index, {
                      ...step,
                      approvers: [...step.approvers, { type: "direct_manager" }],
                    })
                  }
                >
                  承認者を追加
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          commit({ ...workflow, steps: [...workflow.steps, defaultStep(workflow.steps.length)] })
        }
      >
        ステップを追加
      </Button>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">
          詳細設定（条件分岐・エスカレーション・JSON）
        </summary>
        <Field className="mt-4">
          <FieldLabel htmlFor="workflow-advanced">ワークフロー定義</FieldLabel>
          <FieldDescription>
            payload／申請者属性の条件、期限後の承認者など全項目を編集できます。
          </FieldDescription>
          <Textarea
            id="workflow-advanced"
            className="min-h-96 font-mono text-xs"
            value={advanced}
            onChange={(event) => setAdvanced(event.target.value)}
          />
        </Field>
      </details>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
      <Button type="submit" disabled={pending}>
        {pending ? "保存中..." : "承認フローを保存"}
      </Button>
    </form>
  )
}

function ApproverRow(props: {
  selector: WorkflowApproverSelector
  onChange: (selector: WorkflowApproverSelector) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const value =
    props.selector.type === "role"
      ? props.selector.role_key
      : props.selector.type === "employee"
        ? props.selector.employee_code
        : ""
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <NativeSelect
        value={props.selector.type}
        onChange={(event) => {
          const type = event.target.value as WorkflowApproverSelector["type"]
          props.onChange(
            type === "role"
              ? { type, role_key: "" }
              : type === "employee"
                ? { type, employee_code: "" }
                : { type },
          )
        }}
      >
        <NativeSelectOption value="direct_manager">直属上司</NativeSelectOption>
        <NativeSelectOption value="department_manager">部門責任者</NativeSelectOption>
        <NativeSelectOption value="management_chain">上位管理職全員</NativeSelectOption>
        <NativeSelectOption value="role">IAMロール</NativeSelectOption>
        <NativeSelectOption value="employee">従業員指定</NativeSelectOption>
      </NativeSelect>
      {props.selector.type === "role" || props.selector.type === "employee" ? (
        <Input
          aria-label={props.selector.type === "role" ? "ロールキー" : "従業員コード"}
          placeholder={props.selector.type === "role" ? "role_key" : "E001"}
          value={value}
          onChange={(event) =>
            props.onChange(
              props.selector.type === "role"
                ? { type: "role", role_key: event.target.value }
                : { type: "employee", employee_code: event.target.value },
            )
          }
        />
      ) : (
        <div />
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!props.canDelete}
        onClick={props.onDelete}
      >
        削除
      </Button>
    </div>
  )
}
