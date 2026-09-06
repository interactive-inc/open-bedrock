# 外部identity同期

`POST /company/external-identity-imports` は、外部identityの登録と氏名・emailの更新をCompanyへ取り込む。対象providerは `oidc`、対象organizationは `organization:default` に限る。

## 操作主体と権限

AuthorizationのBearerには、Systemのmachine sessionで発行したaccess tokenを要求する。人のtokenと共有キーは使用できない。Account、Principal、発行元credentialの有効性を認証時と保存時に検査する。

操作Accountは、resource type `system:identity_provider`、resource ID `oidc` に対する `account:manage`、`employee:write`、`iam:write` をすべて持つか、`system:admin` を持つ必要がある。globalの許可も評価対象になる。従業員との対応は機械主体の操作条件に含めない。

新規Accountへ付与する初期roleはglobalのroleに限る。操作Accountにはglobalの `iam:write` と付与先roleの全permission、またはglobalの `system:admin` を要求する。保存直前にroleのpermissionと操作Accountの許可を再検査する。

## 入力

一つのcommandは1件から25件のidentityを持つ。

- `command_id`: 空白を含まない1文字から200文字の識別子
- `expected_revision`: 読み取ったCompany organizationの版
- `reason`: 1文字から2,000文字の操作理由
- `identities`: 同期対象の配列

各identityは次の値を持つ。

- `subject`: provider内で一意なSystem identity subject
- `source_revision`: 外部側の正の整数の版。同じsubjectでは単調に増加させる
- `email`: emailアドレス
- `name`: Company Personの氏名
- `account_id`: 接続先Account。省略またはnullの場合、既存subjectから解決する
- `initial_role_id`: 新規Accountへ付与するrole ID
- `new_employee`: 新規従業員の `hire_date` と `employment_type`。開始日は実在する暦日、区分は `FULL_TIME` または `PART_TIME`

未知のsubjectから新しいAccountと従業員を作る場合、`initial_role_id` と `new_employee` は必須になる。雇用日、区分、初期権限を既定値で補わない。既存Accountの更新ではこの二つの値を雇用変更・権限変更には使用しない。

既存Accountへのidentity追加には `account_id` の明示と、公開Company従業員への接続を要求する。email一致だけではAccountへ接続しない。公開resourceに接続していない既存従業員は拒否し、過去の雇用事実を推測して作らない。

## 保存と再送

新規登録はSystem Account、Identity、role binding、Company Person・Employee・Employment、業務台帳、期間履歴、Account対応、監査を同じtransactionで保存する。氏名・email変更は公開Person、業務台帳、Account表示、System identity profileへ同時に反映する。既存Personの最新改訂が未発効または失効済みなら、同期で上書きせず競合を返す。

commandはCompanyの版を一つ進める。更新対象がなくても、操作Account、credential、理由、期待版、結果版、結果件数を変更不能なcommand receiptへ記録する。全件の保存、監査、receiptのいずれかが失敗した場合は全件を取り消す。

同じcommand ID、操作Account、入力による再送は、認証と権限を再検査して保存済みの結果を返す。入力が異なる同一command IDは拒否する。外部版が保存済みより古い場合、または同じ外部版で内容が異なる場合も拒否する。同じ外部版と内容の再取得はidentity単位でskipし、Personの履歴や変更監査を増やさない。

## 応答

成功は200で `created`、`updated`、`skipped`、`organization_revision`、`replayed` を返す。`created` は新規identityの件数であり、既存Accountへのidentity追加を含む。`updated` は外部版を更新した既存identityの件数になる。再送では元の件数と確定版を返し、`replayed` はtrueになる。

- 400: 入力、subjectの重複、新規雇用・初期roleの指定が不正
- 401: token不正、credential失効などの認証失敗
- 403: 人のtoken、provider scopeまたは付与権限の不足
- 409: Company版・外部版・command IDの競合、Account対応や有効期間の不整合
- 503: DB処理失敗、保存中に許可条件が変わった場合など、確定できない変更

旧 `POST /system/provisioning/identities` と `PROVISIONING_API_KEY` は使用しない。旧入力にはcommand、版、雇用事実がないため、新しい入力契約への変更を必要とする。

複数provider、複数organization、既存の未接続台帳の移行、退職・再入社・契約区分の変更はこの入口の対象外になる。本番D1の実行時間と資源制限はSQLiteでのtransaction検証だけでは保証しない。
