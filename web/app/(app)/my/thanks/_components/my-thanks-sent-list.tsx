import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyThanks } from "@/lib/api/get-my-thanks"
import { formatDateTime } from "@/lib/format-date-time"

/** GET /thanks-messages/me を取得し、自分が送った感謝の一覧テーブルを描画する非同期 RSC。 */
export async function MyThanksSentList() {
  const myThanks = await getMyThanks()

  if (myThanks instanceof Error) {
    return <FetchError message="送信履歴の取得に失敗しました" />
  }

  if (myThanks.data.length === 0) {
    return <EmptyState title="まだ感謝を送っていません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="送信履歴">
        <TableHeader>
          <TableRow>
            <TableHead>宛先</TableHead>
            <TableHead>メッセージ</TableHead>
            <TableHead>ポイント</TableHead>
            <TableHead>送信日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {myThanks.data.map((thanksItem) => (
            <TableRow key={thanksItem.id}>
              <TableCell className="font-medium">{thanksItem.recipient_name}</TableCell>

              <TableCell className="text-muted-foreground">{thanksItem.message}</TableCell>

              <TableCell className="text-muted-foreground">{thanksItem.points} pt</TableCell>

              <TableCell className="text-muted-foreground">
                {formatDateTime(thanksItem.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
