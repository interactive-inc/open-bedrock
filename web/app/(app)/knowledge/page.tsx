import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { KnowledgeResultList } from "@/app/(app)/knowledge/_components/knowledge-result-list"
import { KnowledgeSearchForm } from "@/app/(app)/knowledge/_components/knowledge-search-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

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
      <PageHeader
        title="ナレッジ検索"
        description="社内ナレッジを検索します。"
        actions={
          <Button nativeButton={false} render={<Link href="/knowledge/new" />}>
            <Plus />
            新規記事
          </Button>
        }
      />

      <KnowledgeSearchForm q={q} category={category} />

      <Suspense
        key={`${q}:${category}`}
        fallback={<ListSkeleton rows={5} rowClassName="h-20 w-full" />}
      >
        <KnowledgeResultList q={q} category={category} />
      </Suspense>
    </div>
  )
}
