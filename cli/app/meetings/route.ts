import { factory } from "@/factory"

export const help = `karte meetings — 会議体

usage:
  karte meetings list                                       会議体一覧
  karte meetings show <code>                                会議体詳細
  karte meetings create --code <c> --name <n> [--cadence <cd>] [--description <d>]
  karte meetings update <code> --name <n> [--cadence <cd>] [--description <d>]
  karte meetings archive <code>                             会議体をアーカイブ`

export default factory.createHandlers((c) => c.text(help))
