# インストール方法

Hieronymusは2つのインストール方法を提供しています。

* ソースコードからインストール
* Dockerを使用したインストール

## ソースコードからインストール

HieronymusはDBにPostgresを使用します。あらかじめインストールしてからHieronymusのインストールを行ってください。

1. **ソースコードの取得**

   [GitHubのReleaseページ](https://github.com/beesnestinc/hieronymus/releases)より最新版のソースコード（`Source code (zip)` または `Source code (tar.gz)`）をダウンロードし、展開します。

2. **設定ファイルの作成**

   ソースコードを展開したディレクトリに移動し、設定ファイルをコピーします。
   ```sh
   $ cd hieronymus-x.x.x
   $ cp config/config.json.sample config/config.json
   ```
   `config/config.json` を開き、ご自身のデータベース環境に合わせて`username`や`password`等を編集してください。

3. **セットアップ**

   ```sh
   # 依存パッケージをインストール
   $ npm install

   # Playwright（ブラウザ操作ライブラリ）のセットアップ
   $ npx playwright install --with-deps
   # ※環境によっては sudo が必要になる場合があります。

   # アプリケーションのビルド
   $ npm run build
   $ npm run build-ssr

   # データベースの作成とマイグレーション
   $ NODE_ENV=production npx sequelize-cli db:create
   $ NODE_ENV=production npx sequelize-cli db:migrate

   # バックアップ用ディレクトリの作成
   $ mkdir backups
   # 帳票などのバックアップファイルが保存されるディレクトリです。
   ```

4. **起動**
   ```sh
   $ npm run start
   ```
   デフォルトでは `http://localhost:3010` で起動します。

## Dockerを使用したインストール

### 最新版をインストールする場合

常に最新版（`latest`タグ）のイメージを利用して起動する方法です。

```sh
$ git clone https://github.com/beesnestinc/hieronymus.git
$ cd hieronymus
$ docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```
`docker-compose.override.yml` がイメージを `latest` に指定するため、常に最新のイメージをプルして起動します。
しばらくすると、`http://localhost:3010` から利用を開始できます。

### 特定のバージョンをインストールする場合

リリースされている特定のバージョンを指定して起動する方法です。

```sh
$ git clone https://github.com/beesnestinc/hieronymus.git
$ cd hieronymus
$ cp .env.example .env
```
コピーして作成した `.env` ファイルを開き、`DOCKER_IMAGE_VERSION` をインストールしたいバージョン（例: `v2.1.0`）に変更します。
```
DOCKER_IMAGE_VERSION=v2.1.0
```

その後、`override.yml` を**含めずに**以下のコマンドを実行します。

```sh
$ docker compose -f docker/docker-compose.yml up -d
```
しばらくすると、`http://localhost:3010` から利用を開始できます。

### v1バージョンからの移行

v1バージョンまではCommonJSで書かれていましたが、v2以降はEcmaScript Moduleで書かれています。
この変更に伴い、データベースのマイグレーション管理ファイルの形式が `.js` から `.cjs` に変更されました。

v1からv2以降にアップデートする際は、**新しいバージョンのコンテナを起動する前に**、データベースの整合性を取るために以下のSQL文を実行する必要があります。

作業の前には、**必ず `pg_dump` コマンドなどでデータベースのバックアップを取得してください。**

```sh
# psqlでデータベースに接続します
$ psql -U <ユーザー名> -d <データベース名>

# 以下のSQLを実行して、マイグレーション履歴のファイル名を更新します
=> update "SequelizeMeta" set name = REPLACE(name, '.js', '.cjs');
UPDATE XX

# psqlを終了します
=> \q
```

上記の `UPDATE XX` の `XX` には更新された行数が表示されます。
この作業により、過去のマイグレーション履歴が新しいファイル形式名に更新され、v2以降のマイグレーションが正しく適用されるようになります。

SQLの実行後、新しいバージョンのコンテナを起動してください。
コンテナ起動時に、新しいマイグレーションが自動的に適用されます。