import { KnowledgeNewForm } from "@/app/(app)/knowledge/knowledge-articles/_components/knowledge-new-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "ナレッジ記事の作成" }

/**
 * ナレッジ記事の新規作成ページ。
 */
export default function NewKnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ナレッジ記事を作成"
        actions={<BackButton href="/knowledge/knowledge-articles" label="一覧に戻る" />}
      />

      <Card className="max-w-3xl">
        <CardContent>
          <KnowledgeNewForm />
        </CardContent>
      </Card>
    </div>
  )
}
