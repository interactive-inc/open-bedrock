# Web routes

Web route は `web/app` に配置し、動的 segment は `[param]` で表す。画面の存在は API の提供、操作の認可、業務不変条件の充足を意味しない。

## URL 設計

- URL の第 1 segment は所有者を表す。System は `/system`、Company は `/company`、App は `api/src/contexts/` の context 名。第 2 segment はその所有者が持つ複数形リソースで、コレクション全体を指し、閲覧範囲は permission でスコープする。例は `/company/employees`、`/expense/expenses`、`/system/applications`。
- `/my` は本人のものを指す。例は `/my/expenses`、`/my/leaves`。
- `/inbox` は本人が対応すべきものを指す。例は `/inbox/applications`、`/inbox/expenses`。
- 階層は所有関係を表す。例は `/teams/[team]/members`、`/company/employees/[employee]/timeline`。
- 動的 segment は単数リソース名で表す。例は `[employee]`、`[application]`、`[team]`。`/governance/governance-documents/[code]` は現行実装の segment 名をそのまま表す。
- URL 階層はレイアウトの入れ子に対応する。`/inbox/layout.tsx` は受信箱ヘッダと種類タブを共有し、`/teams/[team]/layout.tsx` は部署名、コード、責任者のヘッダを共有する。
- 旧 URL は `web/next.config.ts` の redirects で新 URL へ転送する。
- サイドバーの空間は URL の第 1 segment から導出する。ホーム、`/my`、`/teams`、`/inbox`、`/notifications` は自分、`/system` はシステム、`/company` は会社、残りは業務。導出は `web/lib/routing/to-feature-space.ts` だけに置く。
- 自分の空間のセクションは上から 概要、部署、そのあとに機能ごとのグループを並べる。部署セクションは `/teams` で始まる route を集めるので、同じ機能でも本人スコープの route は元のグループに残る。

## 認証

- ログインは専用ルートを持たない。未認証のまま任意の画面を開くと、error boundary が全画面のサインイン(LoginPage)に差し替える。サインイン後は開いていた URL のまま元の画面に復帰する。

## ホーム

- `/` は本人の基本情報と、今日の勤怠、休暇残、直近の申請の要約、各 `/my` リソースへの導線、および全社の人数、申請、サーベイの状況を並べる画面。

## 受信箱

- `/inbox` は本人が対応すべき申請・承認・判定を種類別の件数カードで集約するハブ。layout が受信箱ヘッダと種類タブを共有する。件数 API を持つ種類の合計が 0 件のとき空状態を表示する。
- `/inbox/applications` は自分宛ての承認待ち申請を確認し、承認または却下する画面。
- `/inbox/expenses` は承認待ちの経費申請を確認し、承認または却下する画面(`expense:approve`)。
- `/inbox/leaves` は承認待ちの休暇申請を確認し、承認または却下する画面(`leave:approve`)。
- `/inbox/ringis` は自分宛の決裁待ち稟議を承認または却下する画面。
- `/inbox/shift-swaps` は自分が当事者でないシフト交代申請を承認する画面(`shift_swap:approve`)。
- `/inbox/thanks-redemptions` は自分以外のサンクス交換申請を承認または却下する画面(`thanks_redemption:approve`)。
- `/inbox/antisocial-checks` は管理担当者が自分以外の反社チェック申請へ確認結果を記録する画面(`antisocial_check:manage`)。

## 通知

- `/notifications` は自分宛ての通知を確認し、既読にする画面。
- `/notifications/new` は宛先、種別、タイトル、本文を入力して通知を送る画面(`notification:send`)。

## じぶん

