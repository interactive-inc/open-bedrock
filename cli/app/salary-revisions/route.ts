import { factory } from "@/factory"

export const help = `karte salary-revisions — 給与改定の事実記録（最機微。salary_revision 権限のみ）

usage:
  karte salary-revisions list --employee-id <id>
  karte salary-revisions create --employee-id <id> --effective-date <d> --previous-base-salary <n> --new-base-salary <n> [--reason <t>]`

export default factory.createHandlers((c) => c.text(help))
