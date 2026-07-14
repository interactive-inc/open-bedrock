# 会社の業務能力と実装範囲

この文書は、会社全体の業務能力に対して open-karte が現在どこまで対応するかを示す。機能名が存在するだけで提供面を同等とみなさず、能力単位の実装状況と、重要な操作単位の提供面差を記録する。API の正は `api/src/app.ts`、DB スキーマの正は `api/migrations` に置く。`api/src/schema.ts` は migration と同期するクエリ用ビューであり、Web と CLI の正は `web/app` と `cli/app/index.ts` に置く。

## 状態の読み方

状態は、実装の深さと製品境界を区別するために使う。

- 実装済み: 記録や操作を利用でき、必要な永続化と利用者向け入口がある
- 部分実装: 一部の操作、提供面、状態遷移、または他機能との接続がない
- 台帳のみ: `Schema` にテーブルがあるが、利用するアプリケーションと入口がない
- 未実装: 現在の製品境界に隣接する能力だが、対応する実装がない
- 対象外: open-karte が担う社内事務の記録、申請、承認、検索から外れる

状態はロードマップを表さない。採用済みのロードマップは `.docs/backlogs` に個別ファイルとして記録された項目だけを指す。

## 提供面の読み方

提供面は、能力を利用または保持する場所の和集合を示す。同じ能力に複数の提供面があっても、現状欄の各操作がすべての面にあるとは限らない。操作差が業務完結性へ影響する能力は「提供面の差」で明示し、それ以外の正確なルートと操作は各提供面のコードを正とする。

- API: `api/src/app.ts` に登録された HTTP API
- Web: `web/app` に実装された画面とサーバーアクション
- CLI: `cli/app/index.ts` に登録されたコマンドラインインターフェース（CLI）
- Schema: `api/migrations` を正とし、`api/src/schema.ts` に同期した永続データ
- なし: 上記の提供面に実装がない

## 戦略

open-karte は、経営戦略の策定ではなく、社内事務の事実と手続きを扱う。

### 経営戦略と全社目標

- 状態: 対象外
- 提供面: なし
- 現状: 個人目標と評価期間の記録は成長領域で扱う
- 不足または境界: 経営計画、事業ポートフォリオ、全社指標、部門目標の連鎖は扱わない
- 実装根拠: `api/src/domain/goal`、`api/src/app.ts`

### 会社統治と法定機関

- 状態: 対象外
- 提供面: なし
- 現状: 社内申請の意思決定と IAM の役割を記録する
- 不足または境界: 取締役会、株主、議事録、法定帳簿、登記、会社印、法定開示を会社機関の業務として扱わない
- 実装根拠: `.docs/index.md`、`api/src/domain/application`、`api/src/interface/iam`

## 顧客・売上・提供

open-karte は従業員向けの社内基盤であり、顧客接点や商取引の実行系を持たない。

### 顧客管理、営業、契約、受注

- 状態: 対象外
- 提供面: なし
- 現状: 反社チェックは取引先名を記録するが、顧客台帳としては使わない
- 不足または境界: 顧客関係管理、商談、見積、契約、受注、請求を扱わない
- 実装根拠: `api/src/schema.ts` の `antisocialChecks`、`api/src/app.ts`

### 製品提供と顧客サポート

- 状態: 対象外
- 提供面: なし
- 現状: 社内ナレッジと社内通知だけを扱う
- 不足または境界: 製品開発、在庫販売、配送、顧客問い合わせ、利用契約の管理を扱わない
- 実装根拠: `api/src/domain/knowledge`、`api/src/domain/notification`

## 組織

組織領域は、従業員台帳を部署構造とレポートラインへ結び付ける。

### 部署、所属、レポートライン

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 部署ツリー、部署メンバー、直属関係、部署の作成、変更、削除を扱う
- 不足または境界: 法人格、事業所、原価センター、複数会社をまたぐ組織モデルは持たない
- 実装根拠: `api/src/domain/org`、`web/app/(app)/org`、`cli/app/org`

### 組織計画と要員計画

- 状態: 未実装
- 提供面: なし
- 現状: ダッシュボードで現在の人数を集計できる
- 不足または境界: 将来組織、定員、採用枠、人件費計画、組織改編の予約を扱わない
- 実装根拠: `api/src/interface/dashboard/route.ts`、`api/src/app.ts`

