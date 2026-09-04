import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyCertificateRequestsSection } from "@/app/(app)/my/certificate-requests/_components/my-certificate-requests-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "証明書" }

/**
 * 証明書発行依頼の自分の依頼一覧画面。新規依頼は /new に分離。
 */
export default function CertificateRequestsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="証明書">
        <Button nativeButton={false} render={<Link href="/my/certificate-requests/new" />}>
          <Plus />
          新規依頼
        </Button>
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyCertificateRequestsSection />
      </Suspense>
    </div>
  )
}
