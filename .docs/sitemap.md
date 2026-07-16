# Web route 仕様

規範性: 実装写像。Web route と画面責務の実装 snapshot を示す。

実装済み Web route と各 route の操作責務を列挙する。route の正本は `web/app` とし、動的 segment は `[param]` で表す。本書は route snapshot であり、API の提供、認可、業務不変条件を保証しない。未掲載 route と差異がある場合はコードを優先する。

## 認証

- ログインは専用ルートを持たない。未認証のまま任意の画面を開くと、error boundary が全画面のサインイン(LoginGate)に差し替える。サインイン後は `/` へ戻る。

## ホーム

- `/` は主要な人数、申請、サーベイの状況を一覧する画面。

## 社員と組織

- `/employees` は従業員台帳を検索し、従業員一覧を確認する画面。
- `/employees/new` は人物台帳、入社発令、初期アカウントを一括登録する画面。
- `/employees/[code]` は基本情報、現在の人事状態、人材タイムライン、承認待ちの人事変更を確認し、人事変更を申請または確定する画面。
- `/employees/[code]/timeline` は従業員の人事発令履歴をカーソルで継続表示する画面。
- `/org` は部署ツリーを閲覧し、部署ノードを管理する画面。
- `/org/departments` は部署ノードの一覧を確認し、変更や削除を行う管理画面(`org:manage`)。
- `/org/departments/new` は新しい部署ノードを作成する画面(`org:manage`)。
- `/org/departments/[code]/members` は部署に所属するメンバーを確認する画面。
- `/org/reporting-line/[code]` は指定した従業員のレポートラインを確認する画面。
- `/grades` は等級マスタの一覧を確認し、管理者(`grade:manage`)が作成、編集、削除する画面。
- `/recruitment` は採用の募集一覧と候補者パイプラインを管理する画面(`recruitment:manage`)。
- `/commendations` は表彰の一覧(社内公開)と管理者による記録を行う画面。
- `/headcount-plans` は人員計画と実在籍数を比較する画面(`headcount_plan:read:all`)。

## 管理(IAM)

- `/admin/roles` はロールの一覧と割当済み権限を確認する管理画面(`iam:manage_roles`)。
- `/admin/roles/new` は権限を選んで新しいロールを作成する画面。
- `/admin/roles/[id]/edit` はロールの名称と権限の割当を変更する画面。
- `/admin/accounts` はアカウントの状態確認、ロール割当、停止、パスワードリセットを行う管理画面(`account:manage`)。
- `/admin/audit-logs` は監査ログを操作種別や対象で絞り込んで閲覧する管理画面(`audit_log:read`)。

## 申請ワークフロー

- `/applications` は自分が提出した申請の状況を確認する画面。
- `/applications/inbox` は自分宛ての承認待ち申請を確認し、承認または却下する画面。
- `/applications/admin` は全社の申請を横断で確認する管理画面(`application:read:all`)。
- `/applications/[id]` は申請内容と承認状況を確認する詳細画面。
- `/applications/templates` は利用可能な申請テンプレートを確認し、新規申請を作成する画面。
- `/applications/templates/new` は新しい申請テンプレートの名称、カテゴリ、入力項目を登録する画面。
- `/applications/templates/[code]` は申請テンプレートの詳細を確認し、テンプレートから申請を始める画面。
- `/applications/templates/[code]/workflow` はテンプレートの多段承認、条件、期限、差戻し、代理承認可否を設定する管理画面。
- `/applications/delegations` は期間と対象テンプレートを指定して代理承認を設定する画面。

## 勤怠と休暇

- `/attendance` は出勤、退勤の打刻と、自分の勤怠記録を確認する画面。
- `/attendance/all` は管理者が従業員や期間で絞り込み、全体の勤怠記録を確認する画面。
- `/leave` は休暇残日数と自分の休暇申請状況を確認する画面。
- `/leave/new` は休暇種別、期間、理由を入力して休暇を申請する画面。
- `/leave/inbox` は承認待ちの休暇申請を確認し、承認または却下する画面。
- `/leave/admin` は全社の休暇申請を横断で確認する管理画面(`leave:read:all`)。
- `/attendance/overtime` は時間外の参考集計を確認する画面(スコープ権限で範囲を出し分け)。
- `/calendar` は会社カレンダー(休日・振替出勤日)を確認し、管理者(`calendar:manage`)が編集する画面。