- `/my` 直下に index は無い。layout は共通ラッパのみを持ち、各ページが自前の見出しを持つ。
- `/my/attendances` は出勤、退勤の打刻と、自分の勤怠記録を確認する画面。
- `/my/leaves` は休暇残日数と自分の休暇申請状況を確認する画面。
- `/my/leaves/new` は休暇種別、期間、理由を入力して休暇を申請する画面。
- `/my/applications` は自分が提出した申請の状況を確認する画面。
- `/my/expenses` は自分が申請した経費の一覧と状態を確認する画面。
- `/my/expenses/new` はカテゴリ、金額、利用日、メモを入力して経費を申請する画面。
- `/my/shifts` は自分のシフトと交代申請を管理する画面。
- `/my/reviews` は評価サイクルと自分の評価フォームを確認する画面。
- `/my/skills` は自分の登録済みスキルを確認し、新しいスキルを登録する画面。
- `/my/career` はキャリアシートの編集と自分の応募状況を確認する画面。
- `/my/trainings` は自分の受講中、受講済みコースを確認する画面。
- `/my/survey-responses` は自分が回答したアンケートを確認する画面。
- `/my/business-trips` は出張申請と申請状況を確認する画面。
- `/my/business-trips/new` は出張先、期間、目的を記入して出張を申請する画面。
- `/my/certificate-requests` は在職証明など各種証明書の発行依頼と進捗を確認する画面。
- `/my/certificate-requests/new` は証明書の種類と用途を記入して発行を依頼する画面。
- `/my/life-events` は結婚、出産などのライフイベント届出を確認する画面。
- `/my/life-events/new` はイベント種別と発生日を記入してライフイベントを届け出る画面。
- `/my/family-care-leaves` は産休、育休、介護休業の申出状況を確認する画面。
- `/my/family-care-leaves/new` は休業の種別と期間を記入して申し出る画面。
- `/my/resignations` は退職申請と申請状況を確認する画面。
- `/my/resignations/new` は退職予定日と理由を記入して退職を申請する画面。
- `/my/ringis` は自分が起案した稟議の一覧と状態を確認する画面。
- `/my/ringis/new` は承認者、金額、理由を記入して稟議を起案する画面。
- `/my/antisocial-checks` は反社チェック申請と申請状況を確認する画面。
- `/my/antisocial-checks/new` は対象者と確認内容を記入して反社チェックを申請する画面。
- `/my/rentals` は自分の貸与品利用申出を確認する画面。route 名は現行実装を表し、資源確保済みの Reservation を意味しない。
- `/my/rentals/new` は品名と利用期間を指定して貸与品の利用を申し出る画面。備品台帳の個体や在庫は確保しない。
- `/my/assets` は自分が借りている備品を確認する画面。
- `/my/room-reservations` は自分が予約した会議室の一覧を確認し、予約を取り消す画面。
- `/my/onboarding-tasks` は自分に割り当てられた未完了タスクを確認する画面。
- `/teams/approval-delegations` は期間と対象テンプレートを指定して代理承認を設定する画面。
- `/my/settings` は表示テーマや表示言語の個人設定を変更する画面。

## チーム

- `/my/direct-reports` は直属部下の一覧と、配下スコープの勤怠、休暇、目標を文脈導線としてまとめるマイチーム画面。各スコープ節は対応するスコープ権限(`attendance:read:reports`、`leave:read:reports`、`goal:read:reports`)を持つ場合のみ描画する。`/company/reports` と `/teams/reports` は同じ画面へ転送する。

## 会社の正本

Company が正本として持つ資源を読み取り専用で確認する画面。作成、変更、削除の導線を持たず、変更は API と CLI が担う。いずれも `employee:read`、`org:manage`、`system:admin` のいずれかを持つ利用者だけが到達する。

