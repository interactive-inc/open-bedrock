import { factory } from "@/factory"

export const help = `karte governance <command>

commands:
  list                         規程・手続き一覧
  show <code>                  規程・手続き詳細
  sync [--path <path>]         Markdown 原本を一括同期
  impact                       組織変更・参照・期限の矛盾を検査
  submit-review <code>         指定版をレビューへ提出 (--version)
  review <code>                組織ロールとして判断 (--version --org-role --decision)
  publish <code>               承認済み又は直接公開の版を公開 (--version)
  acknowledge <code>           現行版を確認済みにする
  org-roles                    組織ロールと現在の担当者
  assign-role <role>           組織ロールを割当
  revoke-role <assignment-id>  組織ロール割当を終了`

export default factory.createHandlers((c) => c.text(help))
