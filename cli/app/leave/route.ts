import { factory } from "@/factory"

export const help = `karte leave — 休暇（残日数・申請・承認）

usage:
  karte leave balance                                      残日数照会
  karte leave request --type annual|special --start <date> --end <date> [--reason <text>]
  karte leave mine [--status <s>]                          自分の申請一覧
  karte leave inbox                                        承認待ち一覧（承認者のみ）
  karte leave approve <id> [--comment <c>]                 承認
  karte leave reject <id> --comment <c>                    却下`

export default factory.createHandlers((c) => c.text(help))
