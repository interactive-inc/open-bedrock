"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// FormData の値を文字列として安全に取り出す。File 等の非文字列は空文字に倒す。
function toTrimmedString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : ""
}

// 評価結果の検索フォーム（特権ロール向け）。サイクル ID と社員コードを受け取り
// /review/results?cycle_id=...&employee_code=... へ遷移する。
export function ReviewResultsSearchForm() {
  const router = useRouter()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const cycleId = toTrimmedString(formData.get("cycle_id"))

    const employeeCode = toTrimmedString(formData.get("employee_code"))

    if (cycleId === "" || employeeCode === "") {
      return
    }

    const params = new URLSearchParams({ cycle_id: cycleId, employee_code: employeeCode })

    router.push(`/review/results?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="review-results-cycle-id">サイクル ID</FieldLabel>

          <Input
            id="review-results-cycle-id"
            name="cycle_id"
            type="number"
            placeholder="1"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="review-results-employee-code">社員コード</FieldLabel>

          <Input
            id="review-results-employee-code"
            name="employee_code"
            placeholder="E0001"
            required
          />
        </Field>

        <Field orientation="horizontal">
          <Button type="submit">結果を表示</Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
