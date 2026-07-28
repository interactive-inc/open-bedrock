import { factory } from "@/factory"

export const help = `bedrock shift — シフト割当 + パターン + 交代申請

usage:
  bedrock shift assignments [--from <date>] [--to <date>] [--department-code <c>]  割当一覧
  bedrock shift mine                                              自分の割当一覧
  bedrock shift assign --employee-code <c> --date <date> --pattern-code <c> [--note <n>]  割当作成（管理者）
  bedrock shift publish <id>                                      割当公開
  bedrock shift patterns                                          シフトパターン一覧
  bedrock shift pattern-create --code <c> --name <n> --start <time> --end <time> [--break <min>]  パターン作成（管理者）
  bedrock shift swap --target-employee-code <c> --date <date> [--note <n>]  交代申請
  bedrock shift swap-approve <id>                                 交代承認`

export default factory.createHandlers((c) => c.text(help))
