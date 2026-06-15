import { notFound } from "next/navigation"
import { RoomCreateForm } from "@/app/(app)/rooms/manage/_components/room-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageRooms } from "@/lib/room/can-manage-rooms"

export const metadata = { title: "会議室を登録" }

export default async function NewRoomPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageRooms(me.role)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="会議室を登録"
        description="新しい会議室の名称・定員・所在地を登録します。"
        actions={<BackButton href="/rooms/manage" label="マスタに戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <RoomCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
