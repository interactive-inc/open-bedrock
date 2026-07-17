"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  decideRedemptionAction,
  type RedemptionDecisionState,
} from "@/app/(app)/inbox/thanks-redemptions/actions"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format-datetime"
import type { ThanksRedemptionInboxResponse } from "@/lib/api/types/thanks-points-types"

const initialState: RedemptionDecisionState = { ok: false, error: null }

const pointFormatter = new Intl.NumberFormat("ja-JP")

export function RedemptionInboxTable(props: {
  redemptions: ReadonlyArray<ThanksRedemptionInboxResponse>
}) {
  if (props.redemptions.length === 0) {
    return <EmptyState title="承認待ちの交換申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="承認待ちのサンクス交換申請">
        <TableHeader>
          <TableRow>
            <TableHead>景品</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>ポイント</TableHead>
            <TableHead>申請日</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.redemptions.map((redemption) => (
            <TableRow key={redemption.id}>
              <TableCell className="font-medium">{redemption.reward_name}</TableCell>
              <TableCell>{redemption.employee_name}</TableCell>
              <TableCell>{redemption.employee_dept_name ?? "-"}</TableCell>
              <TableCell>{pointFormatter.format(redemption.point_cost)} pt</TableCell>
              <TableCell>{formatDateTime(redemption.created_at)}</TableCell>
              <TableCell>
                <DecisionForm redemptionId={redemption.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DecisionForm(props: { redemptionId: number }) {
  async function reduce(previousState: RedemptionDecisionState, formData: FormData) {
    const result = await decideRedemptionAction(previousState, formData)

    if (result.ok) {
      toast.success("交換申請を処理しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="redemption_id" value={props.redemptionId} />

      <TableRowActions>
        <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>
          承認
        </Button>

        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          却下
        </Button>
      </TableRowActions>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}
    </form>
  )
}
