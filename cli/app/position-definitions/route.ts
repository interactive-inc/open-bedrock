import { factory } from "@/factory"

export const help = `bedrock position-definitions — 役職マスタ

usage:
  bedrock position-definitions list                                     役職マスタ一覧（全認証者）
  bedrock position-definitions create --code <c> --name <n> --rank <r> [--description <d>]
  bedrock position-definitions update --id <position-id> --code <c> --name <n> --rank <r> [--description <d>]
  bedrock position-definitions delete --id <position-id>`

export default factory.createHandlers((c) => c.text(help))
