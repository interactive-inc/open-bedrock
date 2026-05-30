import { factory } from "@/factory"

export const help = `karte review cycle — サイクル管理

usage:
  karte review cycle create --title <t> --period <p> [--due <d>]   サイクル作成（管理者）`

export default factory.createHandlers((c) => c.text(help))
