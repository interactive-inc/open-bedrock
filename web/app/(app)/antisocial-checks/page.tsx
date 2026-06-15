import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyAntisocialChecksSection } from "@/app/(app)/antisocial-checks/_components/my-antisocial-checks-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "反社チェック申請" }

/**
 * 反社チェック申請の自分の申請一覧画面。新規申請は /new に分離。
 */
export default function AntisocialChecksPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="反社チェック申請"
        description="反社チェックの申請と、申請状況を確認します。"
        actions={
          <Button render={<Link href="/antisocial-checks/new" />}>
            <Plus />
            新規申請
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyAntisocialChecksSection />
      </Suspense>
    </div>
  )
}
