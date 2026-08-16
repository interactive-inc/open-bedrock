# Workflow Account identity

Workflow Account identity は、判断候補、実際の操作者、代理される主体、定義更新者、委任作成者を、すべて canonical System Account ID で記録する設計である。表示上の型統一ではなく、認証された主体、資格を持つ主体、監査に残る主体を同じ正本へ結ぶ。

誰に会社上の判断資格があるかは Company、何を判断するかは System の Proposal または専用 App、判断をどう成立させるかは System が所有する。Account ID はこの境界を越える主体参照であり、Employee ID、旧 Session ID、permission、組織上の資格の代替ではない。

## Canonical ID

`system_accounts.id` と System domain の `AccountId` が canonical 契約である。opaque な文字列として等価比較と参照だけに使い、数値計算、大小比較、再採番、prefix の意味解釈をしない。

現行の Company Session と `account_employee_links` は互換の整数 Account ID を持つ。Company の `resolveActiveSystemAccountId` と資格 resolver は、この整数を一度だけ情報損失のない文字列へ投影し、対応する active な System Account が存在する場合だけ返す。各 route または System repository が独自に変換してはならない。

`"01"` と `"1"` は異なる System Account ID である。互換 adapter は旧整数 `1` を `"1"` へ写せるが、任意の文字列を数値へ戻したり、先頭ゼロを除去したりしない。

## Account と Employee

Account は認証、停止、session、token version、技術権限を持つ System の主体である。Employee は雇用、在籍、所属、責任、兼務を持つ Company の人事記録である。同じものとして扱わない。

Company は Account と Employee の検証済み対応を所有する。候補解決では、対象時点の Employment と組織資格、対応先 Employee、旧 Account、active な System Account を一つの resolver で検査する。対応を解決できない Employee を System の候補へ渡さない。

System は候補を Account ID で保存し、Employee ID を判断規則に使わない。Company の資格根拠は evidence context、kind、ID、version、digest、resolved at という opaque な snapshot として受け取る。詳細な Employee または Department の意味を System が解釈しない。

## Snapshot と live guard

Company の資格と候補集合は Task round の開始時に固定する。後の組織変更で過去の候補と証拠を書き換えない。

一方、Account の active 状態、session、technical permission、委任の有効期間は判断時に再検査する。候補 snapshot に存在するだけで停止済み Account の判断を許可しない。Company が必要と定める場合は、Account と Employee の対応および在籍も API composition が判断時に再検査する。

固定した資格と live な安全状態は役割が異なる。両方を snapshot にすると停止済み Account が判断でき、両方を live query にすると組織変更で過去の判断根拠が変わる。どちらかを欠く場合は安全側へ拒否する。

## 本人判断と代理判断

`HumanAttestation.actorAccountId` は実際に認証し操作した Account、`representedAccountId` は候補資格を持つ Account である。

本人判断では両者を一致させる。代理判断では両者を分け、有効期間と procedure scope が一致する System Delegation を必須にする。Delegation は候補資格、technical permission、会社上の responsibility を新しく作らない。

同じ round では actor と represented Account をそれぞれ一度だけ数える。Case 作成者は別 Account の代理を使っても自己の Case を判断できない。

## 一人と複数 Account

canonical Account ID への統一だけでは、一人一 Account を保証しない。同じ人に複数の active Account がある場合、Account 単位の一意制約だけでは quorum を水増しできる。

現行の Company 対応は一つの Employee と active Account の対応を検査し、候補解決では同じ Employee を重複して人数へ数えない。将来複数 Account を正式に許す場合は、Principal group または人間の同一性を表す canonical 契約を追加し、System Task が同一人物を複数票へ数えないようにする。それまでは曖昧な対応を候補へ入れない。

## Database 不変条件

System workflow の Account 参照列は canonical TEXT を保存し、`system_accounts.id` へ削除制限付きの外部キーを持つ。履歴が参照する Account は物理削除せず、停止を status で表す。

候補、除外、HumanAttestation、Delegation、ProcedureDefinition の更新者、Proposal の作成者、ExecutionAuthorization の実行主体は同じ Account ID 契約を使う。列ごとに別の主体解決を実装しない。

判断の最終認可は条件付き書込みと database 制約で行う。受信箱の表示だけ、application service の事前検査だけ、外部キーだけを判断許可の根拠にしない。

## 移行

旧 workflow の整数主体は canonical System Account ID へ欠損なく移行した後、System Proposal、Case、Task、HumanAttestation、Delegation へ切り替えた。旧 application workflow table は削除済みである。

削除 migration は、旧 runtime application、approval、workflow、subject、completion data が一件でも残る場合に停止する。proposal digest を SQL で推測して履歴を捨てたり、未知の Account を null または管理者へ置換したりしない。

Company の整数 Session は現行の認証互換境界として残る。将来 Session 自体が canonical System Account ID を返すようになれば、Company の変換 adapter だけを削除し、System domain、schema、履歴は再移行しない。

## 十分性

この設計が十分であるとは、次の問いへ一意に答えられることをいう。

- 候補として固定された System Account はどれか
- その Account はどの Company 資格と証拠に対応していたか
- 実際に操作した Account はどれか
- 本人判断か代理判断か、代理なら誰の資格を使ったか
- 判断時に Account、session、permission、必要な Company 対応を再検査したか
- Account を削除して履歴を孤児化できないか
- 移行不能な旧主体を推測せず拒否したか

提案内容の妥当性、Company の資格規則、quorum、外部実行の成功は別の不変条件である。Account identity だけでそれらを満たしたとは扱わない。

## 矛盾の検査

次の状態はこの設計と矛盾する。

- System の domain または schema へ数値 Account ID や Employee ID を導入する
- Company resolver が active な System Account を確認せず候補を返す
- System が Company の Account table または Employee 対応を読む
- route ごとに異なる文字列化規則を持つ
- canonical ID を数値へ戻して比較、sort、採番する
- 候補 snapshot だけで判断時の live guard を省く
- System Account の active 状態だけで Company 上の資格を省く
- 同じ人の複数 Account を同じ round の quorum へ数える
- 移行不能な主体を null、既定 Account、現在の上司で補完する
- Account 削除で workflow 履歴を cascade 削除する

矛盾が必要に見える場合は例外を追加せず、認証主体、Company 上の人、資格 snapshot、live 状態、監査主体のどれを混同しているかを特定する。
