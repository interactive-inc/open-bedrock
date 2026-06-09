#!/usr/bin/env bun
import { toRequest } from "@/lib/router/router"
import { app } from "@/app"

const HELP = `karte — 社内事務手続きの CLI

usage: karte [command]

commands:
  login                       ログインしてトークンを取得 (--email --password [--base-url])
  whoami                      自分の情報を表示
  employee search             社員検索 (--q --dept --status)
  employee register           社員を登録
  employee show <code>        社員の詳細
  employee update <code>      社員情報を更新
  employee delete <code>      社員を削除
  app templates               申請テンプレート一覧 (--category)
  app template <code>         申請テンプレート詳細
  app submit <code>           申請を提出 (--data <file>)
  app inbox                   自分宛の承認待ち一覧
  app mine                    自分の申請一覧 (--status)
  app show <id>               申請の詳細
  app approve <id>            申請を承認 (--comment)
  app reject <id>             申請を却下 (--comment)
  application mine            申請一覧
  application show <id>       申請の詳細
  application update <id>     申請を更新
  application withdraw <id>   申請を取り下げ
  kb search [q]               ナレッジ検索 (--category)
  kb get <id>                 ナレッジ詳細
  kb add                      ナレッジを作成
  kb edit <id>                ナレッジを更新
  kb delete <id>              ナレッジを削除
  leave request               休暇申請 (--type --start --end [--reason])
  leave mine                  自分の休暇申請一覧
  leave show <id>             休暇申請の詳細
  leave update <id>           休暇申請を変更
  leave cancel <id>           休暇申請を取り下げ
  leave inbox                 承認待ちの休暇申請一覧
  leave approve <id>          休暇申請を承認
  leave reject <id>           休暇申請を却下
  leave balance               休暇残数
  expense submit              経費申請 (--category --amount --spent-at [--note])
  expense mine                自分の経費申請一覧
  expense update <id>         経費申請を変更
  expense delete <id>         経費申請を取り下げ
  room avail                  会議室空き状況 (--start --end [--capacity])
  room reserve                会議室予約 (--room-id --start --end [--purpose])
  skill list                  スキル一覧 (--q --category)
  skill mine                  自分のスキル
  skill set <code>            スキル登録/更新 (--level [--years --note])
  skill show <code>           登録スキルを1件表示
  skill remove <code>         スキルを削除
  goal list                   目標一覧 (--period --employee-id)
  goal create                 目標作成 (--period --title [--kpi --weight])
  goal evaluate <id>          評価登録 (--kind self|manager|final [--score --comment])
  goal show <id>              目標の詳細
  goal mine                   自分の目標一覧
  goal update <id>            目標を更新
  goal delete <id>            目標を削除
  1on1 list                   1on1 履歴
  1on1 create                 1on1 作成 (--member-email [--topics --manager-note --next-action])
  1on1 show <id>              1on1 の詳細
  1on1 edit <id>              1on1 を更新
  1on1 mine                   自分の 1on1 一覧
  survey list                 オープン中のアンケート
  survey answer <id>          アンケート回答 (--data <file>)
  survey summary <id>         アンケート集計
  survey responses            自分のアンケート回答一覧
  survey response <id>        アンケート回答の詳細
  survey edit <id>            アンケート回答を編集
  survey withdraw <id>        アンケート回答を取り下げ
  career sheet                自分のキャリアシート
  career sheet-update         キャリアシート更新 (--data <file>)
  career sheet-delete         キャリアシートを削除
  career postings             社内公募一覧
  career apply <id>           公募に応募 (--message)
  career applications         自分の応募一覧
  career application-show     応募の詳細
  career application-update   応募を更新
  career withdraw             応募を取り下げ
  training courses            研修コース一覧 (--category --status)
  training course <code>      研修コース詳細
  training course-create      研修コース作成 (--code --title --category [--description --duration --required])
  training course-update      研修コースを更新
  training course-archive     研修コースをアーカイブ
  training enrollments        受講一覧 (--employee-code)
  training mine               自分の受講一覧
  training enroll             受講申込 (--course [--employee-code --due])
  training complete <id>      受講完了 (--score)
  training cancel             受講を取り消し
  training reschedule         受講予定を変更
  training show               受講の詳細
  shift assignments           シフト割当一覧 (--from --to --department-code)
  shift mine                  自分のシフト割当一覧
  shift assign                シフト割当作成 (--employee-code --date --pattern-code [--note])
  shift publish <id>          シフト割当を公開
  shift assignment-show       シフト割当の詳細
  shift assignment-update     シフト割当を更新
  shift assignment-delete     シフト割当を削除
  shift patterns              シフトパターン一覧
  shift pattern-create        シフトパターン作成 (--code --name --start --end [--break])
  shift pattern-show          シフトパターンの詳細
  shift pattern-update        シフトパターンを更新
  shift pattern-delete        シフトパターンを削除
  shift swap                  シフト交代申請 (--target-employee-code --date [--note])
  shift swap-approve <id>     シフト交代申請を承認
  shift swap-show             シフト交代申請の詳細
  shift swap-mine             自分のシフト交代申請一覧
  shift swap-cancel           シフト交代申請を取り下げ
  org dept list               部署一覧
  org dept show               部署の詳細
  org dept create             部署を作成
  org dept update             部署を更新
  org dept delete             部署を削除
  asset update <code>         備品情報を更新
  asset delete <code>         備品を削除
  notify show <id>            通知の詳細
  notify delete <id>          通知を削除
  onboarding uncomplete <id>          オンボーディングタスクを未完了に戻す
  onboarding assignment show <id>     オンボーディング割当の詳細
  onboarding assignment update <id>   オンボーディング割当を更新
  onboarding assignment cancel <id>   オンボーディング割当を取り消し
  batch                       バッチ状況
  dashboard                   ダッシュボード集計

options:
  --help, -h                  ヘルプを表示

詳細: karte <command> --help`

const args = process.argv.slice(2)

if (args.length === 0) {
  process.stdout.write(`${HELP}\n`)
  process.exit(0)
}

const { path, url, body } = toRequest(args)

// ルート直下の help はトップヘルプを返す
if (body.help !== undefined && path === "/") {
  process.stdout.write(`${HELP}\n`)
  process.exit(0)
}

const res = await app.request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

// 未知のコマンドは、親パスの help にフォールバックする。
// ただしハンドラに到達して投げられた 404（マーカーヘッダ付き）は本物のエラーなので
// フォールバックせず stderr + exit 1 に落とす。
const isHandlerError = res.headers.get("x-karte-handler-error") === "1"

if (!res.ok && res.status === 404 && !isHandlerError) {
  const segments = path.split("/").filter(Boolean)
  for (let depth = segments.length - 1; depth >= 1; depth--) {
    const parentPath = `/${segments.slice(0, depth).join("/")}`
    const helpRes = await app.request(`http://localhost${parentPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "true" }),
    })
    if (helpRes.ok) {
      process.stdout.write(`${await helpRes.text()}\n`)
      process.exit(0)
    }
  }
  process.stdout.write(`${HELP}\n`)
  process.exit(0)
}

const contentType = res.headers.get("content-type") ?? ""
const isJson = contentType.includes("application/json")
const responseBody = isJson ? JSON.stringify(await res.json(), null, 2) : await res.text()

if (!res.ok) {
  if (responseBody) process.stderr.write(`${responseBody}\n`)
  process.exit(1)
}

if (responseBody) process.stdout.write(`${responseBody}\n`)
