import { factory } from "@/factory"

export const help = `karte payroll — 給与明細・給与改定

usage:
  karte payroll slip [--period <YYYY-MM>]                   自分の給与明細一覧
  karte payroll slip show <id>                              明細詳細
  karte payroll issue --employee-code <c> --period <YYYY-MM> --base <n> [--allowances <n>] [--deductions <n>]
  karte payroll revision <employee_code>                    改定履歴(管理者)
  karte payroll revise --employee-code <c> --effective-date <d> --new-base <n> [--reason <r>]`

export default factory.createHandlers((c) => c.text(help))
