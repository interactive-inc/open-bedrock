import { factory } from "@/factory"

export const help = `karte skill — スキル

usage:
  karte skill list [--q <kw>] [--category <c>]   スキル一覧
  karte skill mine                               自分のスキル
  karte skill set <code> --level <n> [--years <y>] [--note <n>]`

export default factory.createHandlers((c) => c.text(help))
