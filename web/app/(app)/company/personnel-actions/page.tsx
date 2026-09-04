import { Suspense } from "react"
import { CompanyPersonnelActionSection } from "@/app/(app)/company/personnel-actions/_components/company-personnel-action-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "人事発令" }

/** 全社の人事発令（PersonnelAction）を読む画面。 */
export default async function CompanyPersonnelActionsPage() {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="人事発令" />

      <ReadOnlyNotice command={null} />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <CompanyPersonnelActionSection />
      </Suspense>
    </div>
  )
}
