import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  q: string | null
  category: string | null
}

/**
 * スキル一覧の検索フォーム。GET メソッドの native form で searchParams を更新する。
 * 値の確定は URL に委ねるため Client 状態は持たない。
 */
export function SkillSearchForm(props: Props) {
  return (
    <form method="get" action="/organization/skills" className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="q">キーワード</Label>

        <Input id="q" name="q" defaultValue={props.q ?? ""} placeholder="名称・コードで検索" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">カテゴリ</Label>

        <Input
          id="category"
          name="category"
          defaultValue={props.category ?? ""}
          placeholder="カテゴリで絞り込み"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit">検索</Button>

        <Button variant="ghost" nativeButton={false} render={<Link href="/organization/skills" />}>
          クリア
        </Button>
      </div>
    </form>
  )
}
