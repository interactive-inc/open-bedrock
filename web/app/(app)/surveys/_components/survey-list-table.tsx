import Link from "next/link"
import { getSurveyList } from "@/lib/api/get-survey-list"
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

// 実施中アンケートを取得してテーブル表示する非同期 RSC。
// 各行から回答画面 (/surveys/:id) と集計画面 (/surveys/:id/summary) へ遷移できる。
export async function SurveyListTable() {
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
          <TableHead className="w-48 text-right">操作</TableHead>
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

            <TableCell className="flex justify-end gap-2">
              <Button size="sm" render={<Link href={`/surveys/${survey.id}`} />}>
                回答
              </Button>

              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/surveys/${survey.id}/summary`} />}
              >
                集計
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
