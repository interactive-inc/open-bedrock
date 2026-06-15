import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RoomAvailability } from "@/lib/api/types/room-types"

type Props = {
  availabilities: ReadonlyArray<RoomAvailability>
}

// 各会議室の空き状況テーブル。空きは緑バッジ、重複ありは衝突予約の用途を表示する。
export function RoomAvailabilityTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>会議室</TableHead>
            <TableHead>定員</TableHead>
            <TableHead>空き状況</TableHead>
            <TableHead>重複している予約</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.availabilities.map((availability) => (
            <TableRow key={availability.room.id}>
              <TableCell className="font-medium">{availability.room.name}</TableCell>

              <TableCell className="text-muted-foreground">
                {availability.room.capacity} 名
              </TableCell>

              <TableCell>
                {availability.available ? (
                  <Badge variant="secondary">空き</Badge>
                ) : (
                  <Badge variant="destructive">予約あり</Badge>
                )}
              </TableCell>

              <TableCell className="text-muted-foreground">
                {toConflictLabel(availability)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 衝突予約の用途を結合した表示用文字列。重複が無い場合はダッシュ。
function toConflictLabel(availability: RoomAvailability): string {
  if (availability.conflicts.length === 0) {
    return "—"
  }

  return availability.conflicts.map((conflict) => conflict.purpose ?? "（用途未設定）").join(" / ")
}
