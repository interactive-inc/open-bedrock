import { factory } from "@/factory"

export const help = `bedrock rental — レンタル予約

usage:
  bedrock rental reserve --item <name> --start <date> --end <date> [--purpose <p>]   申請
  bedrock rental mine                                                                自分の一覧
  bedrock rental show --id <reservation-id>                                          詳細
  bedrock rental update --id <reservation-id> --item <name> --start <date> --end <date> [--purpose <p>]
  bedrock rental cancel --id <reservation-id>                                        取消
  bedrock rental lend --id <reservation-id>                                          貸出
  bedrock rental return --id <reservation-id>                                        返却`

export default factory.createHandlers((c) => c.text(help))
