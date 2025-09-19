# TODO

## バグ

* 振替伝票作成時、サーバでエラーが発見された時の通知をする

## リファクタリング

気がついたら直すこと

* `User`, `Member`を使う時には余分なものを取得しない
```
      {
        model: models.User,
        as: 'handleUser',
        attributes: ['name'],
        include: [
          {
            model: models.Member,
            as: 'member',
            attributes: ['legalName', 'tradingName']
          }
        ]
      }
```

## TODO

* svelte5対応
* 品目一覧にサムネ
* beforeUpdateとonMountを最適化する
* APIにも権限管理を入れる
* 付箋機能
* 部門管理
* 公益法人(宗教法人)対応
* 家計簿対応
* 決算月(13ヶ月目)対応 → フラグにする(末日を指定した時に、どっちかを指定する)
* マルチテナント管理

## DONE

* 税込会計の時に消費税欄を消す
* バックアップ
* webpack廃止
* 初期科目の最適化
* 個人事業主 フリーランス対応
* 切り上げ切り捨ては指定可能にする
* 自社情報
* 見積り請求等の税金処理を正しくする
* `term`は極力`req.session.term`を使うべきである(パラメータにしない)
* 伝票の日付の「年」は月から自動で求める
* 証憑一覧あたりの遷移と状態
