import { MyCertificateRequestsList } from "@/app/(app)/certificate-requests/_components/my-certificate-requests-list"
import { listMyCertificateRequests } from "@/lib/api/list-my-certificate-requests"

// 自分の証明書発行依頼を取得して一覧コンポーネントへ渡す非同期 RSC。
export async function MyCertificateRequestsSection() {
  const certificateRequests = await listMyCertificateRequests()

  if (certificateRequests instanceof Error) {
    return <p className="text-sm text-destructive">証明書発行依頼一覧の取得に失敗しました</p>
  }

  return <MyCertificateRequestsList certificateRequests={certificateRequests} />
}