### 法人と事業所

- 状態: 未実装
- 提供面: なし
- 現状: 単一の従業員台帳と部署ツリーを扱う
- 不足または境界: 法人、子会社、事業所、所在地階層、法人間異動を表す資源がない
- 実装根拠: `api/src/schema.ts` の `employees`、`departments`、`orgDepartments`

### 職務、ポジション、原価部門

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 従業員に自由記述の役職と部署を保持する
- 不足または境界: 職務マスタ、ポジション枠、職務等級、原価部門、兼務を独立資源として扱わない
- 実装根拠: `api/src/schema.ts` の `employees`、`api/src/domain/org`

### プロジェクトと外部関係者

- 状態: 未実装
- 提供面: なし
- 現状: 反社チェックに取引先名と代表者名を記録できる
- 不足または境界: プロジェクト、チーム、案件メンバー、委託先、派遣元、顧問、取引先担当者の共通台帳がない
- 実装根拠: `api/src/schema.ts` の `antisocialChecks`、`api/src/app.ts`

## 人

人の領域は、従業員台帳と入退社を中心に、本人が行う社内手続きを扱う。

### 従業員台帳と社内ディレクトリ

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 従業員の検索、人物と入社発令と初期アカウントの一括登録、氏名変更、人事発令、タイムライン、退職者アーカイブと、一般業務向けの限定項目ディレクトリを扱う
- 提供面の差: 従業員台帳と人事発令の主要操作は API、Web、CLI にあり、限定項目ディレクトリは API と Web だけにある
- 不足または境界: 候補者、家族、緊急連絡先、雇用契約書の台帳は持たない
- 実装根拠: `api/src/domain/employee`、`api/src/interface/employee/directory/route.ts`、`web/app/(app)/employees`、`cli/app/employee`

### 採用と候補者管理

- 状態: 未実装
- 提供面: なし
- 現状: 入社後の従業員登録とオンボーディングから扱う
- 不足または境界: 募集、候補者、面接、内定、入社前連絡を扱わない
- 実装根拠: `api/src/domain`、`api/src/app.ts`

### オンボーディング

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: テンプレート、タスク、従業員への割り当て、完了、完了解除、進行状況と、人事発令による入退社タスクの自動展開を扱う
- 不足または境界: 採用システムからの起動と外部サービスへのアカウント発行は行わない
- 実装根拠: `api/src/domain/onboarding`、`web/app/(app)/onboarding`、`cli/app/onboarding`

### 退職、ライフイベント、休業、証明書依頼

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 本人による申出、一覧、詳細、内容変更、取消と専用状態を記録する
- 不足または境界: 管理担当者の受付、承認、完了操作を共通化しておらず、汎用申請ワークフローにも接続していない
- 実装根拠: `api/src/domain/resignation`、`api/src/domain/life-event`、`api/src/domain/family-care-leave`、`api/src/domain/certificate-request`

### 個人設定

- 状態: 部分実装
- 提供面: Web
- 現状: 表示テーマと言語を Web で変更する
- 不足または境界: API、CLI、Schema に同期せず、業務データの個人設定は持たない
- 実装根拠: `web/app/(app)/settings`

### 福利厚生と報酬事実

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 給与明細と給与改定のテーブル、休業申出、サンクスポイントを個別に保持する
- 提供面の差: 給与明細と給与改定は Schema だけにあり、休業申出とサンクスポイントは API、Web、CLI から利用できる
- 不足または境界: 福利厚生制度、加入、手当、賞与、株式報酬、総報酬履歴を一つの従業員事実として扱わない
- 実装根拠: `api/src/schema.ts` の `payslips`、`salaryRevisions`、`familyCareLeaves`、`thanksPointBudgets`

### 異動、昇降格、雇用関係案件

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 現在の部署と役職、社内公募への応募、給与改定の台帳を個別に保持する
- 提供面の差: 部署と役職の更新、社内公募は API、Web、CLI にあり、給与改定は Schema だけにある
- 不足または境界: 発令、適用日付きの異動と昇降格、雇用条件変更、相談、苦情、懲戒、是正案件を一連の履歴として扱わない
- 実装根拠: `api/src/schema.ts` の `employees`、`careerApplications`、`salaryRevisions`

