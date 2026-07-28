import { factory } from "@/factory"

export const help = `bedrock grades — 等級マスタと等級の割当

usage:
  bedrock grades list                                     等級マスタ一覧（全認証者）
  bedrock grades create --code <c> --name <n> --rank <r> [--description <d>]
  bedrock grades update --id <grade-id> --code <c> --name <n> --rank <r> [--description <d>]
  bedrock grades delete --id <grade-id>
  bedrock grades assignments [--employee-id <id>]         等級の割当履歴
  bedrock grades assign --employee-id <id> --grade-id <id> --effective-date <YYYY-MM-DD> [--reason <r>]`

export default factory.createHandlers((c) => c.text(help))
