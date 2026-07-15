# IAM 分離移行記録

規範性: 非規範記録。完了した移行の理由と残存制約だけを記録する。

従業員台帳から認証と role 情報を分離した移行結果を記録する。本書は履歴資料であり、現行 schema、route、認可規則の正本ではない。現行実装はコードと migration、規範は [認可モデル](./authorization-model.md) と [権限と意思決定モデル](./authority-model.md) を正本とする。新しい認可経路を本書から導出してはならない。

## 移行前の問題

移行前は従業員 record が email、password hash、単一 role を持ち、Person、Employee、Account、Identity、SystemRole の責務が混在していた。固定 role と個別 helper へ認可が分散し、複数 role、即時失効、外部 identity、permission catalog の管理が難しかった。

## 移行で導入した構造

- `accounts`: 認証可能な account の状態、従業員との関連、token version
- `identities`: password または外部 identity provider ごとの識別子と credential
- `roles`: system role の安定 key と表示 metadata
- `permissions`: code 上の TechnicalPermission catalog の投影
- `role_permissions`: role と permission の対応
- `account_roles`: account への role assignment
- `refresh_tokens`: rotation、family 単位の失効、replay 検出用 record
- `audit_logs`: 当時導入した audit 保存先

Permission key の集合は code、assignment は database を正とする。JWT に role と permission を固定せず、API が account と token version を検証して実効 permission を解決する構成へ移行した。

## 完了した変更

- 従業員台帳から認証 credential と単一 role を分離した。
- password identity、account、role assignment を migration した。
- access token と refresh token を IAM 基盤へ切り替えた。
- role 名の直接判定を TechnicalPermission 中心へ移した。
- role、permission、account assignment の API と管理画面を追加した。
- 一般業務向けの従業員選択を、必要最小限の directory field へ分けた。

実際の table、migration、route は現在の code を正とする。本書の列挙は現在 schema の完全な一覧ではない。

## 未実装の境界

この移行は HumanPrincipal 相当の Account と Employee を分離する基礎を作ったが、現在の会社メタモデル全体を完成させたものではない。

- Human、Agent、Service、Connector を独立した Principal kind として表現しない。
- requested_by、proposed_by、approved_by、executed_by を完全には分離しない。
- TechnicalPermission と OrganizationalAuthority を同じ評価器で合成しない。
- HumanAttestation と ExecutionAuthorization を持たない。
- organization scope、field policy、case candidate snapshot は domain ごとに実装差がある。
- 外部 identity の schema 上の拡張点は、外部 login flow の実装済みを意味しない。
- audit table の存在は、すべての高リスク operation が完全に監査されることを意味しない。

これらは migration の失敗ではなく、後続の [会社メタモデル](./company-model.md) が導入した拡張課題である。

## 維持する原則

- Person、Employee、Principal、Account、Identity、SystemRole を同一視しない。
- role key ではなく TechnicalPermission を業務 code の操作上限に使う。
- permission は scope、field、state、case assignment、authority を代替しない。
- UI の表示制御を認可の正本にしない。
- token と role の変更を即時失効可能にする。
- 最後の実効管理者を失う変更を account 状態と permission の実効和集合で拒否する。
- assignment の取消と過去の audit 根拠の削除を分ける。
