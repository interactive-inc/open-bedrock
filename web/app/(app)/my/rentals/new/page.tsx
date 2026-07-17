import { RentalReservationCreateForm } from "@/app/(app)/my/rentals/_components/rental-reservation-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "レンタルの新規予約" }

/**
 * レンタルの新規予約。フォーム単機能のページとして、一覧から独立させる。
 */
export default function NewRentalReservationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="新規予約"
        description="備品と利用期間を指定して予約します。"
        actions={<BackButton href="/my/rentals" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <RentalReservationCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
