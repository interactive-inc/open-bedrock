import { factory } from "@/factory"

export const help = `bedrock governance-org-roles <command>

commands:
  list                         組織ロールと現在の担当者
  assign <role>                組織ロールを割当
  revoke <assignment-id>       組織ロール割当を終了`

export default factory.createHandlers((c) => c.text(help))