- `/company/profile` は法人(LegalEntity)、会社プロフィール、事業所(Site)、勤務場所(Workplace)を確認する画面。
- `/company/people` は雇用と切り離した Person の台帳を確認する画面。
- `/company/employments` は在籍状態と有効期間を持つ Employment を確認する画面。在籍区分の絞り込みは取得後に適用する。
- `/company/organization-snapshots` は指定した時点の組織単位、配属、レポートライン、責任の割当を確認する画面。組織単位のコードは `/teams/[team]` へ辿る。組織変更の履歴一覧は API が持たない。
- `/company/definitions` は職務(Job)、組織上の役職(OrganizationalOffice)、責任(Responsibility)、権限範囲(AuthorityScope)、合議体(CollectiveBody)の定義を確認する画面。等級と役職マスタは `/company/grades` と `/company/positions` が正本なので含めない。
- `/company/account-employee-links` は System の Account と Company の Employee の対応を確認する画面。
- `/company/personnel-actions` は人事発令(PersonnelAction)を確認する画面。
- `/company/employee-events` は従業員コードを指定して入社、異動、休職、復職、退職の記録を確認する画面。API が従業員コードを必須で要求するため全社横断の一覧は持たない。

## 人と組織

- `/company/employees` は従業員台帳を検索し、従業員一覧を確認する画面。
- `/company/employees/new` は人物台帳、入社発令、初期アカウントを一括登録する画面。
- `/company/employees/[employee]` は基本情報、現在の人事状態、人材タイムライン、承認待ちの人事変更を確認し、人事変更を申請または確定する画面。
- `/company/employees/[employee]/timeline` は従業員の人事発令履歴をカーソルで継続表示する画面。
- `/company/employees/[employee]/reporting-line` は指定した従業員のレポートラインを確認する画面。
- `/company/employees/[employee]/onboarding` は社員ごとのオンボーディング進行状況を確認する画面。
- `/company/departments` は部署ツリー(組織図)を閲覧し、部署ノードを一覧、管理する画面。
- `/company/departments/new` は新しい部署ノードを作成する画面(`org:manage`)。
- `/teams/[team]` は部署ハブの入口。概要ページは持たず `/teams/[team]/members` へリダイレクトする。layout が部署名、コード、責任者のヘッダを共有する。
- `/teams/[team]/members` は部署に所属するメンバーを確認し、直接発令の権限(`employee:lifecycle:apply`)を持つ利用者がこの部署への配属(主配属・兼務)を登録する画面。
- `/teams/[team]/goals` は部署の所属メンバーと部門の目標を一覧する画面(`goal:read:all`、または所属部署への `goal:read:department`)。
- `/teams/[team]/attendances` は部署の所属メンバーの勤怠記録を一覧する画面(`attendance:read:all`、または所属部署への `attendance:read:department`)。
- `/teams/[team]/leaves` は部署の所属メンバーの休暇申請を一覧する画面(`leave:read:all`、または所属部署への `leave:read:department`)。
- `/performance-review/goals/tree` は全社、部門、個人の目標を階層で俯瞰する画面。
- `/company/grades` は等級マスタの一覧を確認し、管理者(`grade:manage`)が作成、編集、削除する画面。
- `/company/grades/new` は等級マスタの基本情報を登録する画面(`grade:manage`)。
- `/company/positions` は役職マスタの一覧を確認し、管理者(`position:manage`)が作成、編集、削除する画面。一覧は全認証者が閲覧する。
- `/company/positions/new` は役職マスタの基本情報を登録する画面(`position:manage`)。
- `/career/job-postings` は募集中の社内公募を閲覧し、応募先を探す画面。
- `/career/job-postings/new` は管理者が新しい社内公募を登録する画面。
- `/career/job-postings/[posting]` は公募内容を確認し応募する詳細画面。
- `/career/job-postings/[posting]/edit` は管理者が公募内容と状態を変更する画面。
- `/commendation/commendations` は表彰の一覧(社内公開)と管理者による記録を行う画面。
- `/headcount-plan/headcount-plans` は人員計画と実在籍数を比較する画面(`headcount_plan:read:all`)。

## 目標

- `/performance-review/goals` は期間と従業員で絞り込み、目標を確認する画面。
- `/performance-review/goals/new` は期間と内容を入力して目標を登録する画面。
- `/performance-review/goals/[goal]` は目標の内容、評価、状態を確認する詳細画面。

