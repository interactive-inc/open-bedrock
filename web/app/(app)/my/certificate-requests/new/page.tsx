import { CertificateRequestCreateForm } from "@/app/(app)/my/certificate-requests/_components/certificate-request-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "新規証明書発行依頼" }

/**
 * 証明書発行依頼の新規作成ページ。
 */
export default function NewCertificateRequestPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規依頼"
        description="発行したい証明書の種類と用途を記入して依頼します。"
        actions={<BackButton href="/my/certificate-requests" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <CertificateRequestCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
