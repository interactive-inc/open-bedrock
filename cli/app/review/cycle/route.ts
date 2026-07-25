import { factory } from "@/factory"

export const help = `bedrock review cycle — サイクル管理

usage:
  bedrock review cycle create --title <t> --period <p> [--due <d>]            サイクル作成（管理者）
  bedrock review cycle update --id <id> --title <t> --period <p> [--due <d>]   サイクル更新（管理者）
  bedrock review cycle delete --id <id>                                        サイクル削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
