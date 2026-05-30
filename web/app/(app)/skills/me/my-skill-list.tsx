import { getMySkillList } from "@/lib/api/get-my-skill-list"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// GET /skills/me を認証付きで取得し、本人の登録スキルをテーブル描画する非同期 RSC。
export async function MySkillList() {
  const mySkills = await getMySkillList()

  if (mySkills instanceof Error) {
    return <p className="text-sm text-destructive">自分のスキルの取得に失敗しました</p>
  }

  if (mySkills.length === 0) {
    return <p className="text-sm text-muted-foreground">まだスキルが登録されていません</p>
  }

  return (
    <Table>
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
  )
}
