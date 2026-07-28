import { factory } from "@/factory"

export const help = `bedrock training-courses — 研修コース

usage:
  bedrock training-courses list [--category <c>] [--status <s>]   コース一覧
  bedrock training-courses show <code>                            コース詳細
  bedrock training-courses create --code <c> --title <t> --category <cat> [--description <d>] [--duration <min>] [--required]  コース作成（管理者）
  bedrock training-courses update <code> [--title <t>] [--description <d>]  コース更新（管理者）
  bedrock training-courses archive <code>                         コースの募集終了（管理者）`

export default factory.createHandlers((c) => c.text(help))
