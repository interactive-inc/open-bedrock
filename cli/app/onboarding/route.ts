import { factory } from "@/factory"

export const help = `karte onboarding — 入退社オンボーディング

usage:
  karte onboarding templates [--kind join|leave]      テンプレ一覧
  karte onboarding template-bind-lifecycle <code> --effect <hire|retired>
  karte onboarding template-unbind-lifecycle <code>
  karte onboarding assign <employee_code> --template <code>
  karte onboarding me                                 自分のタスク
  karte onboarding complete <task_id>                 タスク完了
  karte onboarding show <employee_code>               社員の進捗 (管理者)`

export default factory.createHandlers((c) => c.text(help))
