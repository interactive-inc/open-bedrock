import { factory } from "@/factory"

export const help = `karte grades — 等級マスタと等級の割当

usage:
  karte grades list                                     等級マスタ一覧（全認証者）
  karte grades create --code <c> --name <n> --rank <r> [--description <d>]
  karte grades update --id <grade-id> --code <c> --name <n> --rank <r> [--description <d>]
  karte grades delete --id <grade-id>
  karte grades assignments [--employee-id <id>]         等級の割当履歴
  karte grades assign --employee-id <id> --grade-id <id> --effective-date <YYYY-MM-DD> [--reason <r>]`

export default factory.createHandlers((c) => c.text(help))
