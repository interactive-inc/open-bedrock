#!/usr/bin/env bun
import { toRequest } from "@/lib/router/router"
import { app } from "@/app"

const HELP = `karte — 社内事務手続きの CLI

usage: karte [command]

commands:
  login                       ログインしてトークンを取得 (--email --password [--base-url])
  whoami                      自分の情報を表示
  employee search             社員検索 (--q --dept --status)
  app templates               申請テンプレート一覧 (--category)
  app template <code>         申請テンプレート詳細
  app submit <code>           申請を提出 (--data <file>)
  app inbox                   自分宛の承認待ち一覧
  app mine                    自分の申請一覧 (--status)
  app show <id>               申請の詳細
  app approve <id>            申請を承認 (--comment)
  app reject <id>             申請を却下 (--comment)
  kb search [q]               ナレッジ検索 (--category)
  kb get <id>                 ナレッジ詳細
  room avail                  会議室空き状況 (--start --end [--capacity])
  room reserve                会議室予約 (--room-id --start --end [--purpose])
  skill list                  スキル一覧 (--q --category)
  skill mine                  自分のスキル
  skill set <code>            スキル登録/更新 (--level [--years --note])
  goal list                   目標一覧 (--period --employee-id)
  goal create                 目標作成 (--period --title [--kpi --weight])
  goal evaluate <id>          評価登録 (--kind self|manager|final [--score --comment])
  1on1 list                   1on1 履歴
  1on1 create                 1on1 作成 (--member-email [--topics --manager-note --next-action])
  survey list                 オープン中のアンケート
  survey answer <id>          アンケート回答 (--data <file>)
  survey summary <id>         アンケート集計
  career sheet                自分のキャリアシート
  career sheet-update         キャリアシート更新 (--data <file>)
  career postings             社内公募一覧
  career apply <id>           公募に応募 (--message)
  training courses            研修コース一覧 (--category --status)
  training course <code>      研修コース詳細
  training course-create      研修コース作成 (--code --title --category [--description --duration --required])
  training enrollments        受講一覧 (--employee-code)
  training mine               自分の受講一覧
  training enroll             受講申込 (--course [--employee-code --due])
  training complete <id>      受講完了 (--score)
  shift assignments           シフト割当一覧 (--from --to --department-code)
  shift mine                  自分のシフト割当一覧
  shift assign                シフト割当作成 (--employee-code --date --pattern-code [--note])
  shift publish <id>          シフト割当を公開
  shift patterns              シフトパターン一覧
  shift pattern-create        シフトパターン作成 (--code --name --start --end [--break])
  shift swap                  シフト交代申請 (--target-employee-code --date [--note])
  shift swap-approve <id>     シフト交代申請を承認
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
