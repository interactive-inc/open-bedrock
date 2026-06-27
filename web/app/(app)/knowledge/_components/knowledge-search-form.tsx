import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  q: string | null
  category: string | null
}

// ナレッジ検索フォーム。GET メソッドの native form で searchParams を更新する。
// 値の確定は URL に委ねるため Client 状態は持たない。
export function KnowledgeSearchForm(props: Props) {
  return (
    <form method="get" action="/knowledge" className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="q">キーワード</Label>

        <Input id="q" name="q" defaultValue={props.q ?? ""} placeholder="タイトル・本文で検索" />
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

        <Button variant="ghost" nativeButton={false} render={<Link href="/knowledge" />}>
          クリア
        </Button>
      </div>
    </form>
  )
}
