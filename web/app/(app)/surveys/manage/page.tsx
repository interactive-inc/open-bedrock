import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { SurveyCreateForm } from "@/app/(app)/surveys/manage/survey-create-form"
import { SurveyDeleteButton } from "@/app/(app)/surveys/manage/survey-delete-button"
import { SurveyEditForm } from "@/app/(app)/surveys/manage/survey-edit-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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

// サーベイ管理画面（/surveys/manage）。管理者がアンケートを作成・編集・削除する。
// 一覧取得は非同期 RSC を Suspense 境界に包み、取得中は Skeleton を出す。
// 非特権ロールは notFound で弾く（defense-in-depth）。
export default async function SurveyManagePage() {
  const me = await getMe()

  if (me instanceof Error || !canManageSurveys(me.role)) {
    notFound()
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">サーベイ管理</h1>

        <Button variant="outline" render={<Link href="/surveys" />}>
          サーベイ一覧へ
        </Button>
      </div>

      <Card className="max-w-xl gap-0 p-0">
        <div className="p-6">
          <SurveyCreateForm />
        </div>
      </Card>

      <Suspense fallback={<SurveysSkeleton />}>
        <SurveysTable />
      </Suspense>
    </div>
  )
}

// 実施中アンケートを取得して管理テーブルを描画する非同期 RSC。
async function SurveysTable() {
  const surveys = await getSurveyList()

  if (surveys instanceof Error) {
    return <p className="text-sm text-destructive">アンケートの取得に失敗しました</p>
  }

  if (surveys.length === 0) {
    return <p className="text-sm text-muted-foreground">実施中のアンケートはありません</p>
  }

  return (
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
                <SurveyEditForm
                  id={survey.id}
                  title={survey.title}
                  status={survey.status === "closed" ? "closed" : "open"}
                  questionsJsonText={JSON.stringify(survey.questions_json, null, 2)}
                />

                <SurveyDeleteButton id={survey.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SurveysSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
