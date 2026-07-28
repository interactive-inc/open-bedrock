import { factory } from "@/factory"

export const help = `bedrock rooms — 会議室の原簿

usage:
  bedrock rooms list                                              会議室一覧
  bedrock rooms show <id>                                         会議室の詳細
  bedrock rooms availability --start <iso> --end <iso> [--capacity <n>]  空き状況
  bedrock rooms create --name <n> --capacity <n> [--location <l>]  会議室登録（管理者）
  bedrock rooms update <id> [--name <n>] [--capacity <n>]         会議室更新（管理者）
  bedrock rooms delete <id>                                       会議室削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
