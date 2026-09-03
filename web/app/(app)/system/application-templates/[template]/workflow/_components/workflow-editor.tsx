"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import {
  saveWorkflowAction,
  type WorkflowFormState,
} from "@/app/(app)/system/application-templates/[template]/workflow/actions"
import { parseWorkflowDefinitionJson } from "@/app/(app)/system/application-templates/[template]/workflow/_lib/workflow-definition"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  ApplicationWorkflow,
  ApplicationWorkflowStep,
  WorkflowApproverSelector,
} from "@/lib/api/types/application-workflow-types"

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

function firstAvailableDefaultStep(steps: ReadonlyArray<ApplicationWorkflowStep>) {
  const usedKeys = new Set(steps.map((step) => step.key))
  let index = 0

  while (usedKeys.has(`approval_${index + 1}`)) index += 1

  return defaultStep(index)
}

export function WorkflowEditor(props: {
  code: string
  initial: ApplicationWorkflow
  revision: number
}) {
  const [advanced, setAdvanced] = useState(() => JSON.stringify(props.initial, null, 2))
  const definition = parseWorkflowDefinitionJson(advanced)
  const workflow = definition.success ? definition.workflow : props.initial
  const definitionError = definition.success ? null : definition.error
  const [state, action, pending] = useActionState(
    async (previous: WorkflowFormState, data: FormData) => {
      const next = await saveWorkflowAction(previous, data)
      if (next.ok) toast.success("承認フローを保存しました")
      else if (next.error !== null) toast.error(next.error)
      return next
    },
    { ok: false, error: null, revision: props.revision },
  )

  function commit(next: ApplicationWorkflow) {
    setAdvanced(JSON.stringify(next, null, 2))
  }

  function updateStep(index: number, nextStep: ApplicationWorkflowStep) {
    commit({ ...workflow, steps: workflow.steps.map((step, i) => (i === index ? nextStep : step)) })
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={props.code} />
      <input type="hidden" name="workflow_json" value={advanced} />
      <input type="hidden" name="expected_revision" value={state.revision} />

      <FieldSet className="gap-4" disabled={definitionError !== null}>
        <FieldLegend className="sr-only">ワークフロー基本設定</FieldLegend>
        {workflow.steps.map((step, index) => (
          <Card key={step.key}>
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
                <FieldLabel htmlFor={`workflow-step-${index}-name`}>表示名</FieldLabel>
                <Input
                  id={`workflow-step-${index}-name`}
                  value={step.name}
                  onChange={(event) => updateStep(index, { ...step, name: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`workflow-step-${index}-key`}>ステップキー</FieldLabel>
                <Input
                  id={`workflow-step-${index}-key`}
                  value={step.key}
                  pattern="[A-Za-z0-9_-]+"
                  onChange={(event) => updateStep(index, { ...step, key: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`workflow-step-${index}-approval-mode`}>完了条件</FieldLabel>
                <NativeSelect
                  id={`workflow-step-${index}-approval-mode`}
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
                  <FieldLabel htmlFor={`workflow-step-${index}-minimum-approvals`}>
                    必要人数
                  </FieldLabel>
                  <Input
                    id={`workflow-step-${index}-minimum-approvals`}
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
                <FieldLabel htmlFor={`workflow-step-${index}-due-days`}>期限（日）</FieldLabel>
                <Input
                  id={`workflow-step-${index}-due-days`}
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
                <FieldLabel htmlFor={`workflow-step-${index}-rejection-behavior`}>
                  否認時
                </FieldLabel>
                <NativeSelect
                  id={`workflow-step-${index}-rejection-behavior`}
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
                      typeInputId={`workflow-step-${index}-approver-${selectorIndex}-type`}
                      typeInputLabel={`ステップ ${index + 1} 承認者 ${selectorIndex + 1} の種類`}
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
            commit({
              ...workflow,
              steps: [...workflow.steps, firstAvailableDefaultStep(workflow.steps)],
            })
          }
        >
          ステップを追加
        </Button>
      </FieldSet>

      <details className="rounded-lg bg-card border p-4">
        <summary className="cursor-pointer font-medium">
          詳細設定（条件分岐・エスカレーション・JSON）
        </summary>
        <Field className="mt-4" data-invalid={definitionError === null ? undefined : true}>
          <FieldLabel htmlFor="workflow-advanced">ワークフロー定義</FieldLabel>
          <FieldDescription>
            payload／申請者属性の条件、期限後の承認者など全項目を編集できます。
          </FieldDescription>
          <Textarea
            id="workflow-advanced"
            className="min-h-96 font-mono text-xs"
            value={advanced}
            aria-invalid={definitionError !== null}
            onChange={(event) => setAdvanced(event.target.value)}
          />
          {definitionError === null ? null : <FieldError>{definitionError}</FieldError>}
        </Field>
      </details>

      <div aria-live="polite">
        {state.error === null ? null : <FieldError>{state.error}</FieldError>}
      </div>
      <Button type="submit" disabled={pending || definitionError !== null}>
        {pending ? "保存中…" : "承認フローを保存"}
      </Button>
    </form>
  )
}

function ApproverRow(props: {
  selector: WorkflowApproverSelector
  typeInputId: string
  typeInputLabel: string
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
        id={props.typeInputId}
        aria-label={props.typeInputLabel}
        value={props.selector.type}
        onChange={(event) => {
          const type = event.target.value as WorkflowApproverSelector["type"]
          props.onChange(
            type === "role"
              ? { type, role_key: "" }
              : type === "employee"
                ? { type, employee_code: "" }
                : type === "responsibility"
                  ? { type, responsibility_type: "", organization_unit_code: null }
                  : { type },
          )
        }}
      >
        <NativeSelectOption value="direct_manager">直属上司</NativeSelectOption>
        <NativeSelectOption value="department_manager">部門責任者</NativeSelectOption>
        <NativeSelectOption value="target_department_manager">異動先部門責任者</NativeSelectOption>
        <NativeSelectOption value="management_chain">上位管理職全員</NativeSelectOption>
        <NativeSelectOption value="responsibility">組織責務</NativeSelectOption>
        <NativeSelectOption value="role">IAMロール</NativeSelectOption>
        <NativeSelectOption value="employee">従業員指定</NativeSelectOption>
      </NativeSelect>
      {props.selector.type === "responsibility" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="責務タイプ"
            placeholder="PEOPLE_OPERATIONS"
            pattern="[A-Z][A-Z0-9_]*"
            maxLength={64}
            value={props.selector.responsibility_type}
            onChange={(event) =>
              props.onChange({
                type: "responsibility",
                responsibility_type: event.target.value,
                organization_unit_code:
                  props.selector.type === "responsibility"
                    ? props.selector.organization_unit_code
                    : null,
              })
            }
          />
          <Input
            aria-label="組織コード（任意）"
            placeholder="未指定なら全組織"
            value={props.selector.organization_unit_code ?? ""}
            onChange={(event) =>
              props.onChange({
                type: "responsibility",
                responsibility_type:
                  props.selector.type === "responsibility"
                    ? props.selector.responsibility_type
                    : "",
                organization_unit_code: event.target.value === "" ? null : event.target.value,
              })
            }
          />
        </div>
      ) : props.selector.type === "role" || props.selector.type === "employee" ? (
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