## 時間

時間の領域は、勤務、休暇、シフトと期間を伴う申出を扱う。

### 勤怠

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 出退勤、本人の記録、月次サマリ、権限付きの全体一覧を扱う
- 不足または境界: 給与計算、残業代計算、法定労働時間の判定は行わない
- 実装根拠: `api/src/domain/attendance`、`web/app/(app)/attendance`、`cli/app/attendance`

### 休暇

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 休暇残数、本人の申請、内容変更、取消、承認、却下、全体一覧を扱う
- 不足または境界: 法令に基づく自動付与や取得義務の判定は行わない
- 実装根拠: `api/src/domain/leave`、`web/app/(app)/leave`、`cli/app/leave`

### シフト

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: シフトパターン、割り当て、公開、交代申請、承認、取消を扱う
- 提供面の差: シフト交代の申請と ID 指定の承認は API、Web、CLI にあるが、承認待ち一覧と管理用横断一覧は API と Web だけにある
- 不足または境界: 需要予測と自動編成は行わない
- 実装根拠: `api/src/domain/shift`、`web/app/(app)/shift`、`cli/app/shift`

### 出張

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 行き先、期間、目的、概算費用、専用状態を記録し、本人が申請、変更、取消を行う
- 不足または境界: 承認 `inbox` と決裁操作がなく、汎用申請ワークフローや経費精算と接続していない
- 実装根拠: `api/src/domain/business-trip`、`api/src/interface/business-trip`、`web/app/(app)/business-trips`、`cli/app/business-trip`

### 労働時間と休暇の法的判定

- 状態: 対象外
- 提供面: なし
- 現状: 判断の背景知識を `.docs/references` と `.docs/sources` に記録する
- 不足または境界: 違法性、上限超過、給付要件を自動判定しない
- 実装根拠: `.docs/sources/労働時間と36協定の上限規制.md`、`.docs/index.md`

### プロジェクト工数

- 状態: 未実装
- 提供面: なし
- 現状: 勤怠は従業員と勤務日ごとの時間を記録する
- 不足または境界: プロジェクト、案件、作業分類への時間配賦と工数承認を扱わない
- 実装根拠: `api/src/schema.ts` の `attendanceRecords`、`api/src/app.ts`

## 物

物の領域は、社内資産の所在、貸出、廃棄、棚卸しを扱う。

### 備品台帳と貸出

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 備品の登録、変更、削除、貸出、返却、廃棄、本人の借用品、保有者別一覧を扱う
- 不足または境界: 会計上の減価償却と資産評価は行わない
- 実装根拠: `api/src/domain/asset`、`web/app/(app)/assets`、`cli/app/asset`

### 棚卸し

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 棚卸しの開始、対象備品の現物確認、確認者と所在メモ、締めを扱う
- 不足または境界: バーコード機器や外部資産台帳との同期は行わない
- 実装根拠: `api/src/domain/stocktake`、`web/app/(app)/stocktakes`、`cli/app/stocktake`

### 貸与品のレンタル予約

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 品名、期間、用途、専用状態を記録し、本人が予約、変更、取消を行う
- 不足または境界: 備品台帳と結び付かず、在庫確保と承認処理も行わない
- 実装根拠: `api/src/domain/rental`、`web/app/(app)/rentals`、`cli/app/rental`

### 資産保守とソフトウェアライセンス

- 状態: 未実装
- 提供面: なし
- 現状: 物理備品の状態、保有者、貸出、廃棄を記録する
- 不足または境界: 修理、点検、保証、保守契約、ソフトウェアライセンス、端末構成、更新期限を扱わない
- 実装根拠: `api/src/schema.ts` の `assets`、`assetLendings`

## 施設

施設の領域は、会議室マスタと時間帯予約を扱う。

### 会議室

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 会議室の登録、変更、削除、空き状況、予約、本人の予約、取消を扱う
- 不足または境界: 繰り返し予約、設備構成、外部カレンダー同期は行わない
- 実装根拠: `api/src/domain/room`、`web/app/(app)/rooms`、`cli/app/room`、`cli/app/rooms`

### 座席、拠点、入退館、保守

