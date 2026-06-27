import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { SurveyDeleteButton } from "@/app/(app)/surveys/manage/_components/survey-delete-button"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
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

  if (me instanceof Error || !canManageSurveys(me.role)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="サーベイ管理"
        description="実施中のアンケートを確認・編集・削除します。"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/surveys" />}>
              サーベイ一覧へ
            </Button>

            <Button nativeButton={false} render={<Link href="/surveys/manage/new" />}>
              <Plus />
              新規アンケート
            </Button>
          </>
        }
      />

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>タイトル</TableHead>
            <TableHead className="w-24">状態</TableHead>
            <TableHead className="w-24">設問数</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {surveys.map((survey) => (
            <TableRow key={survey.id}>
              <TableCell className="text-muted-foreground">{survey.id}</TableCell>

              <TableCell className="font-medium">{survey.title}</TableCell>

              <TableCell>
                <Badge variant={survey.status === "open" ? "default" : "secondary"}>
                  {survey.status === "open" ? "実施中" : "終了"}
                </Badge>
              </TableCell>

              <TableCell>{survey.questions_json.length}</TableCell>

              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/surveys/${survey.id}/edit`} />}
                  >
                    編集
                  </Button>

                  <SurveyDeleteButton id={survey.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
