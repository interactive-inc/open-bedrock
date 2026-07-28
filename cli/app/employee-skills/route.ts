import { factory } from "@/factory"

export const help = `bedrock employee-skills — 従業員の保有スキル

usage:
  bedrock employee-skills me                                      自分のスキル
  bedrock employee-skills set <code> --level <n> [--years <y>] [--note <n>]  保有スキルの登録・更新
  bedrock employee-skills remove <code>                           保有スキルの削除`

export default factory.createHandlers((c) => c.text(help))
