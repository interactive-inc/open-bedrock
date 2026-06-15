import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MyCertificateRequestsSection } from "@/app/(app)/certificate-requests/_components/my-certificate-requests-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata = { title: "証明書発行依頼" }

/**
 * 証明書発行依頼の自分の依頼一覧画面。新規依頼は /new に分離。
 */
export default function CertificateRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="証明書発行依頼"
        description="在職証明など各種証明書の発行を依頼し、進捗を確認します。"
        actions={
          <Button render={<Link href="/certificate-requests/new" />}>
            <Plus />
            新規依頼
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <MyCertificateRequestsSection />
      </Suspense>
    </div>
  )
}
