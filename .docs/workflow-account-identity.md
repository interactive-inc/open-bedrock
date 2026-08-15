# Workflow Account identity

Workflow Account identity は、判断候補、実際の操作者、定義更新者、委任作成者、修復実行者を、すべて同じ canonical System Account ID で記録する設計である。これは表示上の型統一ではなく、認証された主体、資格を持つ主体、監査に残る主体を同じ正本へ結ぶための基盤である。

この設計が保証する範囲は主体の同一性と参照整合性である。誰に会社上の判断資格があるかは Company、何を判断するかは各 App、判断をどう成立させるかは System が所有する。Account ID の統一だけでそれらすべてが完成したとは扱わない。一方、主体のIDが複数体系に分かれたままでは、どれほど厳密な資格や判断規則を実装しても接続点で別人を結び得るため、この統一は後続機能の前提になる。

## 解決する問題

旧実装では System Account の正本は opaque な文字列 ID を持つ一方、request workflow の候補、判断者、更新者、委任作成者、event actor は Company の旧整数 Account ID を保存していた。値が偶然 `1` と `"1"` で対応していても、型、外部キー、参照先が異なれば同じ主体である保証にはならない。

この二重性を残すと、次の不具合を構造的に防げない。

- 候補 snapshot は存在するが、対応する System Account が存在しない
- 停止した System Account を旧 Company Account の active 状態だけで有効と判断する
- Employee ID をログイン主体と誤認し、複数 Account または Account 変更を区別できない
- 判断履歴の actor と認証 session の subject を同じ正本から追跡できない
- System Task へ切り替える際に、Request の候補を安全に移送できない
- 文字列化規則が route、repository、migration ごとに増殖し、ある経路だけ異なるIDを保存する

値が現在一致することと、将来も同じ不変条件で一致することは別である。そのためコード上の変換だけではなく、保存済み履歴、今後の書込み、読出し時のlive guardを一つの契約へ揃える。

## 用語

System Account ID は認証主体の正本を指す opaque な文字列である。数値として計算、大小比較、再採番、意味解釈をしない。現行の旧 Account が整数であることは移行元の事情であり、System Account ID の仕様ではない。

Employee ID は会社における人の記録を指す。Account ID とは役割が異なる。Employee は退職、再雇用、所属、責任、兼務など会社上の事実を持つ。Account は認証、停止、session、token version、技術権限などシステム上の主体状態を持つ。

候補 Employee は会社上の資格を説明する。候補 Account は実際に判断できる認証主体を固定する。両方を保存する旧 Request workflow では、Employee ID はCompany資格と監査表示に使い、Account ID は本人判断、代理判断、live account guard、将来のSystem Task接続に使う。

legacy Account ID は現行 session とCompany対応表が利用する整数である。互換境界の外へ漏らさない。新しい workflow domain、repository、schema、監査履歴はcanonical System Account IDだけを扱う。

## 所有境界

System は Account ID の形式とAccount状態の正本を所有する。Account IDを文字列化できるか、Accountが存在するか、activeか、削除可能かをSystem側の契約で決める。SystemはEmployee、Department、上司、role keyを解釈しない。

Company はAccountとEmployeeの対応、Employment、組織、責任、判断資格を所有する。CompanyのOrganizational Authority resolverは、旧対応表からEmployeeとの関係を確認したうえで、対応するactiveなSystem Accountが存在する候補だけを返す。返却するAccount IDは最初からcanonical型であり、呼び出し側が旧IDを推測変換しない。

Request は候補snapshotと旧workflow履歴を所有するが、Accountの正本を所有しない。RequestはCompanyが返したcanonical候補を保存し、判断時にSystem Accountのlive状態とCompanyの対応および在籍を再検査する。

API境界は現行のlegacy Sessionを受け取る。Requestの互換adapterは、その整数IDを一度だけdigit-onlyのcanonical IDへ投影する。adapterはAccountを作成せず、存在やactive状態を推測しない。実際の書込みと認可queryがSystem Accountのjoinまたは外部キーで正本を検査する。

この依存方向は Request から Company と System、Company から System である。System から Company または Request への依存は作らない。

## なぜEmployee IDを主体にしないか

