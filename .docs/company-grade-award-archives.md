# 等級付与の原記録保全

保存済みの旧等級付与原記録は、旧台帳を撤去した後もCompanyが保持する。元の理由と作成日時は原文のままとし、雇用、終了日、過去の等級名称、元の判断者が不明な場合は補完しない。確認時点の定義は過去の付与時点の定義とは区別する。原記録の保全は期間付き等級割当や会社上の判断資格を生成しない。

`GET /company/grade-award-archives/:commandId`は、既定会社へのアクセス資格とCompany管理資格を持つ主体に、保全原文・保全主体・理由・確認日・記録日時を返す。依頼IDが不明な場合は、`GET /company/grade-award-archives/by-employee/:employeeId`から取得できる。従業員別参照は、既定会社へのアクセス資格を持つ本人または`employee:attributes:read`権限者に許可する。

記録が存在しない場合は404、原文の構造やdigestが不正な場合は503となる。参照不能を空の履歴に置き換えない。原記録の更新・削除はDBで拒否する。

旧台帳からの確認・保全を行う`GET /company/grade-award-archives`と`POST /company/grade-award-archives`は提供しない。撤去時には旧定義と公開履歴、旧付与と保全原文を照合し、一件でも未保全なら旧台帳の削除前に停止する。保全済みの原文・監査・公開履歴は削除しない。

`bedrock employee-grades create` は確認済みJSONとIdempotency-Keyを受け取り、公開Companyの等級割当を作成する。従業員、雇用、公開等級の各IDと有効期間、会社版を必須とし、旧付与台帳には書き込まない。`bedrock employee-grades list` は指定した会社と従業員の公開等級割当を会社版とともに返す。`--organization-revision`で指定した会社版へ固定でき、存在しない版を最新版で置き換えない。未確定の旧付与記録を期間付き割当へ推測変換しない。

## 確定した等級割当の履歴

`GET /company/grade-assignment-history`は`x-company-organization-id`と`employee_id`、`organization_revision`を必須とし、指定版までの等級割当の全改訂を返す。会社へのアクセス資格と、本人または`employee:attributes:read`の資格を要求する。旧付与原記録を等級割当へ変換して返すことはない。

各改訂は割当ID、資源版、会社版、状態、有効期間、従業員・雇用・等級ID、変更依頼ID、記録者、理由、記録日時を持つ。取消済みの改訂も保持する。等級IDを現在の名称で置き換えず、過去の名称を推測しない。

`limit`は1〜100件、既定100件とする。`offset`は既定0で、続きがある場合だけ`nextOffset`を返す。次ページも同じ会社版を指定することで、取得中の追記・訂正に影響されない。順序は会社版、割当ID、資源版で固定する。指定版までの一致する記録がなければ空配列を返す。未来版や不正な条件は400、取得失敗は503となり、空の履歴として扱わない。
