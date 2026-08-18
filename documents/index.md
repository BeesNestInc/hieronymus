# Hieronymusマニュアル
![Hieronymuslogo](./images/github-logo.png)

## はじめに
Hieronymusは、中小企業、スタートアップ、個人事業主の皆様のビジネスを加速する、シンプルでパワフルなERPシステムで、会計、顧客管理、証憑管理といった基幹業務を効率化し、日々の運用を強力にサポートします。

弊社の業務で必要となった機能を中心に開発しており、**現在実戦投入中**のシステムです。

現在のところ

* 会計
  * 基本的な会計機能(財務会計)
  * 新電帳法対応の証憑管理機能
* 顧客管理
  * 取引先情報の基本的な管理
  * 案件管理
  * 見積/請求/営業活動

が実装されています。

## Hieronymusの主な特徴

*   **統合会計**: 財務会計の基本機能に加え、新電帳法に対応した証憑管理機能を統合。日々の取引から決算までを一元的にサポートします。
*   **税理士との連携を強化**: 多くのクラウド会計システムが排除しがちな「振替伝票」を会計処理の核とすることで、会計の専門家である税理士とのスムーズなコミュニケーションを実現します。一見とっつきにくいかもしれませんが、会計の基本に忠実な設計が、正確で信頼性の高い経理業務を支えます。
*   **柔軟な顧客管理**: 取引先情報の管理から、案件の進捗、見積・請求書の発行、営業活動の記録まで、顧客との関係を多角的に管理します。
*   **業務効率化**: 伝票入力の簡素化、自動計算機能、PDF出力など、日々の業務を効率化する機能が満載です。
*   **データの一元管理**: 会計データと顧客データを連携させ、ビジネス全体の状況をリアルタイムで把握できます。

## マニュアル目次

### クイックスタート
* [インストール](install.md)
  * [ソースコードからインストール](install.md#from_source)
  * [Dockerを使用したインストール](install.md#from_docker)
* [ユーザの登録](user.md)
* [運用環境の設定](initial.md)
  * [初期セットアップ](initial.md#intial)
  * [勘定科目の設定](initial.md#accounts)

### 基本操作
* [仕訳明細の入力](crossslip.md)
  * [ワークフロー別](crossslip.md#workflow)
    * [仕訳明細から](crossslip.md#仕訳明細入力から始めるパターン)
    * [証憑入力から](crossslip.md#証憑入力から始めるパターン)
* 帳票の出力
  * [財務諸表等](report.md)
  * [取引文書の作成と出力](evidence.md)
* [年度設定と繰越処理](fiscal-year.md)
* [消費税の扱い](consumption-tax.md)

### 会計
* [仕訳明細の入力](crossslip.md)
  * [ワークフロー別](crossslip.md#workflow)
    * [仕訳明細から](crossslip.md#仕訳明細入力から始めるパターン)
    * [証憑入力から](crossslip.md#証憑入力から始めるパターン)
* [証憑管理](voucher.md)
* [元帳の確認](ledger.md)
* [残高試算表](trial-balance.md)
* [勘定科目管理](account.md)

### 集計
* [推移表](changes.md)
* [プロジェクト管理](project.md)
* [会計帳票の出力](report.md)
  * [出力形式と操作](report.md#operation)
  * [主要な会計帳票](report.md#reports)
    * [仕訳日記帳](report.md#journal)
    * [総勘定元帳](report.md#general_ledger)
    * [補助元帳](report.md#subsidiary_ledger)
    * [試算表](report.md#trial_balance)
    * [決算報告書](report.md#financial_statements)
### 顧客管理
* [取引先管理](company.md)
* [案件管理](task.md)
* [取引管理](transaction.md)
* [品目管理](item.md)
* [取引文書](evidence.md)

### 人事
* [ユーザーの登録と管理](user.md)
* [役職員管理](member.md)

### その他
* [メニューの作成](menu.md)
* [消費税の扱い](consumption-tax.md)
* [年度設定と繰越処理](fiscal-year.md)

### AI連携
* [AIによる伝票入力（MCP・スキル）](ai-integration.md)
