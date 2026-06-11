import { Suspense } from "react"
import { CertificateRequestCreateForm } from "@/app/(app)/certificate-requests/_components/certificate-request-create-form"
import { MyCertificateRequestsSection } from "@/app/(app)/certificate-requests/_components/my-certificate-requests-section"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "証明書発行依頼" }

// 証明書発行依頼画面。依頼フォームと非同期の自分の依頼一覧を Suspense 境界で描画する RSC。
export default function CertificateRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">証明書発行依頼</h1>

      <CertificateRequestCreateForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">自分の依頼</h2>

        <Suspense fallback={<CertificateRequestsSkeleton />}>
          <MyCertificateRequestsSection />
        </Suspense>
      </section>
    </div>
  )
}

function CertificateRequestsSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
