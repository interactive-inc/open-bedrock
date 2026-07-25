import { factory } from "@/factory"

export const help = `bedrock notify — 通知

usage:
  bedrock notify list [--unread]                              通知一覧
  bedrock notify count                                        未読件数
  bedrock notify read <id>                                    既読にする
  bedrock notify read-all                                     全件既読
  bedrock notify send --to <employee_code> --title <t> [--body <b>] [--kind <k>]   (管理者) 手動送信`

export default factory.createHandlers((c) => c.text(help))
