import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { SurveyDeleteButton } from "@/app/(app)/survey/surveys/manage/_components/survey-delete-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getSurveyList } from "@/lib/api/get-survey-list"
import { canManageSurveys } from "@/lib/survey/can-manage-surveys"

export const metadata = { title: "サーベイ管理" }

/**
 * サーベイ管理（特権ロールのみ）。アンケート一覧の確認・編集・削除に集中させ、
 * 新規作成は /surveys/manage/new に分離する。
 */
export default async function SurveyManagePage() {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="サーベイ管理">
        <Button variant="secondary" nativeButton={false} render={<Link href="/survey/surveys" />}>
          サーベイ一覧へ
        </Button>

        <Button nativeButton={false} render={<Link href="/survey/surveys/manage/new" />}>
          <Plus />
          新規アンケート
        </Button>
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={4} />}>
        <SurveysTable />
      </Suspense>
    </div>
  )
}

async function SurveysTable() {
  const surveys = await getSurveyList()

  if (surveys instanceof Error) {
    return <FetchError message="アンケートの取得に失敗しました" />
  }

  if (surveys.length === 0) {
    return (
      <EmptyState
        title="実施中のアンケートはありません"
        description="右上の「新規アンケート」から最初のアンケートを作成できます。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>設問数</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {surveys.map((survey) => (
            <TableRow key={survey.id}>
              <TableCell>{survey.title}</TableCell>

              <TableCell>
                <Button type="button" variant="secondary" size="sm">
                  {survey.status === "open" ? "実施中" : "終了"}
                </Button>
              </TableCell>

              <TableCell>{survey.questions_json.length}</TableCell>

              <TableCell>
                <TableRowActions>
                  <Button
                    variant="secondary"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/survey/surveys/${survey.id}/edit`} />}
                  >
                    編集
                  </Button>

                  <SurveyDeleteButton id={survey.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
