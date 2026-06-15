import { Briefcase } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { CareerSheetSection } from "@/app/(app)/career/_components/career-sheet-section"
import { MyApplicationsSection } from "@/app/(app)/career/_components/my-applications-section"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "キャリア" }

/**
 * 本人のキャリアシート編集と自分の応募一覧を扱う「マイキャリア」画面。
 * 公募一覧と管理は /career/postings に分離する。
 */
export default async function CareerPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="キャリア"
        description="キャリアシートの編集と自分の応募を確認します。"
        actions={
          <Button variant="outline" render={<Link href="/career/postings" />}>
            <Briefcase />
            社内公募を見る
          </Button>
        }
      />

      <section className="flex flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <CareerSheetSection />
        </Suspense>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">自分の応募</h2>

        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <MyApplicationsSection />
        </Suspense>
      </section>
    </div>
  )
}
