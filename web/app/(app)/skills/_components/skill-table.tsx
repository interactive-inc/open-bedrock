import { FetchError } from "@/components/fetch-error"
import { getSkillList } from "@/lib/api/get-skill-list"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  q: string | null
  category: string | null
}

// 検索条件で GET /skills を認証付きに取得しテーブル描画する非同期 RSC。
export async function SkillTable(props: Props) {
  const skills = await getSkillList({ q: props.q, category: props.category })

  if (skills instanceof Error) {
    return <FetchError message="スキル一覧の取得に失敗しました" />
  }

  if (skills.length === 0) {
    return <EmptyState title="該当するスキルがありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>カテゴリ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {skills.map((skill) => (
            <TableRow key={skill.code}>
              <TableCell className="font-mono text-xs">{skill.code}</TableCell>
              <TableCell>{skill.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{skill.category}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