## 経費

- `/expense` は自分が申請した経費の一覧と状態を確認する画面。
- `/expense/new` はカテゴリ、金額、利用日、メモを入力して経費を申請する画面。
- `/expense/[id]` は経費申請の詳細を確認する画面。
- `/expense/inbox` は承認待ちの経費申請を確認し、承認または却下する画面。
- `/expense/admin` は全社の経費申請を横断で確認する管理画面(`expense:read:all`)。

## 予算

- `/budgets` は部署と会計期間ごとの予算を一覧で確認する画面(`budget:manage`)。
- `/budgets/new` は部署、会計期間、期間、金額、名称、メモを入力して予算を登録する画面(`budget:manage`)。
- `/budgets/[id]` は予算の詳細と、承認済み経費による消化額、残額を確認し、修正や削除を行う画面(`budget:manage`)。
- `/budgets/summary` は会計期間を指定し、部署ごとの予算、消化額、残額を横断で確認する画面(`budget:manage`)。

## ナレッジ

- `/knowledge` は社内ナレッジをキーワードやカテゴリで検索する画面。
- `/knowledge/new` はナレッジ記事のタイトル、カテゴリ、本文を登録する画面。
- `/knowledge/[id]` はナレッジ記事の本文とカテゴリを確認する画面。
- `/announcements` は社内アナウンスの一覧と詳細を確認し、管理者(`announcement:manage`)が作成、公開する画面。
- `/regulations` は規程集の一覧と版履歴を確認し、管理者(`regulation:manage`)が新版を追加する画面。
- `/documents` は文書台帳(所在・期限)を確認、登録する画面(`document:read:all`)。

## 規程・手続き

- `/governance` は published status、audience、閲覧権限に応じた規程・手続きを検索する画面。現行実装は施行期間で絞り込まない。
- `/governance/[code]` は Markdown 本文、版、ProcedureDefinition、authority rule と control の宣言 metadata、公開 review、確認状態を表示する画面。
- `/governance/manage` は組織ロールの割当と、組織・参照・期限の整合性を検査する管理画面(`governance:manage`)。

## 会議室と備品

- `/rooms` は会議室の空き状況を検索し、会議室を予約する画面。
- `/rooms/me` は自分が予約した会議室の一覧を確認し、予約を取り消す画面。
- `/rooms/manage` は登録済みの会議室を編集、削除する管理画面。
- `/rooms/manage/new` は新しい会議室の名称、定員、所在地を登録する画面。
- `/assets` は種別や状態で絞り込み、備品一覧を確認する画面。
- `/assets/new` は新しい備品を備品マスタに登録する画面。
- `/assets/[code]` は備品の属性と貸与、返却、廃棄を操作する画面。
- `/assets/lent/me` は自分が借りている備品を確認する画面。
- `/assets/holdings` は現在貸出中の備品を保有者ごとに横断で確認する管理画面。
- `/stocktakes` は棚卸しセッションの一覧を確認する画面。
- `/stocktakes/new` は名称と対象日を指定して棚卸しを開始する画面。
- `/stocktakes/[id]` は対象備品ごとの現物確認を記録し、セッションを締める画面。

## スキルと目標

- `/skills` はスキルをキーワードやカテゴリで検索する画面。
- `/skills/me` は自分の登録済みスキルを確認し、新しいスキルを登録する画面。
- `/certifications` は資格・免許のマスタと保有記録を確認、管理する画面。
- `/goals` は期間と従業員で絞り込み、目標を確認する画面。
- `/goals/tree` は全社、部門、個人の目標を階層で俯瞰する画面。
- `/goals/new` は期間と内容を入力して目標を登録する画面。
- `/goals/[id]` は目標の内容、評価、状態を確認する詳細画面。

## 個別面談とサーベイ