- 状態: 未実装
- 提供面: なし
- 現状: 会議室の名称と所在地だけを保持する
- 不足または境界: フリーアドレス、座席予約、建物、入退館、修繕、清掃を扱わない
- 実装根拠: `api/src/schema.ts` の `rooms`、`api/src/app.ts`

## お金・調達

お金の領域は、経費と予算の事実を記録する。会計、税務、給与の重い計算は外部へ委ねる。

### 経費精算

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 経費の申請、内容変更、取消、本人一覧、全体一覧、承認、却下、履歴を扱う
- 不足または境界: 振込、仕訳、領収書画像、インボイス要件の自動判定は行わない
- 実装根拠: `api/src/domain/expense`、`web/app/(app)/expense`、`cli/app/expense`

### 部署予算

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 部署と会計期間ごとの予算、承認済み経費の消化額、残額を扱う
- 不足または境界: 予算超過の承認制御、自動締め、配賦、改定履歴は持たない
- 実装根拠: `api/src/domain/budget`、`web/app/(app)/budgets`、`cli/app/budget`

### 給与明細

- 状態: 台帳のみ
- 提供面: Schema
- 現状: 社員、対象期間、支給、控除、差引支給額、発行状態のテーブルがある
- 不足または境界: API、Web、CLI と給与計算処理がない
- 実装根拠: `api/src/schema.ts` の `payslips`

### 給与改定

- 状態: 台帳のみ
- 提供面: Schema
- 現状: 社員、適用日、改定前後の基本給、理由のテーブルがある
- 不足または境界: API、Web、CLI、承認、給与システム連携がない
- 実装根拠: `api/src/schema.ts` の `salaryRevisions`

### 年末調整

- 状態: 台帳のみ
- 提供面: Schema
- 現状: 社員、対象年、提出状態、メモのテーブルがある
- 不足または境界: API、Web、CLI、申告書提出、税額計算がない
- 実装根拠: `api/src/schema.ts` の `yearEndAdjustments`

### 取引先、契約、購買、支払

- 状態: 未実装
- 提供面: なし
- 現状: 経費、予算、出張概算、反社チェックを個別に記録する
- 不足または境界: 取引先台帳、契約、購買依頼、発注、検収、請求書、支払状況を一連で扱わない
- 実装根拠: `api/src/domain`、`api/src/app.ts`

### 法人カードと配賦

- 状態: 未実装
- 提供面: なし
- 現状: 従業員が入力した経費と部署予算を記録する
- 不足または境界: 法人カード明細、利用者への明細割り当て、勘定科目、部門やプロジェクトへの配賦を扱わない
- 実装根拠: `api/src/schema.ts` の `expenses`、`budgets`

### 会計、税務、給与計算

- 状態: 対象外
- 提供面: なし
- 現状: 計算結果や申出の記録に限定する
- 不足または境界: 仕訳、決算、納税、源泉徴収、社会保険、給与額を計算しない
- 実装根拠: `.docs/index.md`、`api/src/schema.ts`

## 成長

成長の領域は、目標、評価、能力開発、キャリア、対話、組織の声を扱う。

### 目標と目標評価

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 個人目標、期間、指標、重み、自己評価、上長評価、最終評価を扱う
- 不足または境界: 全社戦略からの目標展開と報酬計算は行わない
- 実装根拠: `api/src/domain/goal`、`web/app/(app)/goals`、`cli/app/goal`

### 評価サイクル

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 評価サイクル、評価者ポリシー、フォーム生成、提出、結果閲覧、開始、締切を扱う
- 不足または境界: 昇給と賞与への自動反映は行わない
- 実装根拠: `api/src/domain/review`、`web/app/(app)/review`、`cli/app/review`

### スキル

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: スキルマスタの検索と、本人のレベル、経験年数、補足の登録を扱う
- 不足または境界: 認定証の検証と職務要件との差分分析は行わない
- 実装根拠: `api/src/domain/skill`、`web/app/(app)/skills`、`cli/app/skill`

### 研修

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: コース管理、受講登録、日程変更、取消、完了、スコア、期限を扱う
- 不足または境界: 教材配信、試験実施、外部学習管理システムとの同期は行わない
- 実装根拠: `api/src/domain/training`、`web/app/(app)/training`、`cli/app/training`

