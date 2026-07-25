import { factory } from "@/factory"

export const help = `bedrock leave — 休暇（残日数・申請・承認）

usage:
  bedrock leave balance                                      残日数照会
  bedrock leave request --type annual|special --start <date> --end <date> [--reason <text>]
  bedrock leave mine [--status <s>]                          自分の申請一覧
  bedrock leave inbox                                        承認待ち一覧（承認者のみ）
  bedrock leave approve <id> [--comment <c>]                 承認
  bedrock leave reject <id> --comment <c>                    却下`

export default factory.createHandlers((c) => c.text(help))
