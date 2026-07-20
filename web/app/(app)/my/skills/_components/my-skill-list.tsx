import { FetchError } from "@/components/fetch-error"
import { getMySkillList } from "@/lib/api/get-my-skill-list"
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

/** GET /skills/me を認証付きで取得し、本人の登録スキルをテーブル描画する非同期 RSC。 */
export async function MySkillList() {
  const mySkills = await getMySkillList()

  if (mySkills instanceof Error) {
    return <FetchError message="自分のスキルの取得に失敗しました" />
  }

  if (mySkills.length === 0) {
    return (
      <EmptyState
        title="まだスキルが登録されていません"
        description="スキル一覧から自分のスキルを登録しましょう。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>スキル</TableHead>
            <TableHead>カテゴリ</TableHead>
            <TableHead>レベル</TableHead>
            <TableHead>経験年数</TableHead>
            <TableHead>メモ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {mySkills.map((mySkill) => (
            <TableRow key={mySkill.skill_code}>
              <TableCell>
                <span className="font-medium">{mySkill.skill_name}</span>

                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {mySkill.skill_code}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{mySkill.skill_category}</Badge>
              </TableCell>
              <TableCell>{mySkill.level}</TableCell>
              <TableCell>{mySkill.years === null ? "-" : `${mySkill.years}年`}</TableCell>
              <TableCell className="text-muted-foreground">
                {mySkill.note === null ? "-" : mySkill.note}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