## ナレッジと文化

- `/knowledge/knowledge-articles` は社内ナレッジをキーワードやカテゴリで検索する画面。
- `/knowledge/knowledge-articles/new` はナレッジ記事のタイトル、カテゴリ、本文を登録する画面。
- `/knowledge/knowledge-articles/[article]` はナレッジ記事の本文とカテゴリを確認する画面。
- `/announcement/announcements` は社内アナウンスの一覧と詳細を確認し、管理者(`announcement:manage`)が作成、公開する画面。
- `/announcement/announcements/[announcement]` は社内アナウンスの本文を確認する画面。
- `/regulation/regulations` は規程集の一覧と版履歴を確認し、管理者(`regulation:manage`)が新版を追加する画面。
- `/regulation/regulations/[regulation]` は規程の本文と版履歴を確認し、管理者(`regulation:manage`)が新版を追加する画面。
- `/governance/governance-documents` は published status、audience、閲覧権限に応じた規程・手続きを検索する画面。現行実装は施行期間で絞り込まない。
- `/governance/governance-documents/[code]` は Markdown 本文、版、ProcedureDefinition、authority rule と control の宣言 metadata、公開 review、確認状態を表示する画面。
- `/governance/governance-documents/manage` は組織ロールの割当と、組織・参照・期限の整合性を検査する管理画面(`governance:manage`)。
- `/survey/surveys` は配信中のアンケートを確認し回答する画面。
- `/survey/surveys/[survey]` は指定したアンケートに回答する画面。
- `/survey/surveys/[survey]/summary` はアンケートの回答件数と設問別集計を確認する画面。
- `/survey/surveys/[survey]/edit` はアンケートのタイトル、状態、設問を変更する画面。
- `/survey/surveys/manage` は実施中のアンケートを確認、編集、削除する管理画面。
- `/survey/surveys/manage/new` は新しいアンケートのタイトルと設問を登録する画面。
- `/thanks/rewards` は受領残高で交換できる景品を確認し、交換を申請する画面。
- `/thanks/rewards/manage` は管理者が新しい景品を登録する画面。
- `/skill/skills` はスキルをキーワードやカテゴリで検索する画面。
- `/certification/certifications` は資格・免許のマスタと保有記録を確認、管理する画面。
- `/training/trainings` は研修コースの一覧から受講を申し込む画面。
- `/training/trainings/new` は研修コースの基本情報を登録する管理画面。
- `/training/trainings/[training]` は研修コースの詳細を確認し、受講登録や完了操作を行う画面。
- `/training/trainings/[training]/edit` は研修コースの内容を変更する管理画面。
- `/my/oneonones` は自分が参加した 1on1 の履歴を確認する画面。
- `/my/oneonones/new` は日時、相手、メモを入力して 1on1 を記録する画面。
- `/thanks/thanks` はサンクスポイントの残量と、社内の感謝を見渡す画面。
- `/thanks/thanks/send` は送り先と感謝メッセージを入力し、任意でポイントを添えて送る画面。

## 設備

- `/room/rooms` は会議室の空き状況を検索し、会議室を予約する画面。
- `/room/rooms/manage` は登録済みの会議室を編集、削除する管理画面。
- `/room/rooms/manage/new` は新しい会議室の名称、定員、所在地を登録する画面。
- `/asset/assets` は種別や状態で絞り込み、備品一覧を確認する画面。
- `/asset/assets/new` は新しい備品を備品マスタに登録する画面。
- `/asset/assets/[asset]` は備品の属性と貸与、返却、廃棄を操作する画面。
- `/asset/assets/holdings` は現在貸出中の備品を保有者ごとに横断で確認する管理画面。
- `/asset/stocktakes` は棚卸しセッションの一覧を確認する画面。
- `/asset/stocktakes/new` は名称と対象日を指定して棚卸しを開始する画面。
- `/asset/stocktakes/[stocktake]` は対象備品ごとの現物確認を記録し、セッションを締める画面。
- `/company-calendar/calendars` は会社カレンダー(休日・振替出勤日)を確認し、管理者(`calendar:manage`)が編集する画面。

