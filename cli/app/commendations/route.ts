import { factory } from "@/factory"

export const help = `bedrock commendations — 表彰の記録(社内公開)

usage:
  bedrock commendations list [--employee-id <id>]                     表彰の記録一覧(全認証者が閲覧可)
  bedrock commendations create --employee-id <id> --title <t> --reason <r> --awarded-on <d>
  bedrock commendations delete <id>                                   表彰の記録を削除

  create/delete は commendation:manage が必要。`

export default factory.createHandlers((c) => c.text(help))
