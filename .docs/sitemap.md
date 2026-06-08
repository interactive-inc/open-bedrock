# サイトマップ

web(Next.js)の画面一覧。動的セグメントは [param] で表す。機能の概要は [[features|機能一覧]]、導線は [[user-flows|ユーザーフロー]] を参照する。実装が正であり、ルートは web/app 配下を正とする。

## 認証

- /login — ログイン

## ダッシュボード

- /dashboard — 集計の表示

## 社員と組織

- /employees — 社員の検索
- /employees/new — 社員の登録
- /employees/[code] — 社員の詳細と編集
- /org — 組織ツリー
- /org/departments/[code]/members — 部署メンバー
- /org/reporting-line/[code] — レポートライン

## 申請ワークフロー

- /applications — 自分の申請一覧
- /applications/inbox — 承認待ち一覧
- /applications/[id] — 申請の詳細
- /applications/templates — テンプレート一覧
- /applications/templates/[code] — テンプレートの詳細

## 勤怠と休暇

- /attendance — 自分の勤怠
- /attendance/all — 全社員の勤怠
- /leave — 休暇の申請と残数
- /leave/inbox — 休暇の承認待ち

## 経費

- /expense — 自分の経費
- /expense/inbox — 経費の承認待ち
- /expense/[id] — 経費の詳細

## ナレッジ

- /knowledge — ナレッジの検索
- /knowledge/[id] — ナレッジの詳細

## 会議室と備品

- /rooms — 会議室の予約
- /rooms/manage — 会議室の管理
- /assets — 備品一覧
- /assets/new — 備品の登録
- /assets/[code] — 備品の詳細
- /assets/lent/me — 自分の貸出

## スキルと目標

- /skills — スキル一覧
- /skills/me — 自分のスキル
- /goals — 目標一覧
- /goals/[id] — 目標の詳細

## 1on1とアンケート

- /oneonone — 1on1の記録
- /surveys — アンケート一覧
- /surveys/manage — アンケートの管理
- /surveys/responses — 回答の確認
- /surveys/[surveyId] — アンケートの回答
- /surveys/[surveyId]/summary — 集計

## キャリア

- /career — キャリアシートと社内公募

## オンボーディング

- /onboarding — テンプレートの管理と割り当て
- /onboarding/me — 自分のタスク
- /onboarding/employee/[code] — 社員ごとの進行

## 給与

- /payroll — 自分の給与明細
- /payroll/[id] — 給与明細の詳細
- /payroll/admin — 給与の発行管理
- /payroll/salary-revisions — 給与改定

## 評価

- /review — 評価サイクルとフォーム
- /review/results — 評価結果

## シフト

- /shift — シフトの作成と交代申請

## 研修

- /training — 研修コース一覧
- /training/[code] — 研修コースの詳細

## 通知

- /notifications — 通知と未読数

## 感謝

- /thanks — 感謝の送付と報酬交換

## 労務・ライフイベント手続き

- /business-trips — 出張
- /rentals — 貸与品のレンタル
- /resignations — 退職
- /life-events — ライフイベント
- /family-care-leaves — 産休、育休、介護休業
- /certificate-requests — 証明書発行依頼
- /year-end-adjustments — 年末調整
- /antisocial-checks — 反社チェック

## システム

- /batch — バッチの状況
