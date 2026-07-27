import { factory } from "@/factory"

export const help = `bedrock onboarding-assignments — 入退社手続きの割当

usage:
  bedrock onboarding-assignments me                               自分のタスク
  bedrock onboarding-assignments show <id>                        割当の詳細
  bedrock onboarding-assignments create <employee_code> --template <code>  手続きを割当
  bedrock onboarding-assignments employees <employee_code>        社員の進捗 (管理者)`

export default factory.createHandlers((c) => c.text(help))
