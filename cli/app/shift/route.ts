import { factory } from "@/factory"

export const help = `karte shift — シフト割当 + パターン + 交代申請

usage:
  karte shift assignments [--from <date>] [--to <date>] [--department-code <c>]  割当一覧
  karte shift mine                                              自分の割当一覧
  karte shift assign --employee-code <c> --date <date> --pattern-code <c> [--note <n>]  割当作成（管理者）
  karte shift publish <id>                                      割当公開
  karte shift patterns                                          シフトパターン一覧
  karte shift pattern-create --code <c> --name <n> --start <time> --end <time> [--break <min>]  パターン作成（管理者）
  karte shift swap --target-employee-code <c> --date <date> [--note <n>]  交代申請
  karte shift swap-approve <id>                                 交代承認`

export default factory.createHandlers((c) => c.text(help))
