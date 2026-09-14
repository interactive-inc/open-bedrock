import { PageHeader } from "@/components/page-header"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { getMe } from "@/lib/api/get-me"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"
import { getFeatureNavigationSections } from "@/lib/feature/get-feature-navigation-sections"
import { redirect } from "next/navigation"

export default async function AdminEntryPage() {
  const [user, disabled] = await Promise.all([getMe(), getFeatureAvailability()])
  if (disabled instanceof Error) throw disabled
  const first = getFeatureNavigationSections(getAdminNavigationItems(user.permissions, disabled))[0]
    ?.items[0]
  if (first) redirect(first.href)
  return <PageHeader title="閲覧できる管理機能がありません" />
}
