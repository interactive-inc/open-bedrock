# 入退社の自動配送

Companyの入社・再入社・退職発令から、Onboardingのチェックリストを生成する。SystemのJobが再試行と完了を所有し、Onboardingが発令との対応、生成した割当、受領結果を所有する。

## 起動条件

`ENABLED_OPT_IN_APPS`に`onboarding`または`all`が必要である。未設定や無効化時は、OnboardingのHTTP APIを404で閉じ、定期処理も起動しない。

自動配送には次の設定が必要である。

- `COMPANY_TIME_ZONE`: 発効日を評価する会社のtimezone
- `ONBOARDING_SERVICE_ACCOUNT_ID`: 有効なService Principalを持つAccount
- `ONBOARDING_AUTOMATION_FROM`: 対象にする発令の記録時刻の下限。offset付きISO日時

Serviceには`batch:execute`、`employee:read`、`onboarding:manage`が必要である。処理準備時と保存時に現在のAccount、Principal、権限を検査する。自動配送用の二つの設定が両方未設定の場合は起動せず、片方だけの設定や不正な値ではエラーにする。

Workerの`scheduled`入口が一回につき最大50件の発令をJobへ登録し、最大50件のJobを実行する。定期実行の間隔は配備先の`triggers.crons`が決める。入口の実装だけでは定期実行は登録されず、配備先の設定とmigration適用が必要である。

## 発効日と訂正

入社・再入社は発効日から、退職は最終在籍日の翌日から対象になる。記録時刻が開始設定より前の発令は対象外であり、将来発令は発効日まで待機する。

訂正発令は訂正の記録日と置換後の発効日を区別する。置換後の発効日を持たない過去の訂正は日付を推測せず、未解決の失敗として再試行する。訂正された元の発令は`superseded`、現在の雇用と一致しない発令は`obsolete`として受領し、チェックリストを生成しない。再入社後に古い退職発令を配送しても、退職用チェックリストを生成しない。

保存前に発令のdigest、訂正先、従業員の履歴版、対象雇用の最新の版を再照合する。準備中に人事履歴が変わった場合は、割当とタスクを保存せず再試行する。

## 割当と履歴

入社・再入社には`hire`、退職には`retired`へ紐付いたテンプレートを使う。テンプレートの種別はそれぞれ`join`、`leave`で、タスクは1件以上200件以下が必要である。保存前にテンプレートの対応とタスク内容を再照合する。

同じ発令からの割当は一度だけ生成する。割当、タスク、受領結果、Jobの完了、監査は同じtransactionで確定し、どこかで失敗した場合は一緒に巻き戻す。同じ従業員とテンプレートの未完了割当がある場合は、新しい割当へ暗黙に統合せず失敗にする。

受領結果は`assigned`、`superseded`、`obsolete`のいずれかである。確定した受領結果は変更・削除しない。人事発令から生成した割当の削除は409で拒否し、元の発令とタスク履歴を保持する。

## 配送状態と再投入

`GET /onboarding/onboarding-lifecycle-deliveries`は`onboarding:manage`を持つ主体に、直近100件の配送状態、試行回数、受領結果、割当ID、失敗コード、dead letterと再投入先のIDを返す。時刻はUnixミリ秒である。

配送は待機時間を置いて最大5回試行し、その後はdead letterに残る。`POST /onboarding/onboarding-lifecycle-deliveries/:jobId/requeue`は、Human Principal、step-up、`onboarding:manage`、`batch:write`、`system:admin`を要求する。現在の権限を保存時にも検査し、元の発令と登録処理を保持した新しいJobを作る。同じdead letterへの再送は既存の再投入先を返す。

## 現在の境界

チェックリストの生成は、備品返却、権限の停止、実作業の完了を意味しない。生成後の人事訂正による既存タスクの自動取消・置換は実装していない。

自動配送はCompanyの追記された人事発令を読む。既存のCompany lifecycle outboxを消費済みにする処理ではなく、他のAppへの配送も行わない。独立した受領先は、自分の配送と処理結果を所有する必要がある。
