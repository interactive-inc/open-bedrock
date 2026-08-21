/**
 * bedrock CLI のトップレベルヘルプ。引数なし・ルート直下 --help・未知コマンドの
 * フォールバック表示で使う。コマンド群の網羅は test/lib/help-text.test.ts で検証し、
 * 新しいコマンド群を追加して追記を忘れるとそのテストで落ちてドリフトを検知する。
 */
export const helpText = `bedrock — 社内事務手続きの CLI

usage: bedrock [command]

commands:
  login                                       ログインしてトークンを取得 (--email --password [--base-url])
  bootstrap                                   初期 ROOT を1度だけ作成 (--email --password --name [--code --token])
  whoami                                      自分の情報を表示
  employees search                            社員検索 (--q --dept --status)
  employees register                          社員を登録
  employees show <code>                       社員の詳細
  employees update <code>                     社員情報を更新
  employees timeline                          入社・配属・異動・退職の履歴
  employees state                             基準日現在の人事状態
  employees archive                           退職者を履歴保持してアーカイブ
  personnel-actions request                   人事変更を承認申請
  personnel-actions apply                     人事発令を直接確定
  personnel-actions correct                   確定済み発令を追記訂正
  application-requests templates              申請テンプレート一覧 (--category)
  application-requests template <code>        申請テンプレート詳細
  application-requests submit <code>          申請を提出 (--data <file>)
  application-requests inbox                  自分宛の承認待ち一覧
  application-requests mine                   自分の申請一覧 (--status)
  application-requests show <id>              申請の詳細
  application-requests approve <id>           申請を承認 (--comment)
  application-requests reject <id>            申請を却下 (--comment)
  application-requests workflow-repair list   修復が必要な承認フロー一覧
  application-requests workflow-repair reassign <id>  承認候補を再割当 (--candidates <id,id,...> --reason <text>)
  application-requests mine                   申請一覧
  application-requests show <id>              申請の詳細
  application-requests update <id>            申請を更新
  application-requests withdraw <id>          申請を取り下げ
  knowledge-articles search [q]               ナレッジ検索 (--category)
  knowledge-articles get <id>                 ナレッジ詳細
  knowledge-articles add                      ナレッジを作成
  knowledge-articles edit <id>                ナレッジを更新
  knowledge-articles delete <id>              ナレッジを削除
  announcements list                          社内アナウンス一覧 (--status)
  announcements show <id>                     アナウンス詳細
  announcements create                        アナウンスを下書き作成 (--title --body)
  announcements update <id>                   アナウンスを更新 (--title --body)
  announcements publish <id>                  公開して全社へ通知
  announcements archive <id>                  アナウンスをアーカイブ
  regulations list                            規程一覧 (--status)
  regulations show <code>                     規程詳細（最新版＋版一覧）
  regulations register                        規程を新規登録 (--code --title --body --effective-on [--category --note])
  regulations add-version <code>              新版を追加 (--body --effective-on [--note])
  regulations archive <code>                  規程をアーカイブ
  document-ledger-entries list                文書台帳一覧（期限の近い順） (--category)
  document-ledger-entries register            文書を登録 (--title --location [--category --partner-code --expires-on --note])
  document-ledger-entries update <id>         文書を更新 (--title --location [--category --partner-code --expires-on --note])
  governance-documents list                   規程・手続き一覧
  governance-documents show <code>            規程・手続き詳細
  governance-documents sync                   .docs/governance の Markdown 原本を同期 ([--path])
  governance-documents impact                 組織変更・参照・期限の矛盾を検査
  governance-documents submit-review <code>   指定版をレビューへ提出 (--version)
  governance-documents review <code>          組織ロールとして判断 (--version --org-role --decision)
  governance-documents publish <code>         指定版を公開 (--version)
  governance-documents acknowledge <code>     現行版を確認済みにする
  governance-org-roles list                   組織ロールと現在の担当者
  governance-org-roles assign <role>          組織ロールを割当
  governance-org-roles revoke <id> 組織ロール割当を終了
  leave-requests request                      休暇申請 (--type --start --end [--reason])
  leave-requests mine                         自分の休暇申請一覧
  leave-requests show <id>                    休暇申請の詳細
  leave-requests update <id>                  休暇申請を変更
  leave-requests cancel <id>                  休暇申請を取り下げ
  leave-requests inbox                        承認待ちの休暇申請一覧
  leave-requests approve <id>                 休暇申請を承認
  leave-requests reject <id>                  休暇申請を却下
  leave-balances list                         休暇残数
  expenses submit                             経費申請 (--category --amount --spent-at [--note --file])
  expenses mine                               自分の経費申請一覧
  expenses update <id>                        経費申請を変更
  expenses delete <id>                        経費申請を取り下げ
  ringi-requests submit                       稟議申請 (--approver-id --title --amount --reason)
  ringi-requests me                           自分の稟議一覧 ([--status])
  ringi-requests inbox                        承認待ちの稟議一覧
  ringi-requests approve <id>                 稟議を承認 ([--comment])
  ringi-requests reject <id>                  稟議を却下 (--comment)
  ringi-requests admin                        稟議全件参照 ([--status --applicant-id --sort --limit --offset])
  department-budgets list                     部署予算一覧 ([--department-id --fiscal-period])
  department-budgets show <id>                予算詳細（消化額・残額）
  department-budgets summary                  部署ごとの消化状況 (--fiscal-period)
  department-budgets create                   予算を登録 (--department-id --fiscal-period --period-start --period-end --amount --name [--note])
  department-budgets update <id>              予算の金額・名称・メモを修正 (--amount --name [--note])
  department-budgets delete <id>              予算を削除
  attendance-records clock-in                 出勤打刻 ([--note])
  attendance-records clock-out                退勤打刻 ([--note])
  attendance-records me                       自分の勤怠 ([--from --to])
  attendance-records summary                  月次サマリ ([--month])
  attendance-records list                     勤怠一覧 ([--employee-id --from --to])
  attendance-records overtime                 時間外の参考集計 ([--month --scope])
  rooms availability                          会議室空き状況 (--start --end [--capacity])
  room-reservations create                    会議室予約 (--room-id --start --end [--purpose])
  rooms list                                  会議室一覧
  rooms show <id>                             会議室の詳細
  rooms create                                会議室を登録 (--name --capacity [--location])
  rooms update <id>                           会議室を更新 (--name --capacity [--location])
  rooms delete <id>                           会議室を削除
  skill-definitions list                      スキル一覧 (--q --category)
  employee-skills me                          自分のスキル
  employee-skills set <code>                  スキル登録/更新 (--level [--years --note])
  skill-definitions show <code>               登録スキルを1件表示
  employee-skills remove <code>               スキルを削除
  performance-goals list                      目標一覧 (--period --employee-id)
  performance-goals create                    目標作成 (--period --title [--kpi --weight])
  performance-goals evaluate <id>             評価登録 (--kind self|manager|final [--score --comment])
  performance-goals show <id>                 目標の詳細
  performance-goals mine                      自分の目標一覧
  performance-goals update <id>               目標を更新
  performance-goals delete <id>               目標を削除
  evaluation-sheets list                      評価シート一覧・管理者のみ (--period --status --employee-id)
  evaluation-sheets mine                      自分の評価シート一覧 (--period --status)
  evaluation-sheets show                      評価シートを1件表示 (--id)
  evaluation-sheets create                    評価シート作成 (--employee-id --period [--template-id --primary-evaluator-id --secondary-evaluator-id])
  evaluation-sheets transition                評価シートの状態遷移 (--id --status --expected-revision [--note])
  evaluation-sheets evaluators                評価者の割当変更 (--id --primary-evaluator-id --expected-revision [--secondary-evaluator-id])
  grade-definitions list                      等級マスタ一覧
  grade-definitions create                    等級を作成 (--code --name --rank [--description])
  grade-definitions update                    等級を更新 (--id --code --name --rank [--description])
  grade-definitions delete                    等級を削除 (--id)
  employee-grades list                        等級の割当履歴 (--employee-id)
  employee-grades create                      等級の割当を記録 (--employee-id --grade-id --effective-date [--reason])
  position-definitions list                   役職マスタ一覧
  position-definitions create                 役職を作成 (--code --name --rank [--description])
  position-definitions update                 役職を更新 (--id --code --name --rank [--description])
  position-definitions delete                 役職を削除 (--id)
  company-calendar-days list                  会社カレンダー一覧 ([--year])
  company-calendar-days add                   会社休日/振替出勤日を記録 (--date --kind [--name])
  company-calendar-days delete                会社カレンダーを削除 (--id)
  employee-work-styles list                   勤務形態一覧 ([--employee-id])
  employee-work-styles add                    勤務形態を記録 (--employee-id --style --starts-on [--ends-on --note])
  employee-events list                        異動・在籍イベント履歴 (--employee-id --kind)
  employee-events record                      異動・在籍イベントを記録 (--employee-id --kind --effective-date [--from --to --note])
  one-on-ones list                            one-on-ones 履歴
  one-on-ones create                          one-on-ones 作成 (--member-email [--topics --manager-note --next-action])
  one-on-ones show <id>                       one-on-ones の詳細
  one-on-ones edit <id>                       one-on-ones を更新
  one-on-ones mine                            自分の 1on1 一覧
  review-cycles list                          レビューサイクル一覧
  review-forms mine                           自分の評価依頼一覧
  review-forms list                           被評価者ごとのフォーム/提出状況 (--subject-employee-id [--cycle-id])
  review-forms bulk                           フォームを一括作成/360度 (--cycle-id --forms <file>)(管理者)
  review-cycles disclose                      サイクル内の全フォームを一括開示 (--cycle-id)(管理者)
  review-forms submit <id>                    評価送信 (--score [--comment])
  review-cycles results <cycle> <code>        評価結果を確認(管理者)
  review-cycles create                        サイクル作成 (--title --period [--due])
  review-cycles update                        サイクルを更新 (--id --title --period [--due])
  review-cycles delete                        サイクルを削除 (--id)
  review-cycles open                          サイクルを開始 (--id)
  review-cycles close                         サイクルを締切 (--id)
  thanks-messages list                        感謝のタイムライン ([--limit --offset])
  thanks-messages send                        感謝を送る (--to --message [--points])
  thanks-point-budgets me                     当月の贈与原資（送れる枠）
  thanks-point-balances me                    受領残高（もらった点数の残り）
  thanks-rewards list                         交換カタログ一覧
  thanks-rewards create                       交換カタログ登録(管理者) (--name --cost [--stock])
  thanks-redemptions create                   交換を申請 (--reward)
  thanks-redemptions list                     交換申請一覧 ([--inbox])
  thanks-redemptions approve <id>             交換申請を承認・確定
  thanks-redemptions reject <id>              交換申請を却下
  surveys list                                オープン中のアンケート
  surveys answer <id>                         アンケート回答 (--data <file>)
  surveys summary <id>                        アンケート集計
  surveys responses                           自分のアンケート回答一覧
  surveys response <id>                       アンケート回答の詳細
  surveys edit <id>                           アンケート回答を編集
  surveys withdraw <id>                       アンケート回答を取り下げ
  career-sheets show                          自分のキャリアシート
  career-sheets update                        キャリアシート更新 (--data <file>)
  career-sheets delete                        キャリアシートを削除
  career-postings list                        社内公募一覧
  career-applications create <id>             公募に応募 (--message)
  career-applications list                    自分の応募一覧
  career-applications show                    応募の詳細
  career-applications update                  応募を更新
  career-applications withdraw                応募を取り下げ
  training-courses list                       研修コース一覧 (--category --status)
  training-courses show <code>                研修コース詳細
  training-courses create                     研修コース作成 (--code --title --category [--description --duration --required])
  training-courses update                     研修コースを更新
  training-courses archive                    研修コースをアーカイブ
  training-enrollments list                   受講一覧 (--employee-code)
  training-enrollments mine                   自分の受講一覧
  training-enrollments create                 受講申込 (--course [--employee-code --due])
  training-enrollments complete <id>          受講完了 (--score)
  training-enrollments cancel                 受講を取り消し
  training-enrollments reschedule             受講予定を変更
  training-enrollments show                   受講の詳細
  shift-assignments list                      シフト割当一覧 (--from --to --department-code)
  shift-assignments mine                      自分のシフト割当一覧
  shift-assignments create                    シフト割当作成 (--employee-code --date --pattern-code [--note])
  shift-assignments publish <id>              シフト割当を公開
  shift-assignments show                      シフト割当の詳細
  shift-assignments update                    シフト割当を更新
  shift-assignments delete                    シフト割当を削除
  shift-patterns list                         シフトパターン一覧
  shift-patterns create                       シフトパターン作成 (--code --name --start --end [--break])
  shift-patterns show                         シフトパターンの詳細
  shift-patterns update                       シフトパターンを更新
  shift-patterns delete                       シフトパターンを削除
  shift-swap-requests create                  シフト交代申請 (--target-employee-code --date [--note])
  shift-swap-requests approve <id>            シフト交代申請を承認
  shift-swap-requests show                    シフト交代申請の詳細
  shift-swap-requests mine                    自分のシフト交代申請一覧
  shift-swap-requests cancel                  シフト交代申請を取り下げ
  departments list                            部署一覧
  departments show                            部署の詳細
  departments create                          部署を作成
  departments update                          部署を更新
  departments delete                          部署を削除
  assets update <code>                        備品情報を更新
  assets delete <code>                        備品を削除
  assets dispose <code>                       備品を廃棄 (--reason [--disposed-on])
  assets holdings                             保有状況一覧（誰が何を持っているか）
  stocktakes list                             棚卸しセッション一覧 ([--status])
  stocktakes start                            棚卸しを開始 (--name --target-date)
  stocktakes show <id>                        棚卸しの詳細（確認状況）
  stocktakes check <id>                       現物確認を記録 (--asset-code [--location-note])
  stocktakes close <id>                       棚卸しを締める
  notifications show <id>                     通知の詳細
  notifications delete <id>                   通知を削除
  onboarding-tasks uncomplete <id>            オンボーディングタスクを未完了に戻す
  onboarding-assignments show <id>            オンボーディング割当の詳細
  onboarding-assignments update <id>          オンボーディング割当を更新
  onboarding-assignments cancel <id>          オンボーディング割当を取り消し
  onboarding-templates bind-lifecycle <code>  入退社イベントのテンプレートを設定 (--effect hire|retired)
  onboarding-templates unbind-lifecycle <code>  入退社イベントのテンプレート連携を解除
  business-trips request                      出張申請 (--destination --start --end --purpose [--cost])
  business-trips mine                         自分の出張申請一覧
  business-trips show                         出張申請の詳細 (--id)
  business-trips update                       出張申請を変更 (--id --destination --start --end --purpose [--cost])
  business-trips cancel                       出張申請を取り下げ (--id)
  certification-definitions                   資格マスタ一覧
  certification-definitions create            資格マスタ作成 (--code --name [--issuer --description])
  certification-definitions update <id>       資格マスタを更新 (--name [--issuer --description])
  certification-definitions records           資格保有記録一覧 ([--employee-id])
  certification-definitions record-add        資格保有記録を追加 (--employee-id --certification-id --acquired [--expires --note])
  certification-definitions record-remove <id> 資格保有記録を削除
  health-checkups                             健診・ストレスチェックの実施記録一覧 ([--fiscal-year --employee-id])
  health-checkups create                      実施記録を作成 (--employee-id --fiscal-year --kind [--status --conducted --note])
  health-checkups complete <id> 実施記録を完了 (--conducted)
  work-accidents                              労災・事故の発生記録一覧 ([--status --employee-id])
  work-accidents create                       発生記録を作成 (--occurred --summary [--employee-id --location --severity])
  work-accidents close <id>                   発生記録を closed にする
  rental-reservations reserve                 レンタル予約 (--item --start --end [--purpose])
  rental-reservations mine                    自分のレンタル予約一覧
  rental-reservations show                    レンタル予約の詳細 (--id)
  rental-reservations update                  レンタル予約を変更 (--id --item --start --end [--purpose])
  rental-reservations cancel                  レンタル予約を取消 (--id)
  certificate-requests request 証明書発行依頼 (--type [--submit-to --needed-by --note])
  certificate-requests mine                   自分の証明書発行依頼一覧
  certificate-requests show                   証明書発行依頼の詳細 (--id)
  certificate-requests update                 証明書発行依頼を変更 (--id --type [--submit-to --needed-by --note])
  certificate-requests cancel                 証明書発行依頼を取り下げ (--id)
  family-care-leaves request                  産休・育休・介護休業の申出 (--kind --start --end [--note])
  family-care-leaves mine                     自分の産休・育休・介護休業申出一覧
  family-care-leaves show                     産休・育休・介護休業申出の詳細 (--id)
  family-care-leaves update                   産休・育休・介護休業申出を変更 (--id --kind --start --end [--note])
  family-care-leaves cancel                   産休・育休・介護休業申出を取り下げ (--id)
  life-events request                         ライフイベント届出 (--type --date [--detail])
  life-events mine                            自分のライフイベント届出一覧
  life-events show                            ライフイベント届出の詳細 (--id)
  life-events update                          ライフイベント届出を変更 (--id --type --date [--detail])
  life-events cancel                          ライフイベント届出を取り下げ (--id)
  resignations request                        退職申請 (--date [--last --reason])
  resignations mine                           自分の退職申請一覧
  resignations show                           退職申請の詳細 (--id)
  resignations update                         退職申請を変更 (--id --date [--last --reason])
  resignations cancel                         退職申請を取り下げ (--id)
  antisocial-checks request                   反社チェック申請 (--partner [--address --representative])
  antisocial-checks mine                      自分の反社チェック申請一覧
  antisocial-checks show                      反社チェック申請の詳細 (--id)
  antisocial-checks update                    反社チェック申請を変更 (--id --partner [--address --representative --result])
  antisocial-checks cancel                    反社チェック申請を取り下げ (--id)
  meetings list                               会議体一覧
  meetings show <code>                        会議体の詳細
  meetings create                             会議体を登録 (--code --name [--cadence --description])
  meetings update <code>                      会議体を更新 (--name [--cadence --description])
  meetings archive <code>                     会議体をアーカイブ
  meeting-minutes-records list <meeting_code> 議事録一覧
  meeting-minutes-records show <id>           議事録の詳細
  meeting-minutes-records add <meeting_code>  議事録を記録 (--held-on --title --body [--attendees])
  meeting-minutes-records edit <id>           議事録を更新 (--held-on --title --body [--attendees])
  decision-records list                       意思決定記録の一覧
  decision-records show <id>                  意思決定記録の詳細
  decision-records create                     意思決定記録を作成 (--title --decided-on --context --decision [--consequences])
  decision-records update <id>                意思決定記録を更新 (--title --decided-on --context --decision [--consequences])
  decision-records supersede <id>             後続の決定で supersede (--by)
  partners list                               取引先一覧 (--q --status)
  partners show <code>                        取引先の詳細
  partners register                           取引先を登録 (--code --name [--category --corporate-number --note])
  partners update <id>                        取引先を更新 (--name [--category --corporate-number --note])
  partners archive <id>                       取引先をアーカイブ
  partner-contracts list                      契約記録一覧 (--partner-id --order)
  partner-contracts create                    契約記録を作成 (--partner-id --title --contract-date [--starts-on --ends-on --renewal-deadline --note])
  partner-contracts update <id>               契約記録を更新 (--title --contract-date [--starts-on --ends-on --renewal-deadline --note])
  job-openings list                           募集一覧 (--status) ※recruitment:manage
  job-openings create 募集を作成 (--title [--department-code --status --note])
  job-openings update <id> 募集を更新 (--title --status [--department-code --note])
  recruitment-candidates list <position_id> 応募者一覧
  recruitment-candidates create <position_id> 応募者を追加 (--name [--email --source --note])
  recruitment-candidates advance <candidate_id> 選考ステージを前進 (--stage)
  commendations list                          表彰の記録一覧 (--employee-id) ※閲覧は全認証者
  commendations create                        表彰を記録 (--employee-id --title --reason --awarded-on)
  commendations delete <id>                   表彰の記録を削除
  disciplinary-actions list                   懲戒の記録一覧 (--employee-id) ※read:all・本人にも非公開
  disciplinary-actions create 懲戒を記録 (--employee-id --kind --summary --decided-on)
  headcount-plans list                        人員計画一覧 (--fiscal-year) ※実在籍数つき・read:all
  headcount-plans create                      人員計画を作成 (--fiscal-year --planned-count [--department-code --note])
  headcount-plans update <id> 人員計画を更新 (--planned-count [--note])
  software-licenses list                      ライセンス・SaaS 台帳一覧 (--status) ※read:all
  software-licenses create                    ライセンスを登録 (--name [--vendor --category --seats --renewal-deadline --owner-employee-id --note])
  software-licenses update <id>               ライセンスを更新 (--name [--vendor --category --seats --renewal-deadline --owner-employee-id --note])
  software-licenses cancel <id>               ライセンスを解約
  it-incidents list                           インシデント記録一覧 (--status) ※read:all
  it-incidents create                         インシデントを記録 (--occurred-at --title --summary [--severity])
  it-incidents resolve <id>                   インシデントを解消済みにする
  salary-revisions list                       給与改定履歴 (--employee-id) ※最機微・salary_revision 権限のみ
  salary-revisions create                     給与改定を記録 (--employee-id --effective-date --previous-base-salary --new-base-salary [--reason])
  batch                                       バッチ状況
  roles                                       ロール一覧（iam:manage_roles）
  accounts                                    アカウント一覧（account:manage）
  dashboard                                   ダッシュボード集計

options:
  --help, -h                  ヘルプを表示

詳細: bedrock <command> --help`
