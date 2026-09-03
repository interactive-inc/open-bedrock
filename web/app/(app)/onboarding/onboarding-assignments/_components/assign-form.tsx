"use client"

import { assignOnboardingAction } from "@/app/(app)/onboarding/onboarding-assignments/actions"
import type { AssignState } from "@/app/(app)/onboarding/onboarding-assignments/actions"
import { useFormAction } from "@/hooks/use-form-action"
import type { OnboardingTemplate } from "@/lib/api/types/onboarding-types"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"

type Props = {
  templates: ReadonlyArray<OnboardingTemplate>
  employees: ReadonlyArray<{ code: string; name: string }>
}

const initialState: AssignState = { ok: false, message: null }

/**
 * 社員へオンボーディングテンプレートを割り当てるフォーム。
 * useActionState + native form。テンプレ選択は native select で FormData に乗せる。
 */
export function AssignForm(props: Props) {
  const action = useFormAction(
    assignOnboardingAction,
    initialState,
    (state) => state.message ?? "割り当てました",
  )

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="employee_code">対象社員</FieldLabel>

          <EmployeeSelect
            id="employee_code"
            name="employee_code"
            employees={props.employees}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="template_code">テンプレート</FieldLabel>

          <select
            id="template_code"
            name="template_code"
            required
            className="h-8 w-full rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">選択してください</option>

            {props.templates.map((template) => (
              <option key={template.code} value={template.code}>
                {template.name}（{template.kind === "join" ? "入社" : "退社"}）
              </option>
            ))}
          </select>
        </Field>

        {state.ok === false && state.message !== null ? (
          <FieldError>{state.message}</FieldError>
        ) : null}

        {state.ok && state.message !== null ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : null}

        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "割当中..." : "割り当てる"}
        </Button>
      </FieldGroup>
    </form>
  )
}
