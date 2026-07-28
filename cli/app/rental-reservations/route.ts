import { factory } from "@/factory"

export const help = `bedrock rental-reservations — レンタル予約

usage:
  bedrock rental-reservations reserve --item <name> --start <date> --end <date> [--purpose <p>]   申請
  bedrock rental-reservations mine                                                                自分の一覧
  bedrock rental-reservations show --id <reservation-id>                                          詳細
  bedrock rental-reservations update --id <reservation-id> --item <name> --start <date> --end <date> [--purpose <p>]
  bedrock rental-reservations cancel --id <reservation-id>                                        取消
  bedrock rental-reservations lend --id <reservation-id>                                          貸出
  bedrock rental-reservations return --id <reservation-id>                                        返却`

export default factory.createHandlers((c) => c.text(help))