- `/oneonone` は自分が参加した 1on1 の履歴を確認する画面。
- `/oneonone/new` は日時、相手、メモを入力して 1on1 を記録する画面。
- `/surveys` は配信中のアンケートを確認し回答する画面。
- `/surveys/responses` は自分が回答したアンケートを確認する画面。
- `/surveys/[surveyId]` は指定したアンケートに回答する画面。
- `/surveys/[surveyId]/summary` はアンケートの回答件数と設問別集計を確認する画面。
- `/surveys/manage` は実施中のアンケートを確認、編集、削除する管理画面。
- `/surveys/manage/new` は新しいアンケートのタイトルと設問を登録する画面。
- `/surveys/[surveyId]/edit` はアンケートのタイトル、状態、設問を変更する画面。

## キャリア

- `/career` はキャリアシートの編集と自分の応募状況を確認する画面。
- `/career/postings` は募集中の社内公募を閲覧し、応募先を探す画面。
- `/career/postings/new` は管理者が新しい社内公募を登録する画面。
- `/career/postings/[id]` は公募内容を確認し応募する詳細画面。
- `/career/postings/[id]/edit` は管理者が公募内容と状態を変更する画面。

## オンボーディング

- `/onboarding` はオンボーディングのテンプレート管理と社員への割り当てを行う画面。
- `/onboarding/me` は自分に割り当てられた未完了タスクを確認する画面。
- `/onboarding/employees` は閲覧権限を持つ担当者が社員を選び、進行状況へ移動する画面。
- `/onboarding/employee/[code]` は社員ごとのオンボーディング進行状況を確認する画面。
- `/onboarding/templates` は入社、退社のオンボーディングテンプレートと人事発令からの自動割当を管理する画面。
- `/onboarding/templates/new` はオンボーディングタスクをテンプレートとして登録する画面。
- `/onboarding/assignments/new` は社員コードとテンプレートを指定して割り当てを作成する画面。

## 評価

- `/review` は評価サイクルと自分の評価フォームを確認する画面。
- `/review/manage` は評価サイクルの作成と評価結果の横断検索を行う管理画面。
- 評価サイクル作成時に、組織図から割り当てる評価者種別と同僚評価者数を設定する。
- `/review/results` は評価結果を検索し確認する管理画面。

## シフト

- `/shift` は自分のシフトと交代申請を管理する画面。
- `/shift/inbox` は自分が当事者でないシフト交代申請を承認する画面(`shift:manage`)。
- `/shift/admin` は全社のシフト交代申請を横断で確認する管理画面(`shift_swap:read:all`)。
- `/shift/manage` は全員のシフト割当を確認する管理画面(`shift:manage`)。
- `/shift/manage/new` は対象社員、パターン、対象日を指定してシフト割当を作成する画面(`shift:manage`)。
- `/shift/patterns` はシフトの定型パターンを一覧する画面。
- `/shift/patterns/new` はコード、名前、開始と終了の時刻、休憩時間を登録してシフトパターンを作成する画面(`shift:manage`)。

## 研修

- `/training` は研修コースの一覧から受講を申し込む画面。
- `/training/new` は研修コースの基本情報を登録する管理画面。
- `/training/me` は自分の受講中、受講済みコースを確認する画面。
- `/training/[code]` は研修コースの詳細を確認し、受講登録や完了操作を行う画面。
- `/training/[code]/edit` は研修コースの内容を変更する管理画面。

## 通知

- `/notifications` は自分宛ての通知を確認し、既読にする画面。
- `/notifications/new` は宛先、種別、タイトル、本文を入力して通知を送る画面(`notification:send`)。

## 感謝

- `/thanks` はサンクスポイントの残量と、社内の感謝を見渡す画面。
- `/thanks/send` は送り先と感謝メッセージを入力し、任意でポイントを添えて送る画面。
- `/thanks/rewards` は受領残高で交換できる景品を確認し、交換を申請する画面。
- `/thanks/inbox` は自分以外のサンクス交換申請を承認または却下する画面(`thanks_redemption:approve`)。
- `/thanks/admin` は全社のサンクス交換申請を横断で確認する管理画面(`thanks_redemption:read:all`)。
- `/thanks/rewards/manage` は管理者が新しい景品を登録する画面。