Employeeは会社上の人を表すが、認証した主体そのものではない。一人のEmployeeに複数の認証手段やAccountが存在し得る。反対に、未紐付けの管理Account、入社前のAccount、退職後に停止したAccountもあり得る。

判断履歴にEmployee IDしか残さない場合、どのcredentialとsessionで操作したか、停止前後のどのAccountだったか、代理人がどのAccountで操作したかを区別できない。技術的な本人性を会社上の人事記録から逆算することになり、SystemがCompanyへ依存する。

Account IDしか保存しない場合も、会社上の資格、同一人物の複数Account、退職、所属範囲を説明できない。したがって接続期間中のRequestはEmployeeとAccountを組で扱い、両者の対応を候補解決時と判断時の両方で検査する。将来System Taskへ移行しても、SystemはAccountだけを判断規則に使い、Companyの資格証拠はopaqueな参照またはdigestとして受け取る。

## なぜopaqueな文字列にするか

System Account IDを整数に限定すると、採番機構、database製品、単一tenant、既存Company schemaという現在の制約をSystem contractへ固定する。UUID、外部Identity Providerのsubjectから生成したID、複数製品間で衝突しないIDへ変更するとき、すべての業務tableとAPIを再移行しなければならない。

opaqueな文字列なら、利用側は等価比較と参照だけを行う。長さは安全な保存上限として制約するが、桁、prefix、文字種へ業務上の意味を持たせない。現行移行でdigit-only文字列になるのは、旧整数IDを情報損失なく一対一投影するためである。将来のIDまでdigit-onlyに限定する理由にはしない。

文字列化はIDの正規化ではない。`"01"`と`"1"`はSystem contract上は別IDである。現行legacy整数からは`"1"`だけが導かれる。adapterが任意文字列を数値へ変換したり、先頭ゼロを除去したりしてはならない。

## 書込み経路

Companyによる初期候補解決では、Companyの旧Account、AccountとEmployeeの対応、対象時点の在籍と組織、canonical System Accountを同じqueryとresolverで結ぶ。旧AccountとSystem Accountの両方がactiveであり、IDが0127の一対一投影と一致する場合だけ候補にする。

Requestのstep snapshotはCompanyから受け取ったcanonical Account IDを変更せず保存する。同じEmployeeとAccountが複数条件から導かれた場合は候補行を一つにまとめ、資格証拠をすべて残す。Account IDを文字列連結して後から分解しない。opaque IDには区切り文字が含まれ得るため、EmployeeとAccountの二段Mapで集約する。

定義更新、判断、委任作成、手動修復では、認証済みlegacy SessionのAccount IDをRequest入口で一度だけcanonical IDへ投影する。application serviceとrepositoryへ数値を渡さない。書込み直前にはSystem Accountの存在とactive状態、必要なCompany対応、候補snapshot、委任期間、workflow状態を再検査する。

workflow eventのactor、workflow approvalのapprover、workflow definitionのupdated by、delegationのcreated byはすべて同じcanonical型と同じSystem Account外部キーを使う。監査列ごとに別の主体解決を実装しない。

## 読出しとlive guard

候補snapshotは資格を固定するが、将来の操作許可を永久に保証しない。判断時にAccountが停止されていれば、snapshot作成時にactiveだったとしても拒否する。これにより組織変更で過去候補を改変せず、現在のセキュリティ状態も無視しない。

判断時のlive guardはcanonical `system_accounts`をAccount状態の正本として読む。Companyの`account_employee_links`はEmployeeとの対応を検査するためにだけ読み、旧整数IDを`CAST`してcanonical IDと完全一致させる。旧`accounts.status`だけをSystem Accountの代用にしない。

受信箱、判断可能表示、到達可能quorum、実際のapproval insertは同じ条件を使う必要がある。表示だけ緩い、または書込みだけ緩い状態を許さない。最終的な権限判定はapproval insertの条件付き書込みで行い、事前の画面表示やapplication判定だけを権限の根拠にしない。

手動修復も例外ではない。管理者が候補Employeeを選べても、activeなcanonical System Accountとの対応を解決できない候補は保存しない。修復actorもcanonical IDでeventへ残し、修復理由、旧round、新round、quorumを同じ監査記録へ結ぶ。

