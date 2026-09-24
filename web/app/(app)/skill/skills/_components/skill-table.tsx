import { FetchError } from "@/components/fetch-error"
import { getSkillList } from "@/lib/api/get-skill-list"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusLabel } from "@/components/status-label"

type Props = {
  q: string | null
  category: string | null
}

/** 検索条件で GET /skill-definitions を認証付きに取得しテーブル描画する非同期 RSC。 */
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
      <Table aria-label="一覧">
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
              <TableCell>{skill.code}</TableCell>
              <TableCell>{skill.name}</TableCell>
              <TableCell>
                <StatusLabel>{skill.category}</StatusLabel>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
