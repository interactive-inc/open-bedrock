import { CertificationsTable } from "@/app/(app)/certification/certifications/_components/certifications-table"
import { FetchError } from "@/components/fetch-error"
import { listCertifications } from "@/lib/api/list-certifications"

type Props = {
  canManage: boolean
}

/** 資格マスタ一覧セクション。certification:manage を持つ場合のみ管理向けの案内を出す。 */
export async function CertificationsSection(props: Props) {
  const certifications = await listCertifications()

  if (certifications instanceof Error) {
    return <FetchError message="資格マスタの取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">資格マスタ</h2>

      <CertificationsTable rows={certifications} canManage={props.canManage} />
    </section>
  )
}
