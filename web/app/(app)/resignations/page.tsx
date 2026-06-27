import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyResignationsSection } from "@/app/(app)/resignations/_components/my-resignations-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "退職申請" }

/**
 * 退職申請の自分の申請一覧画面。新規申請は /new に分離。
 */
export default function ResignationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="退職申請"
        description="退職の申請と、申請状況を確認します。"
        actions={
          <Button nativeButton={false} render={<Link href="/resignations/new" />}>
            <Plus />
            新規申請
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyResignationsSection />
      </Suspense>
    </div>
  )
}
