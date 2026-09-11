import { factory } from "@/factory"

export const help = `bedrock leave-requests — 休暇（残日数・申請・承認）

usage:
  bedrock leave-requests balance                                      残日数照会
  bedrock leave-requests request --type <type> --start <date> --end <date> [--unit <unit>] [--hours <n>] [--reason <text>]
                                                                        --type: annual|special|compensatory|summer|child_nursing_care|prenatal_checkup|menstrual|caregiving_leave
  bedrock leave-requests mine [--status <s>]                          自分の申請一覧
  bedrock leave-requests inbox                                        承認待ち一覧（承認者のみ）

  bedrock leave-requests procedure --id <id> [--operation submit|approve|reject|complete|cancel]

判断対象は procedure または inbox で確認し、--decision-target に同じJSONを指定する。`

export default factory.createHandlers((c) => c.text(help))