### キャリアと社内公募

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: キャリアシート、公募の管理、応募、応募内容の変更と取下げを扱う
- 不足または境界: 異動の発令と従業員所属の自動変更は行わない
- 実装根拠: `api/src/domain/career`、`web/app/(app)/career`、`cli/app/career`

### 個別面談

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 参加者、実施日時、話題、上長メモ、次の行動を記録する
- 不足または境界: カレンダー予約と通知の自動作成は行わない
- 実装根拠: `api/src/domain/oneonone`、`web/app/(app)/oneonone`、`cli/app/1on1`

### アンケート

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: アンケート管理、回答、回答変更、取下げ、本人履歴、設問別集計を扱う
- 不足または境界: 匿名性の選択、外部配信、高度な統計分析は行わない
- 実装根拠: `api/src/domain/survey`、`web/app/(app)/surveys`、`cli/app/survey`

### 感謝とサンクスポイント

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 感謝、月次贈与原資、受領残高、報酬カタログ、交換申請、承認、却下を扱う
- 不足または境界: 現金、給与、会計上の報酬としては扱わない
- 実装根拠: `api/src/domain/thanks`、`api/src/domain/thanks-points`、`web/app/(app)/thanks`、`cli/app/thanks`

## 知識

知識の領域は、製品内の記事と、リポジトリに置く業務知識を分けて扱う。

### 社内ナレッジ

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: Markdown 記事の検索、閲覧、作成、変更、削除とカテゴリ、タグを扱う
- 不足または境界: 版管理、公開承認、添付ファイル、意味検索は行わない
- 実装根拠: `api/src/domain/knowledge`、`web/app/(app)/knowledge`、`cli/app/kb`

### 業務知識と制度の根拠

- 状態: 部分実装
- 提供面: なし
- 現状: `.docs/notes`、`.docs/references`、`.docs/sources` に手続き、用語、出典付き要約を置く
- 不足または境界: 製品内ナレッジとの同期、更新期限、出典検証の自動化は行わない
- 実装根拠: `.docs/index.md`、`.docs/notes`、`.docs/references`、`.docs/sources`

### 規程の版管理と同意確認

- 状態: 未実装
- 提供面: なし
- 現状: ナレッジ記事とリポジトリ文書を現在内容として保存する
- 不足または境界: 規程の版、施行日、公開承認、対象者、既読、同意、再同意を記録しない
- 実装根拠: `api/src/schema.ts` の `knowledgeArticles`、`.docs/notes`

## リスク・法務・コンプライアンス

この領域は、確認事実と手続きの記録に限定し、法的判断を自動化しない。

### 反社チェック

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 申請、本人一覧、詳細、変更、取消、管理担当者による結果記録を扱う
- 提供面の差: 本人の申請操作は API、Web、CLI にある。管理担当者の一覧は API と Web にあり、CLI は別経路で得た ID を指定する結果更新だけを行える
- 不足または境界: 外部データベース検索、継続監視、法的判定は行わない
- 実装根拠: `api/src/domain/antisocial-check`、`web/app/(app)/antisocial-checks`、`cli/app/antisocial-check`

### 法令知識と法的判定

- 状態: 対象外
- 提供面: なし
- 現状: 制度用語と判断材料をリポジトリ文書に記録する
- 不足または境界: 労務、税務、給与、社会保険、契約の適法性を判定しない
- 実装根拠: `.docs/glossary.md`、`.docs/sources`、`.docs/index.md`

### データ保持、開示、削除方針

- 状態: 未実装
- 提供面: なし
- 現状: 個別資源の削除操作と認可はある
- 不足または境界: 保存期間、法的保全、開示請求、一括削除、匿名化の運用を扱わない
- 実装根拠: `api/src/app.ts`、`api/src/schema.ts`

### 労働安全衛生

- 状態: 未実装
- 提供面: なし
- 現状: 定期健康診断の制度知識をリポジトリ文書に記録する
- 不足または境界: 健診対象、受診状況、面談、事故、ヒヤリハット、安全教育を業務データとして扱わない
- 実装根拠: `.docs/references/terms/teiki-kenko-shindan.md`、`.docs/sources/定期健康診断の実施義務.md`

