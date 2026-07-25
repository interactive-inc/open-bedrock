import { factory } from "@/factory"

export const help = `bedrock announcements — 社内アナウンス

usage:
  bedrock announcements list [--status draft|published|archived]   アナウンス一覧
  bedrock announcements show <id>                                  アナウンス詳細
  bedrock announcements create --title <t> --body <md>             アナウンスを下書き作成
  bedrock announcements update <id> --title <t> --body <md>        アナウンスを更新
  bedrock announcements publish <id>                               公開して全社へ通知
  bedrock announcements archive <id>                               アーカイブ`

export default factory.createHandlers((c) => c.text(help))
