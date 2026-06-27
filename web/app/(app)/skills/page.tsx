import { Suspense } from "react"
import Link from "next/link"
import { SkillSearchForm } from "@/app/(app)/skills/_components/skill-search-form"
import { SkillTable } from "@/app/(app)/skills/_components/skill-table"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "スキル" }

type Props = {
  searchParams: Promise<{ q?: string; category?: string }>
}

// /skills スキル一覧画面。検索語 q とカテゴリ category を searchParams から受け取り、
// 非同期テーブルは Suspense 境界で Skeleton をフォールバックにする。
export default async function SkillsPage(props: Props) {
  const params = await props.searchParams

  const q = params.q ?? null

  const category = params.category ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="スキル一覧"
        description="スキルをキーワード・カテゴリで検索します。"
        actions={<Button nativeButton={false} render={<Link href="/skills/me" />}>自分のスキル</Button>}
      />

      <SkillSearchForm q={q} category={category} />

      <Suspense
        key={`${q}:${category}`}
        fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}
      >
        <SkillTable q={q} category={category} />
      </Suspense>
    </div>
  )
}
