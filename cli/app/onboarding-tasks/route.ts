import { factory } from "@/factory"

export const help = `bedrock onboarding-tasks — 入退社手続きのタスク

usage:
  bedrock onboarding-tasks complete <task_id>                     タスク完了
  bedrock onboarding-tasks uncomplete <task_id>                   タスク完了の取消`

export default factory.createHandlers((c) => c.text(help))
