import { factory } from "@/factory"

export const help = `karte positions — 役職マスタ

usage:
  karte positions list                                     役職マスタ一覧（全認証者）
  karte positions create --code <c> --name <n> --rank <r> [--description <d>]
  karte positions update --id <position-id> --code <c> --name <n> --rank <r> [--description <d>]
  karte positions delete --id <position-id>`

export default factory.createHandlers((c) => c.text(help))
