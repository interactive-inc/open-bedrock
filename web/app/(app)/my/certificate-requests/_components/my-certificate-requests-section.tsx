import { MyCertificateRequestsList } from "@/app/(app)/my/certificate-requests/_components/my-certificate-requests-list"
import { FetchError } from "@/components/fetch-error"
import { listMyCertificateRequests } from "@/lib/api/list-my-certificate-requests"

// 自分の証明書発行依頼を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyCertificateRequestsSection() {
  const certificateRequests = await listMyCertificateRequests()

  if (certificateRequests instanceof Error) {
    return <FetchError message="証明書発行依頼一覧の取得に失敗しました" />
  }

  return <MyCertificateRequestsList certificateRequests={certificateRequests} />
}