## Database不変条件

Request workflowのAccount参照列はすべてTEXTで保存し、`system_accounts.id`へ`ON DELETE RESTRICT`の外部キーを持つ。Account履歴を参照するworkflowが存在する間、System Account正本を物理削除して監査を孤児化できない。停止はstatusで表し、履歴参照を壊さない。

非nullのAccount IDは長さ一文字以上255文字以下に制約する。候補Accountは必須である。移行前の監査主体を復元できない定義履歴、approval、event、delegationのactorはnullを維持できる。未知の値を推測して埋めない。

移行は次の順で行う。

- 既存の非null Account参照をすべて列挙する
- 対応するcanonical System Accountが一件でも欠ければschema変更前に失敗する
- tableを新しいTEXTと外部キーの定義へ置換する
- 値を情報損失なく文字列へ投影する
- unique index、検索index、append-only triggerを再作成する
- AUTOINCREMENTの高水位をtableが空でも維持する
- 保存型と全外部キーを再検査する
- 一つでも不整合があればmigration全体をrollbackする

変換できる行だけを移行して残りを捨てない。未知のAccountをnullへ落とさない。外部キーを一時的に持たない最終schemaを公開しない。移行成功は行数だけでなく、保存型、参照整合性、index、trigger、sequenceまで検査する。

## Snapshotとlive状態を分ける理由

候補解決時のCompany資格と判断時のSystem Account状態は異なる時点の事実である。両方をsnapshotにすると、停止済みAccountが判断できる。両方をlive queryにすると、組織変更で過去の候補と根拠が書き換わる。

したがって、Company資格と候補集合はround開始時に固定し、System Accountのactive状態、session、technical permission、委任の有効期間は判断時に再検査する。Employeeのlive在籍も現行Request互換実装では再検査する。将来System Taskへ切り替える際は、Companyが提供する主体対応のlive guardを公開operationとして分離し、System自身がCompany tableを読まない形へ移す。

固定と再検査の境界が曖昧な場合は、安全側へ拒否する。現在の組織から過去候補を補完したり、snapshotにいるから停止Accountを許可したりしない。

## 一人と複数Account

canonical Account IDへの統一は、一人一Accountを自動的に保証しない。Company resolverは現行対応表から候補を生成し、同じEmployeeに複数のactive Accountがある場合は複数候補になり得る。現行Requestのquorumは一意なEmployee数を基準にするため、初期候補解決ではAccount行数による水増しを避けている。

System TaskはAccount単位で候補とattestationを扱う。System Taskへ完全移行する前に、CompanyのAccountとEmployeeの一対一またはprincipal-group契約を明示し、同一人物の複数Accountを一つのquorumへ数えない証明が必要である。canonical IDへ変えただけで人間単位のquorumが完成したとは表示しない。

この未完成点を理由に数値IDを残す必要はない。主体IDの正本化と、人間単位の同一性は別々の不変条件であり、前者を先に完成させることで後者を一箇所で実装できる。

## 失敗時の扱い

次の状態では処理を継続しない。

- legacy Session IDが安全な非負整数でない
- 旧Accountに対応するSystem Accountが存在しない
- System Accountがactiveでない
- candidate Accountとcandidate EmployeeのCompany対応が一致しない
- candidate Employeeが対象時点または判断時点で有効でない
- migration対象履歴にcanonical Account欠損がある
- 外部キー、append-only trigger、index、sequenceの再構成を確認できない
- 事前認可と条件付き書込みの結果が競合する

この失敗を管理者Account、Employee ID、null、現在の上司で補完しない。移行ではrollback、application operationでは明示的な失敗、並行競合では既存の状態を再読出しして安全な結果へ変換する。

## 十分性

このAccount identity設計が十分であるとは、workflow全体がSystem Taskへ移行済みという意味ではない。主体に関して、次の問いへ一意に答えられることをいう。

