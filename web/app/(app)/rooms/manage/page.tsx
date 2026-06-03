import Link from "next/link"
import { Suspense } from "react"
import { RoomCreateForm } from "@/app/(app)/rooms/manage/room-create-form"
import { RoomDeleteButton } from "@/app/(app)/rooms/manage/room-delete-button"
import { RoomEditForm } from "@/app/(app)/rooms/manage/room-edit-form"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getRoomList } from "@/lib/api/get-room-list"

export const metadata = { title: "会議室マスタ" }

// 会議室マスタ管理画面。管理者が会議室を登録・編集・削除する。RSC でサーバ取得して一覧表示する。
export default function RoomManagePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">会議室マスタ</h1>

        <Button variant="outline" render={<Link href="/rooms" />}>
          予約・空き状況へ
        </Button>
      </div>

      <Card className="max-w-xl gap-0 p-0">
        <div className="p-6">
          <RoomCreateForm />
        </div>
      </Card>

      <Suspense fallback={<RoomsSkeleton />}>
        <RoomsTable />
      </Suspense>
    </div>
  )
}

// /rooms を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function RoomsTable() {
  const rooms = await getRoomList()

  if (rooms instanceof Error) {
    return <p className="text-sm text-destructive">会議室一覧の取得に失敗しました</p>
  }

  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">会議室はまだ登録されていません</p>
  }

  return (
    <Table>
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
              <div className="flex items-center justify-end gap-2">
                <RoomEditForm
                  id={room.id}
                  name={room.name}
                  capacity={room.capacity}
                  location={room.location}
                />

                <RoomDeleteButton id={room.id} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RoomsSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
