import { factory } from "@/factory"

export const help = `karte rental — レンタル予約

usage:
  karte rental reserve --item <name> --start <date> --end <date> [--purpose <p>]   申請
  karte rental mine                                                                自分の一覧
  karte rental show --id <reservation-id>                                          詳細
  karte rental update --id <reservation-id> --item <name> --start <date> --end <date> [--purpose <p>]
  karte rental cancel --id <reservation-id>                                        取消`

export default factory.createHandlers((c) => c.text(help))
