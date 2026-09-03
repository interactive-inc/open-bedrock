import { Suspense } from "react"
import { CertificationsSection } from "@/app/(app)/certification/certifications/_components/certifications-section"
import { EmployeeCertificationsSection } from "@/app/(app)/certification/certifications/_components/employee-certifications-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageCertifications } from "@/lib/certification/can-manage-certifications"
import { canViewAllCertifications } from "@/lib/certification/can-view-all-certifications"

export const metadata = { title: "資格・免許" }

/**
 * 資格・免許の台帳。マスタ一覧と自分の保有記録を表示する。
 * 管理操作（マスタ作成・保有記録の登録/削除）は certification:manage を持つロールにのみ出す。
 */
export default async function CertificationsPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageCertifications(currentUser.permissions)

  const canViewAll =
    currentUser instanceof Error ? false : canViewAllCertifications(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="資格・免許" />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-10 w-full" />}>
        <CertificationsSection canManage={canManage} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-10 w-full" />}>
        <EmployeeCertificationsSection canViewAll={canViewAll} />
      </Suspense>
    </div>
  )
}
