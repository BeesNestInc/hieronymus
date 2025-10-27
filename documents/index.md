# Hieronymusマニュアル
![Hieronymuslogo](./images/github-logo.png)

Hieronymusのマニュアルです。

もちろん完成版ではありませんが、追い追い追加して行きます。

## 目次

* 概要
* [インストール](./install.md)
  * ソースコードからインストール
  * Dockerを使用したインストール
* [ユーザの登録](./user.md)
* [運用環境の設定](./initial.md)
  * 初期セットアップ
* [勘定科目管理](./account.md)
* [取引先管理](./company.md)
* [案件管理](./task.md)
* [取引管理](./transaction.md)
* [品目管理](./item.md)
* [役職員管理](./member.md)
* [伝票と証憑の入力](./crossslip.md)
  * ワークフロー別の作業パターン
    * 伝票入力を最初に行うパターン
    * 電子証票から入力するパターン
* [証憑管理](./voucher.md)
* [元帳の確認](./ledger.md)
* [残高試算表](./trial-balance.md)
* [推移表](./changes.md)
* [プロジェクト管理](./project.md)

## 概要

Hieronymusは零細企業用のERPシステムです。

現在のところ

* 会計
  * 基本的な会計機能(財務会計)
  * 新電帳法対応の証票管理機能
* 顧客管理
  * 取引先情報の基本的な管理
  * 案件管理
  * 見積/請求/営業活動

が実装されています。

