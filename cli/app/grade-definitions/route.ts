import { factory } from "@/factory"

export const help = `bedrock grade-definitions — 等級マスタと等級の割当

usage:
  bedrock grade-definitions list                                     等級マスタ一覧（全認証者）
  bedrock grade-definitions create --code <c> --name <n> --rank <r> [--description <d>]
  bedrock grade-definitions update --id <grade-id> --code <c> --name <n> --rank <r> [--description <d>]
  bedrock grade-definitions delete --id <grade-id>
  bedrock employee-grades list [--employee-id <id>]         等級の割当履歴
  bedrock employee-grades create --employee-id <id> --grade-id <id> --effective-date <YYYY-MM-DD> [--reason <r>]`

export default factory.createHandlers((c) => c.text(help))
