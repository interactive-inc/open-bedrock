import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { MeetingList } from "@/app/(app)/organization/meetings/_components/meeting-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { canManageMeetings } from "@/lib/meeting/can-manage-meetings"

export const metadata = { title: "会議体" }

type Props = {
  searchParams: Promise<{ page?: string }>
}

// /meetings 会議体一覧。閲覧は全認証者、登録は meeting:manage のみ導線を出す。
export default async function MeetingsPage(props: Props) {
  const params = await props.searchParams

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const offset = (page - 1) * 20

  const me = await getMe()

  const canManage = me instanceof Error ? false : canManageMeetings(me.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="会議体"
        description="定例会議などの器を管理し、議事録を記録します。"
        actions={
          canManage ? (
            <Button nativeButton={false} render={<Link href="/organization/meetings/new" />}>
              <Plus />
              会議体を登録
            </Button>
          ) : null
        }
      />

      <Suspense key={String(page)} fallback={<ListSkeleton rows={5} rowClassName="h-16 w-full" />}>
        <MeetingList offset={offset} />
      </Suspense>
    </div>
  )
}
