import { factory } from "@/factory"

export const help = `bedrock room-reservations — 会議室の予約

usage:
  bedrock room-reservations mine                                  自分の予約一覧
  bedrock room-reservations show <id>                             予約の詳細
  bedrock room-reservations create --room-id <n> --start <iso> --end <iso> [--purpose <p>]  予約作成
  bedrock room-reservations update <id> [--start <iso>] [--end <iso>] [--purpose <p>]  予約変更
  bedrock room-reservations cancel <id>                           予約取消`

export default factory.createHandlers((c) => c.text(help))
