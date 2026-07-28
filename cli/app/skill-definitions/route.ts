import { factory } from "@/factory"

export const help = `bedrock skill-definitions — スキルの定義

usage:
  bedrock skill-definitions list [--q <kw>] [--category <c>]      スキル一覧
  bedrock skill-definitions show <code>                           スキルの詳細`

export default factory.createHandlers((c) => c.text(help))
