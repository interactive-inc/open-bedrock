import { factory } from "@/factory"

export const help = `bedrock meetings — 会議体

usage:
  bedrock meetings list                                       会議体一覧
  bedrock meetings show <code>                                会議体詳細
  bedrock meetings create --code <c> --name <n> [--cadence <cd>] [--description <d>]
  bedrock meetings update <code> --name <n> [--cadence <cd>] [--description <d>]
  bedrock meetings archive <code>                             会議体をアーカイブ`

export default factory.createHandlers((c) => c.text(help))
