import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { TablePagination } from "@/components/table-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBudgetList } from "@/lib/api/get-budget-list"
import { BudgetConsumeForm } from "@/app/(app)/budgets/_components/budget-consume-form"

const PAGE_SIZE = 20

type Props = {
  offset: number
  canManage: boolean
}

// GET /budgets を認証付きで取得し、消化合計・残額つきの予算枠テーブルを描画する非同期 RSC。
export async function BudgetList(props: Props) {
  const result = await getBudgetList({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="予算枠の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="予算枠はまだありません"
        description="会計年度・部署ごとの予算枠を登録すると、消化と残額を追えます。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Table aria-label="予算枠">
          <TableHeader>
            <TableRow>
              <TableHead>年度</TableHead>
              <TableHead>部署</TableHead>
              <TableHead>表題</TableHead>
              <TableHead className="text-right">予算</TableHead>
              <TableHead className="text-right">消化</TableHead>
              <TableHead className="text-right">残額</TableHead>
              {props.canManage ? <TableHead>消化を記録</TableHead> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.data.map((budget) => (
              <TableRow key={budget.id}>
                <TableCell className="text-muted-foreground">{budget.fiscal_year}</TableCell>

                <TableCell className="text-muted-foreground">
                  {budget.department_code ?? "全社"}
                </TableCell>

                <TableCell className="font-medium">{budget.title}</TableCell>

                <TableCell className="text-right tabular-nums">
                  {budget.amount.toLocaleString("ja-JP")}円
                </TableCell>

                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {budget.consumed.toLocaleString("ja-JP")}円
                </TableCell>

                <TableCell className="text-right tabular-nums font-medium">
                  {budget.remaining.toLocaleString("ja-JP")}円
                </TableCell>

                {props.canManage ? (
                  <TableCell>
                    <BudgetConsumeForm budgetId={budget.id} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        pathname="/budgets"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
