import { Suspense } from "react"
import Link from "next/link"
import { OrgMembersTable } from "@/app/(app)/org/departments/[code]/org-members-table"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  params: Promise<{ code: string }>
}

// 部署メンバー画面（/org/departments/:code/members）。
// 動的セグメント params は Next.js 16 では Promise なので await して取り出す。
export default async function OrgDepartmentMembersPage(props: Props) {
  const params = await props.params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/org" className="text-sm text-muted-foreground hover:underline">
          組織図に戻る
        </Link>

        <h1 className="text-2xl font-semibold">部署メンバー: {params.code}</h1>
      </div>

      <Suspense fallback={<OrgMembersSkeleton />}>
        <OrgMembersTable code={params.code} />
      </Suspense>
    </div>
  )
}

function OrgMembersSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}
