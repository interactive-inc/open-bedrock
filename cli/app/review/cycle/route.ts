import { factory } from "@/factory"

export const help = `karte review cycle — サイクル管理

usage:
  karte review cycle create --title <t> --period <p> [--due <d>]            サイクル作成（管理者）
  karte review cycle update --id <id> --title <t> --period <p> [--due <d>]   サイクル更新（管理者）
  karte review cycle delete --id <id>                                        サイクル削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
