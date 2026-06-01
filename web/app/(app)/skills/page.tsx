import { Suspense } from "react"
import Link from "next/link"
import { SkillSearchForm } from "@/app/(app)/skills/skill-search-form"
import { SkillTable } from "@/app/(app)/skills/skill-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">スキル一覧</h1>

        <Button render={<Link href="/skills/me" />}>自分のスキル</Button>
      </div>

      <SkillSearchForm q={q} category={category} />

      <Suspense key={`${q}:${category}`} fallback={<SkillTableSkeleton />}>
        <SkillTable q={q} category={category} />
      </Suspense>
    </div>
  )
}

function SkillTableSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
