import { factory } from "@/factory"

export const help = `karte notify — 通知

usage:
  karte notify list [--unread]                              通知一覧
  karte notify count                                        未読件数
  karte notify read <id>                                    既読にする
  karte notify read-all                                     全件既読
  karte notify send --to <employee_code> --title <t> [--body <b>] [--kind <k>]   (管理者) 手動送信`

export default factory.createHandlers((c) => c.text(help))
