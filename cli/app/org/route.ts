import { factory } from "@/factory"

export const help = `karte org — 組織図

usage:
  karte org tree                       部署ツリー
  karte org members <dept_code>        部署メンバー
  karte org line <employee_code>       レポートライン（上位）`

export default factory.createHandlers((c) => c.text(help))