### リスク台帳と統制

- 状態: 未実装
- 提供面: なし
- 現状: 個別ドメインの権限と入力制約をコードで実施する
- 不足または境界: リスク台帳、統制目的、統制手続き、統制担当者、有効性評価を共通資源として扱わない
- 実装根拠: `api/src/lib/auth/permission-keys.ts`、`api/src/app.ts`

### インシデント、例外、内部監査

- 状態: 未実装
- 提供面: なし
- 現状: API エラーとバッチ状態を個別に返す
- 不足または境界: インシデント、例外承認、是正措置、内部監査計画、監査所見を追跡しない
- 実装根拠: `api/src/domain/batch`、`api/src/app.ts`

### プライバシー管理

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 所有者照合、権限、限定項目ディレクトリで従業員情報へのアクセスを制限する
- 不足または境界: 処理目的、同意、データ分類、保持期間、開示請求、削除請求を管理しない
- 実装根拠: `api/src/interface/shared/verify-bearer.ts`、`api/src/interface/employee/directory/route.ts`

## IAM

ID とアクセス管理（IAM）は、従業員台帳から認証主体と権限を分離する横断基盤である。

### パスワード認証とセッション

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: パスワードログイン、アクセストークン、更新トークンのローテーション、即時失効、本人情報を扱う
- 不足または境界: 多要素認証、端末管理、セッション一覧は持たない
- 実装根拠: `api/src/interface/auth`、`api/src/infrastructure/auth`、`web/app/(auth)/login`、`cli/app/login`

### アカウント、ロール、権限

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: API と Web はアカウント状態、パスワード再設定、ロール作成、変更、削除、割り当て、剥奪を扱う。CLI はアカウント一覧とロール一覧だけを扱う
- 不足または境界: CLI から管理操作を実行できず、提供面の操作は同等ではない
- 実装根拠: `api/src/interface/iam`、`web/app/(app)/admin`、`cli/app/accounts/route.ts`、`cli/app/roles/route.ts`

### 外部認証

- 状態: 部分実装
- 提供面: Schema
- 現状: identity の provider 値は外部認証を表現できるが、認証ルートはパスワードだけを提供する
- 不足または境界: OpenID Connect、OAuth、シングルサインオンの開始、コールバック、連携解除がない
- 実装根拠: `api/src/schema.ts` の `identities`、`api/src/interface/auth`

### 安全な社員選択

- 状態: 実装済み
- 提供面: API、Web
- 現状: 在籍中社員のコード、氏名、部署、役職だけを一般業務の選択肢として返す
- 不足または境界: CLI に独立したディレクトリコマンドはない
- 実装根拠: `api/src/interface/employee/directory/route.ts`、`web/lib/api`

### 組織スコープと案件付与

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 所有者照合、全社権限、組織上の上司、申請ごとの承認者割り当てを使い分ける
- 不足または境界: ロール付与に部署や対象範囲を持たせず、案件単位の一般的なアクセス付与も行わない
- 実装根拠: `api/src/lib/auth/permission-keys.ts`、`api/src/lib/application/resolve-workflow-approvers.ts`

### 委任と職務分離

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 汎用申請の期間付き代理承認と、一部専用承認で申請当事者による自己承認の禁止を扱う
- 不足または境界: IAM 管理権限の委任、競合権限の組み合わせ、購買での申請者と検収者と支払者の分離を共通ルールにしない
- 実装根拠: `api/src/schema.ts` の `approvalDelegations`、`api/src/application/leave/decide-leave-request.ts`、`api/src/application/shift/approve-shift-swap-request.ts`、`api/src/application/thanks-points/decide-redemption.ts`

### アクセスレビューと緊急権限

- 状態: 未実装
- 提供面: なし
- 現状: 管理者が現在のアカウントとロールを閲覧し、割り当てと剥奪を行える
- 不足または境界: 定期アクセスレビュー、承認証跡、期限付き権限、緊急権限、利用後の自動失効を扱わない
- 実装根拠: `api/src/interface/iam`、`web/app/(app)/admin/accounts`

## ワークフロー

ワークフローは、汎用申請と各ドメイン固有の状態遷移を区別する。

