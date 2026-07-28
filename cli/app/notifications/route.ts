import { factory } from "@/factory"

export const help = `bedrock notifications — 通知

usage:
  bedrock notifications list [--unread]                              通知一覧
  bedrock notifications count                                        未読件数
  bedrock notifications read <id>                                    既読にする
  bedrock notifications read-all                                     全件既読
  bedrock notifications send --to <employee_code> --title <t> [--body <b>] [--kind <k>]   (管理者) 手動送信`

export default factory.createHandlers((c) => c.text(help))
