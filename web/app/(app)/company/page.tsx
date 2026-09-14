import { ContextResourceList } from "@/components/context-resource-list"
import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth/require-permission"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { FetchError } from "@/components/fetch-error"

export const metadata = { title: "会社 — ホーム" }

/** Companyが公開する資源・操作をサイドメニューと対応づけて一覧する。 */
export default async function CompanyResourcesPage() {
  const user = await requirePermission("system:admin")
  const disabled = await getFeatureAvailability()
  if (disabled instanceof Error) return <FetchError message={disabled.message} />
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="ホーム" />
      <ContextResourceList
        owner="company"
        permissions={user.permissions}
        disabledFeatures={disabled}
      />
    </div>
  )
}