### 汎用申請

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: テンプレート、入力スキーマ検証、申請、承認、却下、差戻し後の再申請、全体一覧を扱う
- 提供面の差: テンプレート、本人申請、受信箱、詳細、決定は API、Web、CLI にあり、全社横断一覧は API と Web だけにある
- 不足または境界: 各専用申請を自動的に汎用申請へ変換しない
- 実装根拠: `api/src/domain/application`、`web/app/(app)/applications`、`cli/app/app`、`cli/app/application`

### 承認定義と代理承認

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 多段、条件分岐、必要人数、全員承認、期限、代替承認者、差戻し、ラウンド、期間付き代理承認を扱う。定義は改版と更新者を追記し、並行更新を拒否する。進行中の候補者と定足数を固定し、候補者不足は監査理由付きで修復できる
- 不足または境界: 外部ワークフローエンジンとの同期は行わない
- 実装根拠: `api/src/domain/application/application-workflow.ts`、`api/src/interface/application/approval-delegations`、`web/app/(app)/applications/templates/[code]/workflow`

### 専用承認

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 休暇、経費、シフト交代、サンクス交換、反社チェックが各ドメインの状態と権限で判断を記録する
- 提供面の差: 休暇、経費、サンクス交換は CLI に承認待ち一覧がある。シフト交代と反社チェックは CLI に管理用一覧がなく、ID 指定の判断操作だけを提供する
- 不足または境界: 汎用申請の承認定義、代理承認、ラウンドを共有しない
- 実装根拠: `api/src/domain/leave`、`api/src/domain/expense`、`api/src/domain/shift`、`api/src/domain/thanks-points`、`api/src/domain/antisocial-check`

### 申出だけを持つ専用手続き

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 出張、レンタル、退職、ライフイベント、休業、証明書依頼は本人の申出、変更、取消を記録する
- 不足または境界: 承認者の inbox、判断操作、汎用申請との接続がない
- 実装根拠: `api/src/interface/business-trip`、`api/src/interface/rental`、`api/src/interface/resignation`、`api/src/interface/life-event`、`api/src/interface/family-care-leave`、`api/src/interface/certificate-request`

### 汎用ケース、タスク、意思決定

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 汎用申請が一件の申請と意思決定を、オンボーディングが割り当てタスクを扱う
- 提供面の差: 人事変更は汎用申請の最終承認から人事発令と入退社タスクを接続するが、任意の申請種別をオンボーディングへ接続する共通入口はない
- 不足または境界: 問い合わせ、調査、例外、事故など任意のケース種別と、横断タスク、担当変更、関連記録を共通モデルで扱わない
- 実装根拠: `api/src/domain/application`、`api/src/domain/onboarding`

## 文書・証跡

文書・証跡の領域は、構造化レコードと履歴を扱うが、汎用ファイル管理を持たない。

### 申請と承認の履歴

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 汎用申請と経費の承認履歴、汎用申請のラウンドと代理人情報を保持する
- 不足または境界: 全ドメインを横断する監査検索と証跡のエクスポートは行わない
- 実装根拠: `api/src/schema.ts` の `applicationApprovals`、`applicationWorkflowApprovals`、`expenseApprovals`

### IAM 監査ログ

- 状態: 台帳のみ
- 提供面: Schema
- 現状: 操作者、操作、対象、メタデータ、IP アドレス、時刻を保持するテーブルがある
- 不足または境界: 書き込み処理、閲覧 API、Web、CLI がない
- 実装根拠: `api/src/schema.ts` の `auditLogs`、`api/src/app.ts`

### 証明書発行

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: 証明書の種類、提出先、希望日、用途と依頼状態を記録する
- 不足または境界: 文書生成、管理担当者の処理、電子交付は行わない
- 実装根拠: `api/src/domain/certificate-request`、`web/app/(app)/certificate-requests`、`cli/app/certificate-request`

### 添付ファイル、電子署名、文書保管

- 状態: 未実装
- 提供面: なし
- 現状: テキスト、JSON、Markdown の構造化データを保存する
- 不足または境界: ファイルアップロード、ウイルス検査、電子署名、版管理、保存期限を扱わない
- 実装根拠: `api/src/schema.ts`、`api/src/app.ts`

### 証拠と保持

