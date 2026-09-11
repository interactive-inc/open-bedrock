import { LicenseUsagePagination } from "@/app/(app)/software-license/licenses/[license]/_components/license-usage-pagination"
import Link from "next/link"
import { z } from "zod"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { FetchError } from "@/components/fetch-error"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getLicense } from "@/lib/api/get-license"
import { getLicenseAssignments } from "@/lib/api/get-license-assignments"
import { canViewAllLicenses } from "@/lib/license/can-view-all-licenses"
import { canManageLicenses } from "@/lib/license/can-manage-licenses"
import { LicenseUsageRecords } from "@/app/(app)/software-license/licenses/[license]/_components/license-usage-records"

type Props = {
  params: Promise<{ license: string }>
  searchParams: Promise<{ state?: string; offset?: string }>
}
export const metadata = { title: "サービスの利用者" }

/** 契約の現在のプランと、利用開始時に記録したプラン・解除理由を区別して表示する。 */
export default async function LicenseUsagePage(props: Props) {
  const viewer = await getMe()
  if (viewer instanceof Error || !canViewAllLicenses(viewer.permissions)) notFound()
  const params = await props.params
  const query = await props.searchParams
  const id = Number(params.license)
  const state = query.state === "released" ? "released" : "assigned"
  const offset = Number(query.offset ?? "0")
  const location = z
    .object({
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      offset: z.number().int().min(0).max(100000),
    })
    .safeParse({ id, offset })
  if (!location.success) notFound()
  const [license, assignments] = await Promise.all([
    getLicense(id),
    getLicenseAssignments({ licenseId: id, state, offset }),
  ])
  if (license instanceof Error || assignments instanceof Error)
    return <FetchError message="サービスの利用情報を取得できませんでした" />
  const path = `/software-license/licenses/${id}`
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={license.name}>
        {license.status === "active" && canManageLicenses(viewer.permissions) ? (
          <Button
            nativeButton={false}
            render={<Link href={`/software-license/licenses/${id}/assign`} />}
          >
            利用開始を記録
          </Button>
        ) : null}
        <Button
          nativeButton={false}
          variant="secondary"
          render={<Link href="/software-license/licenses" />}
        >
          契約一覧に戻る
        </Button>
      </PageHeader>
      <p>
        現在のプラン: {license.plan_name ?? "未設定"} ·{" "}
        {license.status === "active" ? "利用中" : "解約済み"}
      </p>
      <nav aria-label="利用状態" className="flex gap-4">
        <Link href={path} aria-current={state === "assigned" ? "page" : undefined}>
          利用中の職員
        </Link>
        <Link
          href={`${path}?state=released`}
          aria-current={state === "released" ? "page" : undefined}
        >
          解除履歴
        </Link>
      </nav>
      <LicenseUsageRecords
        assignments={assignments.data}
        state={state}
        canManage={canManageLicenses(viewer.permissions)}
        serviceName={license.name}
      />
      <LicenseUsagePagination
        path={path}
        offset={offset}
        state={state}
        hasMore={assignments.has_more}
      />
    </div>
  )
}
