import { factory } from "@/factory"

export const help = `karte announcements — 社内アナウンス

usage:
  karte announcements list [--status draft|published|archived]   アナウンス一覧
  karte announcements show <id>                                  アナウンス詳細
  karte announcements create --title <t> --body <md>             アナウンスを下書き作成
  karte announcements update <id> --title <t> --body <md>        アナウンスを更新
  karte announcements publish <id>                               公開して全社へ通知
  karte announcements archive <id>                               アーカイブ`

export default factory.createHandlers((c) => c.text(help))
