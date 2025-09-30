export default [
  {
    name: 'menu',
    match: /^\/menu/,
  }, {
    name: 'journal',
    title: '仕訳日記帳',
    match: /^\/journal/,
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    href: (status) => {
      return	(`/journal/${status.fy.startDate.getFullYear()}/${status.fy.startDate.getMonth()+1}`);
    },
    icon: { name: 'bi:calendar3'},
    description: `
  伝票入力等の基本画面です。<br/>
  入力した伝票の閲覧、伝票の入力(修正)が可能です。`
  }, {
    name: 'ledger',
    title: '元帳',
    match: /^\/ledger/,
    href: (status) => {
      return	(`/ledger/1000000`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi-journal-text' },
    description: `
総勘定元帳と補助元帳が複合した画面です。<br/>
科目及び補助科目毎の明細が表示されます。<br/>
ここから直接伝票を修正することも可能です(新規入力はできません)。`
  }, {
    name: 'bank-ledger',
    title: '銀行元帳',
    match: /^\/bank-ledger/,
    href: (status) => {
      return	(`/bank-ledger`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi:bank' },
    description: `
基本的には元帳画面と同じですが、預金通帳を模した表示となっています。<br/>
主には会計データと預金通帳の整合を確認するためのものです。`
  }, {
    name: 'trial-balance',
    title: '残高試算表',
    match: /^\/trial-balance/,
    href: (status) => {
      return	(`/trial-balance`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi-table' },
    description: `残高試算表が確認できます。`
  }, {
    name: 'changes',
    title: '推移表',
    match: /^\/changes/,
    href: (status) => {
      return	(`/changes/${status.fy.term}/6000000`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi-bar-chart-fill' },
    description: `
科目毎の月次集計の推移をグラフ表示します。<br/>
年度内だけではなく、前年同月比較や通年表示もできます。`
  }, {
    name: 'voucher',
    title: '証憑管理',
    match: /^\/voucher/,
    href: (status) => {
      return	(`/voucher`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi:archive-fill' },
    description: `
電子化証票を登録できます。<br/>
ここで登録した証票は、伝票入力の時に結合させることができます。 <br/>
伝票に証票が結合された場合、伝票明細が表示される画面で参照(ダウンロード)が可能になります。
`
	}, {
    name: 'accounts',
    title: '勘定科目管理',
    match: /^\/accounts/,
    href: (status) => {
      return	(`/accounts`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi:tag' },
    description: `
勘定科目を追加変更ができます。<br/>
なお「削除」はできません。`
  }, {
    name: 'company',
    title: '取引先管理',
    match: /^\/company/,
    authority: (user) => {
      return  (user.companyManagement || user.accounting);
    },
    icon: { name: 'bi-building'},
    href: (status) => {
      return	(`/company/`);
    },
    description: `
このシステムで扱う取引先を登録管理します。<br/>
「取引先」は会計上の取引だけではなく、顧客管理での「顧客」等も含まれます。`,
    submenu: [
      {
        title: '取引先管理',
        match: /^\/company\/($|entry|new)/,
        href: (status) => {
          return	(`/company/`);
        },
      }, {
        title: '設定',
        match: /^\/company\/home/,
        href: (status) => {
          return	(`/company/home`);
        },
      }
    ]
  }, {
    name: 'task',
    title: '案件管理',
    href: (status) => {
      return	(`/task/`);
    },
    authority: (user) => {
      //console.log(user);
      return  (user.companyManagement);
    },
    icon: { name: 'bi-folder2-open'},
    match: /^\/task/,
    description: `
顧客取引の「案件」を管理します。<br/>
見積請求等の取引や各種文書の管理等は、案件を単位に行います。`
  }, {
    name: 'transaction',
    title: '取引管理',
    match: /^\/transaction/,
    href: (status) => {
      return	(`/transaction/`);
    },
    authority: (user) => {
      return  (user.companyManagement);
    },
    icon: { name: 'bi-file-earmark-text-fill'},
    description: `
顧客との「取引」を管理します。<br/>
見積請求だけではなく、各種文書の管理や経費記録等を行います。`
  }, {
    name: 'item',
    title: '品目管理',
    href: (status) => {
      return	(`/item/`);
    },
    match: /^\/item/,
    authority: (user) => {
      return  (user.companyManagement || user.accounting);
    },
    icon: { name: 'bi:shop' },
    description: `
このシステムで扱う「品(item)」を管理します。<br/>
有形の商品だけではなく無形の商品(作業)もここで登録します。`,
    submenu: [
      {
        title: '品目管理',
        href: (status) => {
          return	(`/item/`);
        },
        match: /^\/item\/($|entry|new)/,
      }, {
        title: '設定',
        match: /^\/item\/home/,
        href: (status) => {
          return	(`/item/home`);
        }
      }
    ]
  }, {
    name: 'users',
    title: 'ユーザ管理',
    authority: (user) => {
      return  (user.administrable || user.personnelManagement);
    },
    href: (status) => {
      return	('/users/');
    },
    match: /^\/users/,
    icon: { name: 'bi:people' },
    description: `
本システムの利用者アカウントの管理です。<br/>
操作権限の設定も可能です。`
  }, {
    name: 'member',
    title: '役職員管理',
    authority: (user) => {
      return  (user.administrable || user.personnelManagement);
    },
    href: (status) => {
      return	('/member/');
    },
    match: /^\/member/,
    icon: { name: 'bi:person-square' },
    description: `
人事情報を入力します。<br/>
現在は担当者名の情報源として使っているだけですが、将来的には人事給与システムが付加されます。`
  }
];
