import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { toReviewerTypeLabel } from "@/app/(app)/review/_lib/to-reviewer-type-label"
import { BackButton } from "@/components/back-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getReviewResults } from "@/lib/api/get-review-results"
import type { ReviewFormResponse } from "@/lib/api/types/review-types"
import { canAdministerCycle } from "@/lib/review/can-administer-cycle"

export const metadata = { title: "評価結果" }

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// 評価結果画面（特権ロール）。cycle_id と employee_code を query で受け取り集計結果を表示する。
export default async function ReviewResultsPage(props: Props) {
  const searchParamsValue = await props.searchParams

  const cycleIdValue = searchParamsValue.cycle_id

  const employeeCodeValue = searchParamsValue.employee_code

  const cycleId = typeof cycleIdValue === "string" ? Number(cycleIdValue) : Number.NaN

  const employeeCode = typeof employeeCodeValue === "string" ? employeeCodeValue : ""

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="評価結果" actions={<BackButton href="/review" label="評価に戻る" />} />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-16 w-full" />}>
        <Results cycleId={cycleId} employeeCode={employeeCode} />
      </Suspense>
    </div>
  )
}

type ResultsProps = {
  cycleId: number
  employeeCode: string
}

// 結果を認証付きで取得して描画する非同期 RSC。権限・入力をチェックしてから取得する。
async function Results(props: ResultsProps) {
  const currentUser = await getMe()

  const canView = currentUser instanceof Error ? false : canAdministerCycle(currentUser.role)

  if (canView === false) {
    return <FetchError message="評価結果を閲覧する権限がありません" />
  }

  if (Number.isInteger(props.cycleId) === false || props.employeeCode === "") {
    return (
      <p className="text-sm text-muted-foreground">サイクル ID と社員コードを指定してください</p>
    )
  }

  const result = await getReviewResults({
    cycleId: props.cycleId,
    employeeCode: props.employeeCode,
  })

  if (result instanceof Error) {
    return <FetchError message="評価結果の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>集計</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-1 text-sm">
          <span>評価対象: 社員 #{result.subject_employee_id}</span>

          <span>フォーム数: {result.form_count}</span>

          <span>提出済み: {result.submitted_count}</span>

          <span>平均スコア: {result.average_score ?? "-"}</span>
        </CardContent>
      </Card>

      <ResultsTable forms={result.forms} />
    </div>
  )
}

type ResultsTableProps = {
  forms: ReadonlyArray<ReviewFormResponse>
}

function ResultsTable(props: ResultsTableProps) {
  if (props.forms.length === 0) {
    return <EmptyState title="評価フォームはありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>評価者</TableHead>
            <TableHead>種別</TableHead>
            <TableHead>スコア</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>提出日時</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.forms.map((form) => (
            <TableRow key={form.id}>
              <TableCell>社員 #{form.reviewer_employee_id}</TableCell>

              <TableCell>{toReviewerTypeLabel(form.reviewer_type)}</TableCell>

              <TableCell className="tabular-nums">{form.score ?? "-"}</TableCell>

              <TableCell>
                {form.status === "submitted" ? (
                  <Badge variant="secondary">提出済み</Badge>
                ) : (
                  <Badge>未提出</Badge>
                )}
              </TableCell>

              <TableCell className="text-muted-foreground">{form.submitted_at ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
