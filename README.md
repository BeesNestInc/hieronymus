# Hieronymus
![Hieronymuslogo](documents/images/github-logo.png)

Hieronymusは零細企業用のERPシステムです。

現在のところ

* 基本的な会計機能(財務会計)
* 取引先の基本的な管理機能
* 新電帳法対応の証票管理機能

が実装されています。

## インストール方法

Hieronymusは2つのインストール方法を提供しています。

* ソースコードからインストール
* Dockerを使用したインストール

### ソースコードからインストール

HieronymusはDBにPostgresを使用します。あらかじめインストールしてからHieronymusのインストールを行ってください。

1. ソースコードの取得
```
$ git clone https://github.com/beesnestinc/hieronymus.git
```
2. 設定ファイルの作成
```
$ cd hieronymus
$ cp config/config.json.sample config/config.json
```
config/config.jsonはDBの接続情報です。usernameやpassword等自身の環境に合わせて編集してください。

3. セットアップ

```
$ npm install
$ sudo npx playwright install --with-deps
$ npx playwright install
$ npm run build
$ npm run build-ssr
$ export NODE_ENV=production
$ npx sequelize-cli db:create
$ npx sequelize-cli db:migrate
$ mkdir backups
```
4. 起動
```
$ npm run start
```
デフォルトでは3010番ポートで動きます。

### Dockerを使用したインストール
#### 最新版
```
$ git clone https://github.com/beesnestinc/hieronymus.git
$ cd hieronymus
$ docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```
しばらくすると、3010番ポートから利用を開始できます。

#### バージョン指定
```
$ git clone https://github.com/beesnestinc/hieronymus.git
$ cd hieronymus
$ cp .env.example .env # DOCKER_IMAGE_VERSION=[バージョン]に変更
$ docker compose -f docker/docker-compose.yml  up -d
```
しばらくすると、3010番ポートから利用を開始できます。

### v1 バージョンからの移行

v1 バージョンまではCommonJSで書かれていましたが、今バージョンからはEcmaScript Moduleで書かれています。そのため、migrationのファイル名が変わってしまい、うまくmigrationがかかりません。そこで、**migrationをかける前に**データベースの整合を取るために以下のSQL文を走らせてください。

```
$ psql <データベースの指定>

# update "SequelizeMeta" set name = REPLACE(name, '.js', '.cjs');
# \q
```

これは、マイグレーションの管理テーブル(`SequelizeMeta`)を直接操作して、現状のデータベースとmigrationファイルの名前を一致させています。よく意味のわからない人は、**おまじない**くらいに思ってください。

この後に

```
$ npx sequelize-cli db:migrate
```

と入力し、データベースをアプリに合わせるようにしてください。

この処理は破壊的なので、作業の前には必ずバックアップを取ってからしてください。

## 使い方

初期アカウント等は設定されていません。
初期ログインの時に自分でユーザ登録を行ってから使って下さい。

ログイン後、ホーム画面上の自社情報より自社情報を作成してください。

## 機能

### 仕訳日記帳
伝票入力等の基本画面です。  
入力した伝票の閲覧、伝票の入力(修正)が可能です。

![仕訳日記帳](documents/images/仕訳日記帳.png)

伝票入力時に、貸方の金額については以下の省略入力ができます。
これにより、入力の手間を省くと共に入力間違いを減らすことができます。

* `=` 借方と同じ金額が貸方に入ります
* `-` 貸方の合計と借方の合計との差額が貸方に入ります

いずれも既に入力した値が正しくなければ、その伝票は整合性を持って間違えてしまいます。
これはエラーチェックが1つ減るという意味なので、両刃の剣であることに注意して使って下さい。

### 元帳
総勘定元帳と補助元帳が複合した画面です。  
科目及び補助科目毎の明細が表示されます。  
ここから直接伝票を修正することも可能です(新規入力はできません)。

![元帳](documents/images/元帳.png)

### 銀行元帳

基本的には元帳画面と同じですが、預金通帳を模した表示となっています。  
主には会計データと預金通帳の整合を確認するためのものです。

![銀行勘定帳](documents/images/銀行勘定帳.png)

### 残高試算表

残高試算表が確認できます。

![残高試算表](documents/images/残高試算表.png)

### 取引先管理

会計システムに出現する取引先を登録します。  
この情報は、次の**証票管理**で使われます。  
将来的には、CRM機能として発展させる予定です。

![取引先管理](documents/images/取引先管理.png)

### 証票管理

電子化証票を登録できます。  
ここで登録した証票は、伝票入力の時に結合させることができます。
伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。

![証票管理](documents/images/証票管理.png)

### 勘定科目管理

勘定科目を追加変更ができます。「削除」はできません。

![勘定科目管理](documents/images/勘定科目管理.png)

## その他

プルリク待ってますｗ
