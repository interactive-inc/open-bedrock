import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RoomDeleteButton } from "@/app/(app)/room/rooms/manage/_components/room-delete-button"
import { RoomEditForm } from "@/app/(app)/room/rooms/manage/_components/room-edit-form"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getRoomList } from "@/lib/api/get-room-list"
import { canManageRooms } from "@/lib/room/can-manage-rooms"

export const metadata = { title: "会議室マスタ" }

/**
 * 会議室マスタの管理（特権ロールのみ）。会議室一覧の編集・削除に集中させ、
 * 新規登録は /rooms/manage/new に分離する。
 */
export default async function RoomManagePage() {
  const me = await getMe()

  if (me instanceof Error || !canManageRooms(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="会議室マスタ"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/room/rooms" />}>
              予約・空き状況へ
            </Button>

            <Button nativeButton={false} render={<Link href="/room/rooms/manage/new" />}>
              <Plus />
              会議室を登録
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <RoomsTable />
      </Suspense>
    </div>
  )
}

async function RoomsTable() {
  const rooms = await getRoomList()

  if (rooms instanceof Error) {
    return <FetchError message="会議室一覧の取得に失敗しました" />
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        title="会議室はまだ登録されていません"
        description="右上の「会議室を登録」から最初の会議室を追加できます。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>定員</TableHead>
            <TableHead>所在地</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rooms.map((room) => (
            <TableRow key={room.id}>
              <TableCell className="font-medium">{room.id}</TableCell>

              <TableCell>{room.name}</TableCell>

              <TableCell className="text-muted-foreground">{room.capacity}</TableCell>

              <TableCell className="text-muted-foreground">{room.location ?? "-"}</TableCell>

              <TableCell>
                <TableRowActions>
                  <RoomEditForm
                    id={room.id}
                    name={room.name}
                    capacity={room.capacity}
                    location={room.location}
                  />

                  <RoomDeleteButton id={room.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