- 候補として固定されたcanonical System Accountはどれか
- そのAccountはどのEmployeeとCompany資格に対応していたか
- 実際に操作したcanonical System Accountはどれか
- 本人判断か代理判断か、代理なら誰の資格を使ったか
- 定義更新、委任作成、修復を行ったAccountはどれか
- 判断時にAccountとCompany対応を再検査したか
- Account正本を削除して履歴を孤児化できないか
- 旧履歴を欠損なく同じcanonical IDへ移行したか

型、database、候補解決、read guard、write guard、migration testが同じ答えを返すため、現行Request workflowの主体同一性には十分である。

一方、提案versionとdigest、ProcedureDefinition、System application service、HumanPrincipal、step-up、HumanAttestation、ExecutionAuthorization、outbox、Company Responsibility scopeはこの設計の範囲外である。それらが未完成である限り、Request workflow全体を最終System workflow利用済みとは扱わない。

十分性を局所的に明示することで、未完成を隠さず、完成した不変条件を後続作業で壊さない。

## 削除可能性と再利用

Requestを削除してもSystem Account、CompanyのAccountとEmployee対応、Organizational Authority resolverは残る。他のAppはCompanyからcanonical候補を受け取り、System Taskへ渡せる。Request固有のworkflow tableやadapterをimportする必要はない。

Companyを持たない製品でもSystem AccountとSystem Taskは成立する。その製品は候補を別のownerから受け取る。System Account IDがCompanyの整数採番を仕様にしていないため、System codeを変更する必要はない。

legacy Sessionがcanonical System Sessionへ切り替わった時は、Requestの`toSystemAccountId` adapterを削除し、sessionのAccount IDをそのまま渡す。domain、repository、schema、履歴は既にcanonical型なので再移行は不要である。互換処理を入口へ閉じ込める価値は、この削除が局所変更で済むことにある。

## 矛盾の検査

次の状態はこの設計と矛盾する。

- Requestのdomainまたはschemaへ数値Account IDを再導入する
- Employee IDをactor Account IDとして保存する
- Company resolverが旧Accountだけを確認し、System Accountを確認せず候補を返す
- Systemが旧Company Account tableまたはEmployee対応を読む
- Requestの各routeが独自の文字列化規則を持つ
- canonical IDを数値へ戻して比較、sort、採番する
- candidate snapshotのAccount有効性だけで判断時のlive guardを省く
- System AccountのactiveだけでCompany上のEmployee対応と資格を省く
- read pathとwrite pathで異なる候補条件を使う
- migrationが変換不能な履歴をnullまたは既定Accountへ置換する
- Account削除でworkflow履歴の外部キーをcascade削除する
- append-only監査triggerまたは既存indexをtable置換時に失う
- Account ID統一だけを理由にSystem workflow全体が完成したと表示する

矛盾が必要に見える場合は例外を追加せず、認証主体、Company上の人、資格snapshot、live状態、監査主体、移行元のどれを混同しているかを先に特定する。

## 現行実装

`system_accounts.id`とSystem domainの`AccountId`がcanonical契約である。Requestのworkflow domain、Drizzle schema、repositoryはこの型を使用する。

Companyの`resolveOrganizationalAuthorityCandidates`は旧AccountとEmployee対応をCompany事実として読み、activeなcanonical System Accountへjoinして候補を返す。資格証拠には解決したSystem Account IDを残す。

Requestの`toSystemAccountId`はlegacy Sessionだけを扱う明示的な互換adapterである。定義更新、判断、委任作成、手動修復、受信箱、詳細の判断可能表示がこの境界を通る。

Requestのlive guardと条件付きapproval insertは`system_accounts`を正本として使い、Company対応表は`CAST`による完全一致でEmployeeとの対応を確認する。

`0131_request_workflow_system_account_ids.sql`は六系統のactorとcandidate列をcanonical TEXTへ移行する。migration testは全履歴の保存型、外部キー、未知Account拒否、監査履歴の追記専用、index、rollback、AUTOINCREMENT高水位を検証する。

次の接続作業は、Requestのproposal versionとdigestを作り、現行candidate snapshotをSystem CaseとDecisionTaskへ同一transactionまたは回復可能なoperationで写し、判断経路をSystem HumanAttestationへ切り替えることである。この時点ではID変換を追加せず、既にcanonicalなAccount IDをそのまま使う。
