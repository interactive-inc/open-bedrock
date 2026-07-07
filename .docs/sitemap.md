# サイトマップ

web のユーザー向け画面一覧。実装ルートは `web/app` 配下を正とし、動的セグメントは `[param]` で表す。機能の概要は [[features|機能一覧]]、主要導線は [[user-flows|ユーザーフロー]] を参照する。

## 認証

- ログインは専用ルートを持たない。未認証のまま任意の画面を開くと、error boundary が全画面のサインイン(LoginGate)に差し替える。サインイン後は `/` へ戻る。

## ホーム

- `/` は主要な人数、申請、サーベイの状況を一覧する画面。

## 社員と組織

- `/employees` は従業員台帳を検索し、従業員一覧を確認する画面。
- `/employees/new` は新しい従業員を従業員台帳に登録する画面。
- `/employees/[code]` は従業員の基本情報、所属、状態を確認し編集する画面。
- `/org` は部署ツリーを閲覧し、部署ノードを管理する画面。
- `/org/departments` は部署の一覧を確認する画面。
- `/org/departments/new` は新しい部署ノードを登録する画面。
- `/org/departments/[code]/members` は部署に所属するメンバーを確認する画面。
- `/org/reporting-line/[code]` は指定した従業員のレポートラインを確認する画面。

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

## 勤怠と休暇

- `/attendance` は出勤、退勤の打刻と、自分の勤怠記録を確認する画面。
- `/attendance/all` は管理者が従業員や期間で絞り込み、全体の勤怠記録を確認する画面。
- `/leave` は休暇残日数と自分の休暇申請状況を確認する画面。
- `/leave/new` は休暇種別、期間、理由を入力して休暇を申請する画面。
- `/leave/inbox` は承認待ちの休暇申請を確認し、承認または却下する画面。
- `/leave/admin` は全社の休暇申請を横断で確認する管理画面(`leave:read:all`)。

## 経費

- `/expense` は自分が申請した経費の一覧と状態を確認する画面。
- `/expense/new` はカテゴリ、金額、利用日、メモを入力して経費を申請する画面。
- `/expense/[id]` は経費申請の詳細を確認する画面。
- `/expense/inbox` は承認待ちの経費申請を確認し、承認または却下する画面。
- `/expense/admin` は全社の経費申請を横断で確認する管理画面(`expense:read:all`)。

## ナレッジ

- `/knowledge` は社内ナレッジをキーワードやカテゴリで検索する画面。
- `/knowledge/new` はナレッジ記事のタイトル、カテゴリ、本文を登録する画面。
- `/knowledge/[id]` はナレッジ記事の本文とカテゴリを確認する画面。

## 会議室と備品

- `/rooms` は会議室の空き状況を検索し、会議室を予約する画面。
- `/rooms/me` は自分が予約した会議室の一覧を確認し、予約を取り消す画面。
- `/rooms/manage` は登録済みの会議室を編集、削除する管理画面。
- `/rooms/manage/new` は新しい会議室の名称、定員、所在地を登録する画面。
- `/assets` は種別や状態で絞り込み、備品一覧を確認する画面。
- `/assets/new` は新しい備品を備品マスタに登録する画面。
- `/assets/[code]` は備品の属性と貸与、返却状況を確認する画面。
- `/assets/lent/me` は自分が借りている備品を確認する画面。

## スキルと目標

- `/skills` はスキルをキーワードやカテゴリで検索する画面。
- `/skills/me` は自分の登録済みスキルを確認し、新しいスキルを登録する画面。
- `/goals` は期間と従業員で絞り込み、目標を確認する画面。
- `/goals/new` は期間と内容を入力して目標を登録する画面。
- `/goals/[id]` は目標の内容、評価、状態を確認する詳細画面。

## 1on1 とサーベイ

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
- `/onboarding/employee/[code]` は社員ごとのオンボーディング進行状況を確認する画面。
- `/onboarding/templates` は入社、退社のオンボーディングテンプレートを管理する画面。
- `/onboarding/templates/new` はオンボーディングタスクをテンプレートとして登録する画面。
- `/onboarding/assignments/new` は社員コードとテンプレートを指定して割り当てを作成する画面。

## 評価

- `/review` は評価サイクルと自分の評価フォームを確認する画面。
- `/review/manage` は評価サイクルの作成と評価結果の横断検索を行う管理画面。
- `/review/results` は評価結果を検索し確認する管理画面。

## シフト

- `/shift` は自分のシフトと交代申請を管理する画面。
- `/shift/admin` は全社のシフト交代申請を横断で確認する管理画面(`shift_swap:read:all`)。
- `/shift/manage` は全員のシフト割当を確認する管理画面。
- `/shift/manage/new` は新しいシフト割当を作成する画面。
- `/shift/patterns` はシフトの定型パターンを一覧する画面。
- `/shift/patterns/new` は新しいシフトパターンを登録する画面。

## 研修

- `/training` は研修コースの一覧から受講を申し込む画面。
- `/training/new` は研修コースの基本情報を登録する管理画面。
- `/training/me` は自分の受講中、受講済みコースを確認する画面。
- `/training/[code]` は研修コースの詳細を確認し、受講登録や完了操作を行う画面。
- `/training/[code]/edit` は研修コースの内容を変更する管理画面。

## 通知

- `/notifications` は自分宛ての通知を確認し、既読にする画面。
- `/notifications/new` は宛先と本文を指定して通知を送信する画面(`notification:send`)。

## 感謝

- `/thanks` はサンクスポイントの残量と、社内の感謝を見渡す画面。
- `/thanks/send` は送り先と感謝メッセージを入力し、任意でポイントを添えて送る画面。
- `/thanks/rewards` は受領残高で交換できる景品を確認し、交換を申請する画面。
- `/thanks/admin` は全社のサンクス交換申請を横断で確認する管理画面(`thanks_redemption:read:all`)。
- `/thanks/rewards/manage` は管理者が新しい景品を登録する画面。

## 労務とライフイベント手続き

- `/business-trips` は出張申請と申請状況を確認する画面。
- `/business-trips/new` は出張先、期間、目的を記入して出張を申請する画面。
- `/rentals` は自分の貸出予約を確認する画面。
- `/rentals/new` は備品と利用期間を指定してレンタルを予約する画面。
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

## システム

- `/batch` はバックグラウンドで実行されるバッチジョブの最新状況を確認する画面。
- `/settings` は表示テーマや表示言語の個人設定を変更する画面。
