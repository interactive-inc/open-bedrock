import { factory } from "@/factory"

export const help = `bedrock skill — スキル

usage:
  bedrock skill list [--q <kw>] [--category <c>]   スキル一覧
  bedrock skill mine                               自分のスキル
  bedrock skill set <code> --level <n> [--years <y>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
