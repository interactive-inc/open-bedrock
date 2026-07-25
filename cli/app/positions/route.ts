import { factory } from "@/factory"

export const help = `bedrock positions — 役職マスタ

usage:
  bedrock positions list                                     役職マスタ一覧（全認証者）
  bedrock positions create --code <c> --name <n> --rank <r> [--description <d>]
  bedrock positions update --id <position-id> --code <c> --name <n> --rank <r> [--description <d>]
  bedrock positions delete --id <position-id>`

export default factory.createHandlers((c) => c.text(help))
