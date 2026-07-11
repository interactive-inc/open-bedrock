"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  completeAntisocialCheckAction,
  type AntisocialCheckActionState,
} from "@/app/(app)/antisocial-checks/actions"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AntisocialCheckAdminResponse } from "@/lib/api/types/antisocial-check-types"

const initialState: AntisocialCheckActionState = { ok: false, error: null }

export function AntisocialCheckAdminTable(props: {
  checks: ReadonlyArray<AntisocialCheckAdminResponse>
}) {
  if (props.checks.length === 0) {
    return <EmptyState title="判定待ちの反社チェックはありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="判定待ちの反社チェック">
        <TableHeader>
          <TableRow>
            <TableHead>申請者</TableHead>
            <TableHead>取引先</TableHead>
            <TableHead>所在地</TableHead>
            <TableHead>代表者</TableHead>
            <TableHead className="min-w-72">判定</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.checks.map((check) => (
            <TableRow key={check.id}>
              <TableCell>{check.requester_name}</TableCell>
              <TableCell className="font-medium">{check.partner_name}</TableCell>
              <TableCell>{check.partner_address ?? "-"}</TableCell>
              <TableCell>{check.representative_name ?? "-"}</TableCell>
              <TableCell>
                <DecisionForm check={check} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DecisionForm(props: { check: AntisocialCheckAdminResponse }) {
  async function reduce(
    previousState: AntisocialCheckActionState,
    formData: FormData,
  ): Promise<AntisocialCheckActionState> {
    const result = await completeAntisocialCheckAction(previousState, formData)

    if (result.ok) {
      toast.success("判定結果を記録しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  const inputId = `result-${props.check.id}`

  return (
    <form action={formAction} className="flex min-w-64 flex-col gap-2">
      <input type="hidden" name="antisocial_check_id" value={props.check.id} />
      <input type="hidden" name="partner_name" value={props.check.partner_name} />
      <input type="hidden" name="partner_address" value={props.check.partner_address ?? ""} />
      <input
        type="hidden"
        name="representative_name"
        value={props.check.representative_name ?? ""}
      />

      <FieldLabel htmlFor={inputId}>判定結果</FieldLabel>

      <div className="flex gap-2">
        <Input id={inputId} name="result" required maxLength={3000} />

        <Button type="submit" disabled={pending}>
          確定
        </Button>
      </div>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </form>
  )
}
