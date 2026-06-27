import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyFamilyCareLeavesSection } from "@/app/(app)/family-care-leaves/_components/my-family-care-leaves-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "産休・育休・介護休業の申出" }

/**
 * 産休・育休・介護休業の自分の申出一覧画面。新規申出は /new に分離。
 */
export default function FamilyCareLeavesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="産休・育休・介護休業の申出"
        description="休業の申出と、申出状況を確認します。"
        actions={
          <Button nativeButton={false} render={<Link href="/family-care-leaves/new" />}>
            <Plus />
            新規申出
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyFamilyCareLeavesSection />
      </Suspense>
    </div>
  )
}
