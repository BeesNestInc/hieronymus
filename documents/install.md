# インストール方法

Hieronymusは2つのインストール方法を提供しています。

* ソースコードからインストール
* Dockerを使用したインストール

## ソースコードからインストール

HieronymusはDBにPostgresを使用します。あらかじめインストールしてからHieronymusのインストールを行ってください。

1. ソースコードの取得
Releaseよりダウンロードしてください。

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

## Dockerを使用したインストール
### 最新版
```
$ git clone https://github.com/beesnestinc/hieronymus.git
$ cd hieronymus
$ docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```
しばらくすると、3010番ポートから利用を開始できます。

### バージョン指定
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