## 経営と対外

- `/dashboards/management` は経営ダッシュボードを確認する画面(`management_dashboard:view`)。
- `/ringi/ringis` は全社の稟議を横断で確認する管理画面(`ringi:read:all`)。
- `/meeting/meetings` は会議体の一覧を確認し、登録済みの会議体へ移動する画面。
- `/meeting/meetings/new` は会議体のコードと名称を登録する画面(`meeting:manage`)。
- `/meeting/meetings/[meeting]` は会議体の詳細と議事録一覧を確認し、議事録を記録する画面。
- `/meeting/decisions` は会社の意思決定記録を一覧する画面。
- `/meeting/decisions/new` は意思決定記録を ADR 形式で作成する画面(`decision:manage`)。
- `/meeting/decisions/[decision]` は意思決定記録の背景、決定、帰結を確認する画面。
- `/partner/partners` は取引先台帳を検索し、登録する画面。
- `/partner/partners/new` は新しい取引先を登録する画面(`partner:manage`)。
- `/partner/partners/[partner]` は取引先の詳細と契約記録を確認する画面(契約は `contract:read:all`)。
- `/expense/budgets` は部署と会計期間ごとの予算を一覧で確認する画面(`budget:manage`)。
- `/expense/budgets/new` は部署、会計期間、期間、金額、名称、メモを入力して予算を登録する画面(`budget:manage`)。
- `/expense/budgets/[budget]` は予算の詳細と、承認済み経費による消化額、残額を確認し、修正や削除を行う画面(`budget:manage`)。
- `/expense/budgets/summary` は会計期間を指定し、部署ごとの予算、消化額、残額を横断で確認する画面(`budget:manage`)。
- `/document/documents` は文書台帳(所在・期限)を確認、登録する画面(`document:read:all`)。

## 人事・労務

