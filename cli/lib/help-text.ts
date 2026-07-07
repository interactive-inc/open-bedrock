// karte CLI のトップレベルヘルプ。引数なし・ルート直下 --help・未知コマンドの
// フォールバック表示で使う。コマンド群の網羅は test/lib/help-text.test.ts で検証し、
// 新しいコマンド群を追加して追記を忘れるとそのテストで落ちてドリフトを検知する。
export const helpText = `karte — 社内事務手続きの CLI

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
  ringi submit                稟議申請 (--approver-id --title --amount --reason)
  ringi me                    自分の稟議一覧 ([--status])
  ringi inbox                 承認待ちの稟議一覧
  ringi approve <id>          稟議を承認 ([--comment])
  ringi reject <id>           稟議を却下 (--comment)
  ringi admin                 稟議全件参照 ([--status --applicant-id --sort --limit --offset])
  attendance clock-in         出勤打刻 ([--note])
  attendance clock-out        退勤打刻 ([--note])
  attendance me               自分の勤怠 ([--from --to])
  attendance summary          月次サマリ ([--month])
  attendance list             勤怠一覧 ([--employee-id --from --to])
  room avail                  会議室空き状況 (--start --end [--capacity])
  room reserve                会議室予約 (--room-id --start --end [--purpose])
  rooms list                  会議室一覧
  rooms show <id>             会議室の詳細
  rooms create                会議室を登録 (--name --capacity [--location])
  rooms update <id>           会議室を更新 (--name --capacity [--location])
  rooms delete <id>           会議室を削除
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
  grades list                 等級マスタ一覧
  grades create               等級を作成 (--code --name --rank [--description])
  grades update               等級を更新 (--id --code --name --rank [--description])
  grades delete               等級を削除 (--id)
  grades assignments          等級の割当履歴 (--employee-id)
  grades assign               等級の割当を記録 (--employee-id --grade-id --effective-date [--reason])
  employee-events list        異動・在籍イベント履歴 (--employee-id --kind)
  employee-events record      異動・在籍イベントを記録 (--employee-id --kind --effective-date [--from --to --note])
  1on1 list                   1on1 履歴
  1on1 create                 1on1 作成 (--member-email [--topics --manager-note --next-action])
  1on1 show <id>              1on1 の詳細
  1on1 edit <id>              1on1 を更新
  1on1 mine                   自分の 1on1 一覧
  review cycles               レビューサイクル一覧
  review mine                 自分の評価依頼一覧
  review submit <id>          評価送信 (--score [--comment])
  review results <cycle> <code>  評価結果を確認(管理者)
  review cycle create         サイクル作成 (--title --period [--due])
  review cycle update         サイクルを更新 (--id --title --period [--due])
  review cycle delete         サイクルを削除 (--id)
  review cycle open           サイクルを開始 (--id)
  review cycle close          サイクルを締切 (--id)
  thanks list                 感謝のタイムライン ([--limit --offset])
  thanks send                 感謝を送る (--to --message [--points])
  thanks budget               当月の贈与原資
  thanks balance              受領残高
  thanks rewards              交換カタログ一覧
  thanks reward-add           交換カタログ登録(管理者) (--name --cost [--stock])
  thanks redeem               交換を申請 (--reward)
  thanks redemptions          交換申請一覧 ([--inbox])
  thanks redemption-approve <id>  交換申請を承認・確定
  thanks redemption-reject <id>   交換申請を却下
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
  business-trip request       出張申請 (--destination --start --end --purpose [--cost])
  business-trip mine          自分の出張申請一覧
  business-trip show          出張申請の詳細 (--id)
  business-trip update        出張申請を変更 (--id --destination --start --end --purpose [--cost])
  business-trip cancel        出張申請を取り下げ (--id)
  rental reserve              レンタル予約 (--item --start --end [--purpose])
  rental mine                 自分のレンタル予約一覧
  rental show                 レンタル予約の詳細 (--id)
  rental update               レンタル予約を変更 (--id --item --start --end [--purpose])
  rental cancel               レンタル予約を取消 (--id)
  certificate-request request 証明書発行依頼 (--type [--submit-to --needed-by --note])
  certificate-request mine    自分の証明書発行依頼一覧
  certificate-request show    証明書発行依頼の詳細 (--id)
  certificate-request update  証明書発行依頼を変更 (--id --type [--submit-to --needed-by --note])
  certificate-request cancel  証明書発行依頼を取り下げ (--id)
  family-care-leave request   産休・育休・介護休業の申出 (--kind --start --end [--note])
  family-care-leave mine      自分の産休・育休・介護休業申出一覧
  family-care-leave show      産休・育休・介護休業申出の詳細 (--id)
  family-care-leave update    産休・育休・介護休業申出を変更 (--id --kind --start --end [--note])
  family-care-leave cancel    産休・育休・介護休業申出を取り下げ (--id)
  life-event request          ライフイベント届出 (--type --date [--detail])
  life-event mine             自分のライフイベント届出一覧
  life-event show             ライフイベント届出の詳細 (--id)
  life-event update           ライフイベント届出を変更 (--id --type --date [--detail])
  life-event cancel           ライフイベント届出を取り下げ (--id)
  resignation request         退職申請 (--date [--last --reason])
  resignation mine            自分の退職申請一覧
  resignation show            退職申請の詳細 (--id)
  resignation update          退職申請を変更 (--id --date [--last --reason])
  resignation cancel          退職申請を取り下げ (--id)
  antisocial-check request    反社チェック申請 (--partner [--address --representative])
  antisocial-check mine       自分の反社チェック申請一覧
  antisocial-check show       反社チェック申請の詳細 (--id)
  antisocial-check update     反社チェック申請を変更 (--id --partner [--address --representative --result])
  antisocial-check cancel     反社チェック申請を取り下げ (--id)
  meetings list               会議体一覧
  meetings show <code>        会議体の詳細
  meetings create             会議体を登録 (--code --name [--cadence --description])
  meetings update <code>      会議体を更新 (--name [--cadence --description])
  meetings archive <code>     会議体をアーカイブ
  minutes list <meeting_code> 議事録一覧
  minutes show <id>           議事録の詳細
  minutes add <meeting_code>  議事録を記録 (--held-on --title --body [--attendees])
  minutes edit <id>           議事録を更新 (--held-on --title --body [--attendees])
  decisions list              意思決定記録の一覧
  decisions show <id>         意思決定記録の詳細
  decisions create            意思決定記録を作成 (--title --decided-on --context --decision [--consequences])
  decisions update <id>       意思決定記録を更新 (--title --decided-on --context --decision [--consequences])
  decisions supersede <id>    後続の決定で supersede (--by)
  partners list               取引先一覧 (--q --status)
  partners show <code>        取引先の詳細
  partners register           取引先を登録 (--code --name [--category --corporate-number --note])
  partners update <id>        取引先を更新 (--name [--category --corporate-number --note])
  partners archive <id>       取引先をアーカイブ
  contracts list              契約記録一覧 (--partner-id --order)
  contracts create            契約記録を作成 (--partner-id --title --contract-date [--starts-on --ends-on --renewal-deadline --note])
  contracts update <id>       契約記録を更新 (--title --contract-date [--starts-on --ends-on --renewal-deadline --note])
  batch                       バッチ状況
  roles                       ロール一覧（iam:manage_roles）
  accounts                    アカウント一覧（account:manage）
  audit-logs                  監査ログ一覧（audit_log:read）
  dashboard                   ダッシュボード集計

options:
  --help, -h                  ヘルプを表示

詳細: karte <command> --help`
