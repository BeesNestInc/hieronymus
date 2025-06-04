module.exports = [
  {
    title: '白紙のメニュー',
    menu: []
  }, {
    title: 'ホーム',
    menu: [
      {
        "id": "1",
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 29,
        "minimize": false,
        "component": "SelectTerm",
        "options": {
            "title": "年度選択"
        }
      }, {
        "id": "2",
        "x": 6,
        "y": 0,
        "w": 3,
        "h": 29,
        "minimize": false,
        "component": "FormPrint",
        "options": {
            "title": "帳票出力"
        }
      },{
        "id": "3",
        "x": 9,
        "y": 0,
        "w": 3,
        "h": 29,
        "minimize": false,
        "component": "Backup",
        "options": {
            "title": "バックアップ"
        }
      },{
        "id": "4",
        "x": 6,
        "y": 30,
        "w": 6,
        "h": 25,
        "minimize": false,
        "component": "Approve",
        "options": {
            "title": "承認待ち"
        }
      },{
        "id": "5",
        "x": 0,
        "y": 30,
        "w": 4,
        "h": 25,
        "minimize": false,
        "component": "Password",
        "options": {
            "title": "パスワード変更"
        }
      }
    ]
  },{
    title: '会計メニュー',
    menu: [
      {
        "id": "1",
        "x": 0,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "仕訳日記帳",
          "name": "journal",
          "href": "/journal",
          "description": "\n  伝票入力等の基本画面です。<br/>\n  入力した伝票の閲覧、伝票の入力(修正)が可能です。"
        }
      },
      {
        "id": "2",
        "x": 3,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "元帳",
          "name": "ledger",
          "href": "/ledger/1000000",
          "description": "<p>総勘定元帳と補助元帳が複合した画面です。<br>科目及び補助科目毎の明細が表示されます。<br>ここから直接伝票を修正することも可能です。</p>"
        }
      },
      {
        "id": "3",
        "x": 6,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "銀行元帳",
          "name": "bank-ledger",
          "href": "/bank-ledger",
          "description": "<p>基本的には元帳画面と同じですが、預金通帳を模した表示となっています。<br>会計データと預金通帳の整合を確認するためのものです。</p>"
        }
      },
      {
        "id": "4",
        "x": 0,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "残高試算表",
          "name": "trial-balance",
          "href": "/trial-balance",
          "description": "残高試算表が確認できます。"
        }
      },
      {
        "id": "5",
        "x": 3,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "推移表",
          "name": "changes",
          "href": "/changes/6000000",
          "description": "\n科目毎の月次集計の推移をグラフ表示します。<br/>\n年度内だけではなく、前年同月比較や通年表示もできます。"
        }
      },
      {
        "id": "6",
        "x": 0,
        "y": 38,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/company/?kind=2",
          "title": "取引先管理:国内購買先",
          "name": "company",
          "description": "<p>取引先のうち、国内の購買先です。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "7",
        "x": 3,
        "y": 38,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/company/?kind=6",
          "title": "取引先管理:国内顧客",
          "name": "company",
          "description": "<p>取引先のうち、国内顧客です。<br>顧客管理システムでも使います。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "8",
        "x": 0,
        "y": 57,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/voucher?type=1",
          "title": "受取請求書",
          "name": "voucher",
          "description": "<p>電子化証憑のうち、受取請求書の管理を行います。<br>伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "9",
        "x": 3,
        "y": 57,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/voucher?type=2",
          "title": "受取領収書",
          "name": "voucher",
          "description": "<p>電子化証憑のうち、受取領収書の管理を行います。<br>伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "10",
        "x": 6,
        "y": 57,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/voucher?type=3",
          "title": "差出請求書",
          "name": "voucher",
          "description": "<p>電子化証憑のうち、差出請求書の管理を行います。<br>伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "11",
        "x": 9,
        "y": 57,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/voucher?type=4",
          "title": "差出領収書",
          "name": "voucher",
          "description": "<p>電子化証憑のうち、差出領収書の管理を行います。<br>伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "12",
        "x": 0,
        "y": 76,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "勘定科目管理",
          "name": "accounts",
          "href": "/accounts",
          "description": "\n勘定科目を追加変更ができます。<br/>\nなお「削除」はできません。"
        }
      }
    ]
  }, {
    title: '顧客管理',
    menu: [
      {
        "id": "1",
        "x": 0,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/company/?kind=6",
          "title": "顧客管理(国内)",
          "name": "company",
          "description": "<p>国内の顧客を管理します。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "2",
        "x": 3,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "Bookmark",
        "options": {
          "href": "/company/?kind=7",
          "title": "顧客管理(海外)",
          "name": "company",
          "description": "<p>海外の顧客を管理します。</p>"
        },
        "isEditMode": false
      },
      {
        "id": "3",
        "x": 0,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "案件管理",
          "name": "task",
          "href": "/task/",
          "description": "\n顧客取引の「案件」を管理します。<br/>\n見積請求等の取引や各種文書の管理等は、案件を単位に行います。"
        }
      },
      {
        "id": "4",
        "x": 3,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "取引管理",
          "name": "transaction",
          "href": "/transaction/",
          "description": "\n顧客との「取引」を管理します。<br/>\n見積請求だけではなく、各種文書の管理や経費記録等を行います。"
        }
      },
      {
        "id": "5",
        "x": 6,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "品目管理",
          "name": "item",
          "href": "/item/",
          "description": "<p>取引品目の管理を行います。<br>物品のような有形物だけではなく、サービス等の無形物も扱えます。</p>"
        }
      }
    ]
  }, {
    title: '人事管理',
    menu: [
      {
        "id": "1",
        "x": 0,
        "y": 0,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "ユーザ管理",
          "name": "users",
          "href": "/users/",
          "description": "\n本システムの利用者アカウントの管理です。<br/>\n操作権限の設定も可能です。"
        }
      },
      {
        "id": "2",
        "x": 0,
        "y": 19,
        "w": 3,
        "h": 18,
        "minimize": false,
        "component": "MenuLink",
        "options": {
          "title": "役職員管理",
          "name": "member",
          "href": "/member/",
          "description": "\n人事情報を入力します。<br/>\n現在は担当者名の情報源として使っているだけですが、将来的には人事給与システムが付加されます。"
        }
      }
    ]
  }, {
    title: 'システム管理',
    menu: [
      {
        "id":"1",
        "x":7,
        "y":0,
        "w":4,
        "h":26,
        "minimize":false,
        "component":"Backup",
        "options":{
          "title":"バックアップ"
        }
      },{
        "id":"2",
        "x":0,
        "y":41,
        "w":6,
        "h":40,
        "minimize":false,
        "component":"CompanyKinds",
        "options":{
          "title":"取引先種別"
        }
      },{
        "id":"3",
        "x":0,
        "y":0,
        "w":7,
        "h":40,
        "minimize":false,
        "component":"TransactionKinds",
        "options":{
          "title":"取引文書種別"
        }
      },{
        "id":"4",
        "x":0,
        "y":82,
        "w":6,
        "h":40,
        "minimize":false,
        "component":"VoucherClasses",
        "options":{
          "title":"証憑種別"
        }
      },{
        "id":"5",
        "x":6,
        "y":41,
        "w":6,
        "h":40,
        "minimize":false,
        "component":"ItemClasses",
        "options":{
          "title":"品目種別"
        }
      }
    ]
  }
]
