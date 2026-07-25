import { factory } from "@/factory"

export const help = `bedrock onboarding — 入退社オンボーディング

usage:
  bedrock onboarding templates [--kind join|leave]      テンプレ一覧
  bedrock onboarding template-bind-lifecycle <code> --effect <hire|retired>
  bedrock onboarding template-unbind-lifecycle <code>
  bedrock onboarding assign <employee_code> --template <code>
  bedrock onboarding me                                 自分のタスク
  bedrock onboarding complete <task_id>                 タスク完了
  bedrock onboarding show <employee_code>               社員の進捗 (管理者)`

export default factory.createHandlers((c) => c.text(help))
