import { notFound } from "next/navigation"
import { Suspense } from "react"
import { WorkAccidentCreateForm } from "@/app/(app)/work-accident/work-accidents/_components/work-accident-create-form"
import { WorkAccidentsSection } from "@/app/(app)/work-accident/work-accidents/_components/work-accidents-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageWorkAccidents } from "@/lib/work-accident/can-manage-work-accidents"
import { canViewAllWorkAccidents } from "@/lib/work-accident/can-view-all-work-accidents"

export const metadata = { title: "労災・事故" }

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/**
 * 労災・事故の発生記録一覧と登録。work_accident:read:all を持つロールのみ表示できる。
 * 権限が無ければ notFound。登録フォームは work_accident:manage を持つ場合のみ出す。
 */
export default async function WorkAccidentsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllWorkAccidents(currentUser.permissions) === false) {
    notFound()
  }

  const canManage = canManageWorkAccidents(currentUser.permissions)

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="労災・事故" />

      {canManage ? <WorkAccidentCreateForm /> : null}

      <Suspense key={status ?? ""} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <WorkAccidentsSection status={status} canManage={canManage} />
      </Suspense>
    </div>
  )
}

function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

function toStatus(value: string | null): "reported" | "closed" | undefined {
  if (value === "reported" || value === "closed") {
    return value
  }

  return undefined
}