## 労務とライフイベント手続き

- `/business-trips` は出張申請と申請状況を確認する画面。
- `/business-trips/new` は出張先、期間、目的を記入して出張を申請する画面。
- `/rentals` は自分の貸与品利用申出を確認する画面。route 名は現行実装を表し、資源確保済みの Reservation を意味しない。
- `/rentals/new` は品名と利用期間を指定して貸与品の利用を申し出る画面。備品台帳の個体や在庫は確保しない。
- `/resignations` は退職申請と申請状況を確認する画面。
- `/resignations/new` は退職予定日と理由を記入して退職を申請する画面。
- `/life-events` は結婚、出産などのライフイベント届出を確認する画面。
- `/life-events/new` はイベント種別と発生日を記入してライフイベントを届け出る画面。
- `/family-care-leaves` は産休、育休、介護休業の申出状況を確認する画面。
- `/family-care-leaves/new` は休業の種別と期間を記入して申し出る画面。
- `/certificate-requests` は在職証明など各種証明書の発行依頼と進捗を確認する画面。
- `/certificate-requests/new` は証明書の種類と用途を記入して発行を依頼する画面。
- `/antisocial-checks` は反社チェック申請と申請状況を確認する画面。
- `/antisocial-checks/new` は対象者と確認内容を記入して反社チェックを申請する画面。
- `/certificate-requests/admin` は全社の証明書発行依頼を横断で確認する管理画面(`certificate_request:read:all`)。
- `/resignations/admin` は全社の退職手続きを横断で確認する管理画面(`resignation:read:all`)。
- `/life-events/admin` は全社のライフイベント届を横断で確認する管理画面(`life_event:read:all`)。
- `/family-care-leaves/admin` は全社の産休・育休・介護休業の申出を横断で確認する管理画面(`family_care_leave:read:all`)。
- `/business-trips/admin` は全社の出張申請を横断で確認する管理画面(`business_trip:read:all`)。
- `/rentals/admin` は全社の貸与品予約を横断で確認する管理画面(`rental:read:all`)。
- `/antisocial-checks/admin` は管理担当者が自分以外の申請へ確認結果を記録する画面(`antisocial_check:manage`)。
- `/health-checkups` は健康診断・ストレスチェックの実施記録を管理する画面(`health_checkup:read:all`)。
- `/work-accidents` は労災・事故の発生記録を確認、登録する画面(`work_accident:read:all`)。

## 経営と対外

- `/ringi` は自分が起案した稟議の一覧と状態を確認する画面。
- `/ringi/new` は承認者、金額、理由を記入して稟議を起案する画面。
- `/ringi/inbox` は自分宛の決裁待ち稟議を承認または却下する画面。
- `/ringi/admin` は全社の稟議を横断で確認する管理画面(`ringi:read:all`)。
- `/partners` は取引先台帳を検索し、登録する画面。
- `/partners/new` は新しい取引先を登録する画面(`partner:manage`)。
- `/partners/[code]` は取引先の詳細と契約記録を確認する画面(契約は `contract:read:all`)。
- `/dashboard/management` は経営ダッシュボードを確認する画面(`management_dashboard:view`)。
- `/meetings` は会議体の一覧を確認し、登録済みの会議体へ移動する画面。
- `/meetings/new` は会議体のコードと名称を登録する画面(`meeting:manage`)。
- `/meetings/[code]` は会議体の詳細と議事録一覧を確認し、議事録を記録する画面。
- `/decisions` は会社の意思決定記録を一覧する画面。
- `/decisions/new` は意思決定記録を ADR 形式で作成する画面(`decision:manage`)。
- `/decisions/[id]` は意思決定記録の背景、決定、帰結を確認する画面。

## システム

- `/batch` はバックグラウンドで実行されるバッチジョブの最新状況を確認する画面。
- `/settings` は表示テーマや表示言語の個人設定を変更する画面。
- `/licenses` はライセンス・SaaS 台帳を確認、管理する画面(`license:read:all`)。
- `/it-incidents` はインシデントの発生と解消を記録する画面(`it_incident:read:all`)。
