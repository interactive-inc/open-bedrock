import { Suspense } from "react"
import { KnowledgeResultList } from "@/app/(app)/knowledge/_components/knowledge-result-list"
import { KnowledgeSearchForm } from "@/app/(app)/knowledge/_components/knowledge-search-form"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "ナレッジ" }

type Props = {
  searchParams: Promise<{ q?: string; category?: string }>
}

// /knowledge ナレッジ検索画面。検索語 q とカテゴリ category を searchParams から受け取り、
// 非同期の結果一覧は Suspense 境界で Skeleton をフォールバックにする。
export default async function KnowledgePage(props: Props) {
  const params = await props.searchParams

  const q = params.q ?? null

  const category = params.category ?? null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">ナレッジ検索</h1>

      <KnowledgeSearchForm q={q} category={category} />

      <Suspense key={`${q}:${category}`} fallback={<KnowledgeListSkeleton />}>
        <KnowledgeResultList q={q} category={category} />
      </Suspense>
    </div>
  )
}

function KnowledgeListSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-3">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  )
}
