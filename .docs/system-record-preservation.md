# 業務原記録の保全

Systemは所有業務を識別した原記録、内容digest、暗号化した本体、保持条件、開示条件を保存する。Companyの人物・雇用・組織の正本へ業務固有の台帳を移す機構ではない。業務撤去時の必要条件は[業務撤去時の原記録](records-model.md#業務撤去時の原記録)に従う。

## 元記録と取得時点

原記録はsourceNamespace、所有context、記録種別、元ID、形式と形式版、内容digestで識別する。元版と元記録日時は未提供を許し、取得日時と区別する。sourceNamespaceは保存元を区別する運用設定であり、会社IDやDB名から推測しない。

サービス利用台帳の取得内容は、台帳本体、変更履歴、利用者への割当と解除記録である。台帳本体のrevisionは本文に残すが、変更・割当を含む全体の元版として流用しない。取得物全体の元版と元記録日時はnullとし、全体の一致は内容digestで検査する。

## 提出と判断

サービス利用台帳には`/software-license/software-licenses/:id/preservation-requests`配下のAPIがある。業務が無効な場合、この経路は利用できない。

- 基点へのPOSTは`procedure_key`と`conditions`を受け取る。初回提出にはUUIDの`idempotency-key`が必要であり、同じ主体・キー・条件の再送は既存の受付結果を返す。
- `/:number`へのGETは現在の承認待ちの提案と`decision_target`を返す。`include_original=true`の場合は検証済みの原文をsourceとcontentBase64で返す。原文を要求しなければoriginalはnullになる。
- `/:number/approve`と`/:number/reject`へのPOSTは、確認した`decision_target`とcommentを受け取る。却下と差戻しの区別は設定された手続きに従う。 同じ主体・対象・判断・commentの再送では既存の判断を照合し、次段階へ進んでいても票を追加しない。照合中に案件状態が変わった場合は409で再試行を要求する。
- `/:number/withdraw`へのPOSTは申請者本人の承認待ち提案だけを取り消す。確認したproposal_digestとreasonが必要であり、取消済みの再取消は409になる。
- `/:number/resubmit`へのPOSTは却下・差戻し・取消済みの本人の提案を、同じ番号の次版として提出する。procedure_key、conditions、previous_version、previous_digestを要求し、元記録を再取得する。旧版の本文・判断・本体は残す。

提出者には現在の台帳管理資格と`system:record:preserve`を要求する。保存元の`RECORD_SOURCE_NAMESPACE`が未設定または不正な場合は503で拒否する。呼出側が原文、内容digest、操作主体、保存先、承認結果を指定することはできない。

判断対象のGETには`system:procedure:read`と現在のCompany判断資格が必要である。原文の復号後にも資格・案件・添付状態を照合し、閲覧監査の保存に成功してから応答する。承認・却下にもCompany判断資格を要求し、台帳管理権限やSystem管理権限で代用しない。

## 保全の確定

`/:number/execute`へのPOSTはproposal_digestを受け取り、承認済みの保全を確定する。承認操作だけでは保全を確定しない。

実行者には提案で固定した主体、現在の台帳管理資格、`system:record:preserve`を要求する。元記録の一致と、必要な人間承認・現在の会社上の資格を実行直前にも検査する。変更された原記録、古いdigest、未承認の案件では確定しない。

一回限りの実行許可の消費、原記録、保持条件、初期開示条件、監査、案件の実行済み状態は一緒に確定する。確定済みの再送でも現在の実行主体・技術権限・元記録を検査し、同じ実行の受付結果を返す。

提案が参照する準備済み本体は、却下・取消後も未紐付け添付の掃除対象にしない。どの提案からも参照されない準備済み本体は通常の掃除条件に従う。同時提出で本体の準備が重なっても、提案や保全の確定を重複させない。

## 業務撤去後の参照と出力

`GET /system/preserved-records`は所有業務を参照せず、現在の資格で開示できる保全記録を探す。actionとpurposeは必須であり、本文取得と同じ操作権限・個別開示条件を要求する。source_namespace、owner_context、record_kind、source_record_idで絞り込める。

recordsは保全ID、出所、保全確定日時を返す。元版・元記録日時の未提供を取得日時で補わない。承認者、保持理由、他の開示対象者は一覧に含めない。

limitの既定値は25、最大値は50である。保全IDの昇順に取得し、続きがあれば最後に開示した保全IDをnextCursorとして返す。次の要求ではcursorへ渡す。未許可の記録を件数やcursorへ含めない。各ページで現在の資格を検査するため、cursorは過去の閲覧資格や検索時点の全体を固定しない。途中で追加された記録も含む全体を確認する場合は先頭から検索し直す。

応答直前にも操作資格、開示条件の最新版と有効期間を照合し、閲覧監査と同じtransactionで検査する。失効・条件更新・監査保存の失敗では一覧を返さない。期限外の候補だけでページを打ち切らず、許可された記録まで検索を継続する。

`GET /system/preserved-records/:recordId/content`は所有業務の実装を呼ばずに確定済み原文を返す。actionはreadまたはexport、purposeは開示目的を指定する。

readには`system:record:read`、exportには`system:record:export`を要求する。加えて、現在の個別開示条件で主体・操作・目的が許可されている必要がある。元業務の管理権限や保全を実行した事実から閲覧許可を推測しない。復号・完全性検査と、資格・開示条件の再照合、監査保存に成功した場合だけ本体を返す。

formatの既定値originalは原文のバイト列を返す。exportで指定できるpackageはversion、source、contentBase64を持つJSONを返す。応答はno-storeとし、ファイルとして出力する。

## 保全の承認履歴

`GET /system/proposals/:number/versions/:version`は保全提案の版、本文とdigest、手続き定義、案件状態、task、承認・却下・差戻しの証言を返す。提案本文のrecordIdと原文のcontentDigestによって、保全記録と判断対象を照合できる。この経路も所有業務のコードや台帳を参照しない。

閲覧には`system:procedure:read`に加え、その版の申請者・判断者・被代理者であること、または`system:procedure:read:all`が必要である。承認した人でも、原文の出力には別途原記録の出力資格を要求する。原文を出力できる人へ承認履歴の閲覧資格を自動的に付与しない。資格失効後は、かつて申請・承認した本人であっても履歴の閲覧を拒否する。

## 現行の制約

公開された原記録取得・提出経路はサービス利用台帳に限られる。他業務の必要記録・添付の収集、保全対象全体の網羅確認、撤去の確定操作は揃っていない。

packageは原文と出所を含むが、過去の承認・監査・保持履歴をまとめた一括出力ではない。承認待ちのGETは終了済み案件の履歴取得や全提案の発見を代替しない。却下・取消した準備済み本体の最終的な処分を決める公開経路も持たない。

一般添付の保持・削除停止は[添付の保全](system-attachment-preservation.md)に従う。原記録の保全APIは、外部ファイルやバックアップの保持・失効を自動的に保証しない。