- 状態: 未実装
- 提供面: なし
- 現状: 申請本文、承認履歴、状態、作成時刻を構造化レコードとして保持する
- 不足または境界: 証拠の出所、完全性、関連付け、法的保全、保持期限、廃棄証明を管理しない
- 実装根拠: `api/src/schema.ts` の `applications`、`applicationApprovals`、`expenseApprovals`

## 連携・運用

連携・運用の領域は、三つの利用面とセルフホスト運用を扱う。提供面ごとの操作は一致しない。

### API、Web、CLI

- 状態: 部分実装
- 提供面: API、Web、CLI
- 現状: 主要ドメインは三つの入口を持ち、Web と CLI は型付き API クライアントを使う
- 不足または境界: IAM 管理、個人設定、安全な社員選択など、操作単位では提供面に差がある
- 実装根拠: `api/src/app.ts`、`web/app`、`web/lib/api`、`cli/app/index.ts`、`cli/lib/http`

### 通知

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: 社内通知の送信、本人一覧、未読件数、個別既読、一括既読、削除を扱う
- 提供面の差: 送信、本人一覧、未読件数、既読操作は API、Web、CLI にあり、削除は API と CLI だけにある
- 不足または境界: メール、チャット、プッシュ通知への配信は行わない
- 実装根拠: `api/src/domain/notification`、`web/app/(app)/notifications`、`cli/app/notify`

### ダッシュボード

- 状態: 部分実装
- 提供面: API、Web、CLI
- 現状: 従業員、申請、アンケートなどの現在値を集計する
- 不足または境界: 指標定義、期間比較、履歴分析、利用者別の構成変更は行わない
- 実装根拠: `api/src/interface/dashboard/route.ts`、`web/app/(app)/page.tsx`、`cli/app/dashboard/route.ts`

### バッチとヘルスチェック

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: バッチ状況の閲覧、旧パスワードハッシュ移行、API ヘルスチェックを扱う
- 提供面の差: バッチ状況は API、Web、CLI、パスワード移行は API と CLI、ヘルスチェックは API だけにある
- 不足または境界: 汎用ジョブの登録、スケジュール、再実行、停止、運用通知は行わない
- 実装根拠: `api/src/domain/batch`、`api/src/interface/batch`、`web/app/(app)/batch`、`cli/app/batch`

### 横断検索と入出力

- 状態: 未実装
- 提供面: なし
- 現状: 従業員、ナレッジなど各ドメインが個別の検索と一覧を持つ
- 不足または境界: 全ドメイン横断検索、保存済み検索、一括出力、標準 CSV 出力、標準 CSV 入力を扱わない
- 実装根拠: `api/src/app.ts`、`api/src/domain`

### Webhook と同期来歴

- 状態: 未実装
- 提供面: なし
- 現状: 外部クライアントが HTTP API を直接呼び出せる
- 不足または境界: Webhook、イベント購読、同期カーソル、外部 ID、同期元、最終同期時刻、競合解決の来歴を扱わない
- 実装根拠: `api/src/app.ts`、`api/src/schema.ts`

### ジョブ運用

- 状態: 部分実装
- 提供面: API、Web、CLI、Schema
- 現状: バッチ名、開始、終了、状態、メッセージを記録し、一覧で確認する
- 不足または境界: スケジュール、キュー、再試行、再実行、取消、進捗、実行ログ、失敗通知を共通基盤で扱わない
- 実装根拠: `api/src/schema.ts` の `batchJobs`、`api/src/interface/batch/route.ts`

### 外部サービス連携

- 状態: 未実装
- 提供面: なし
- 現状: 外部クライアントが HTTP API を呼び出せる
- 不足または境界: Webhook、イベント配信、標準インポート、標準エクスポート、給与、会計、カレンダー、チャットとのコネクタがない
- 実装根拠: `api/src/app.ts`、`api/src/domain`

### セルフホスト基盤

- 状態: 実装済み
- 提供面: API、Web、CLI、Schema
- 現状: Cloudflare Workers、D1、Next.js、Bun を使い、ローカルでは portless で起動する
- 不足または境界: 他のクラウド、他のデータベース、複数組織を同居させる構成は標準化していない
- 実装根拠: `package.json`、`Makefile`、`api/wrangler.jsonc`、`web/package.json`
