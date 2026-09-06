# 従業員の期間参照

会社営業日を `?1` に束縛し、雇用・状態・主務・組織単位の最新revisionから半開区間のsnapshotを組み立てる。公開入口は `companyEmploymentStateSql` と `companyEmployeeDirectorySql`。認可方針、書込み、製品固有の表示は持たない。

利用側は欠落・重複の検査結果を確認し、評価できないsnapshotを拒否する。表示用の雇用statusへfallbackしない。

検証は親ディレクトリの `resolve-live-employee-access.adapter.test.ts` と `employee-directory-read.adapter.test.ts` で実際のSQLiteに対して行う。`create-employee-employment-test-database.test-support.ts` は期間境界と不整合の反例を作るテスト専用入口。