- `/attendance/attendances` は管理者が従業員や期間で絞り込み、全体の勤怠記録を確認する画面(`attendance:read:all`)。
- `/attendance/attendances/overtime` は時間外の参考集計を確認する画面(スコープ権限で範囲を出し分け)。
- `/leave/leaves` は全社の休暇申請を横断で確認する管理画面(`leave:read:all`)。
- `/system/applications` は全社の申請を横断で確認する管理画面(`application:read:all`)。
- `/system/applications/[application]` は申請内容と承認状況を確認する詳細画面。
- `/expense/expenses` は全社の経費申請を横断で確認する管理画面(`expense:read:all`)。
- `/expense/expenses/[expense]` は経費申請の詳細を確認する画面。
- `/system/application-templates` は利用可能な申請テンプレートを確認し、新規申請を作成する画面。
- `/system/application-templates/new` は新しい申請テンプレートの名称、カテゴリ、入力項目を登録する画面。
- `/system/application-templates/[template]` は申請テンプレートの詳細を確認し、テンプレートから申請を始める画面。
- `/system/application-templates/[template]/workflow` はテンプレートの多段承認、条件、期限、差戻し、代理承認可否を設定する管理画面。
- `/system/workflow-repairs` は候補者不足で停止した承認フローへ、監査理由付きで承認候補者を再割り当てする管理画面。
- `/performance-review/review-cycles` は評価サイクルの作成と、割り当てる評価者種別、同僚評価者数の設定を行う管理画面(`review:administer`)。
- `/performance-review/reviews` は評価結果を検索し確認する管理画面(`review:administer`)。
- `/recruitment/recruitments` は採用の募集一覧と候補者パイプラインを管理する画面(`recruitment:manage`)。
- `/recruitment/recruitments/[recruitment]` は募集ごとの応募者パイプラインを確認し、選考ステージを進める画面(`recruitment:manage`)。
- `/onboarding/onboarding-templates` は入社、退社のオンボーディングテンプレートと人事発令からの自動割当を管理する画面(`onboarding:manage`)。
- `/onboarding/onboarding-templates/new` はオンボーディングタスクをテンプレートとして登録する画面。
- `/onboarding/onboarding-assignments` は閲覧権限を持つ担当者が社員を選び、進行状況へ移動する画面(`onboarding:view:all`)。
- `/onboarding/onboarding-assignments/new` は社員コードとテンプレートを指定して割り当てを作成する画面。
- `/health-checkup/health-checkups` は健康診断・ストレスチェックの実施記録を管理する画面(`health_checkup:read:all`)。
- `/work-accident/work-accidents` は労災・事故の発生記録を確認、登録する画面(`work_accident:read:all`)。
- `/certificate-request/certificate-requests` は全社の証明書発行依頼を横断で確認する管理画面(`certificate_request:read:all`)。
- `/resignation/resignations` は全社の退職手続きを横断で確認する管理画面(`resignation:read:all`)。
- `/life-event/life-events` は全社のライフイベント届を横断で確認する管理画面(`life_event:read:all`)。
- `/family-care-leave/family-care-leaves` は全社の産休・育休・介護休業の申出を横断で確認する管理画面(`family_care_leave:read:all`)。
- `/business-trip/business-trips` は全社の出張申請を横断で確認する管理画面(`business_trip:read:all`)。
- `/rental/rentals` は全社の貸与品予約を横断で確認する管理画面(`rental:read:all`)。
- `/shift/shift-assignments` は全員のシフト割当を確認する管理画面(`shift:manage`)。
- `/shift/shift-assignments/new` は対象社員、パターン、対象日を指定してシフト割当を作成する画面(`shift:manage`)。
- `/shift/shift-patterns` はシフトの定型パターンを一覧する画面。
- `/shift/shift-patterns/new` はコード、名前、開始と終了の時刻、休憩時間を登録してシフトパターンを作成する画面(`shift:manage`)。
- `/shift/shift-swaps` は全社のシフト交代申請を横断で確認する管理画面(`shift_swap:read:all`)。
- `/thanks/thanks-redemptions` は全社のサンクス交換申請を横断で確認する管理画面(`thanks_redemption:read:all`)。

## システム管理

- `/system/roles` はロールの一覧と割当済み権限を確認する管理画面(`iam:read`)。
- `/system/roles/new` は権限を選んで新しいロールを作成する画面。
- `/system/roles/[role]/edit` はロールの名称と権限の割当を変更する画面。
- ロールの作成、変更、削除はパスワードの再入力による再認証を要求する。画面は拒否の理由を表示し、再認証が必要な場合はその場で再入力して同じ操作をやり直せる。
- `/system/accounts` はアカウントの状態確認、ロール割当、停止、パスワードリセットを行う管理画面。閲覧は `iam:read`、変更は `iam:write` を要求する。
- `/system/audit-events` は重要操作と認可判断の監査イベントを検索し、権限がある場合は検索結果を書き出す画面。
- `/system/audit-events/[event]` は監査イベントの認可情報、変更内容、request 情報を確認する画面。
- `/software-license/licenses` はライセンス・SaaS 台帳を確認、管理する画面(`license:read:all`)。
- `/software-license/licenses/new` は利用中の SaaS・ソフトウェアを台帳に登録する画面(`license:manage`)。
- `/it-incident/it-incidents` はインシデントの発生と解消を記録する画面(`it_incident:read:all`)。
- `/it-incident/it-incidents/new` は発生した障害・事故を記録する画面(`it_incident:manage`)。
- `/system/batches` はバックグラウンドで実行されるバッチジョブの最新状況を確認する画面(`batch:view`)。
