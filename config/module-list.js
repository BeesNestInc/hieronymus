export default [
  {
    name: 'menu',
    title: 'マイページ',
    match: /^\/menu/,
  }, {
    // ---- 日々の作業: 毎日〜頻繁に触る入力・取込 ----
    name: 'journal',
    section: 'daily',
    title: '仕訳日記帳',
    match: /^\/journal/,
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    href: (status) => {
      // 年度未選択のときは決め打ちのURLに飛ばさない（ホームで選択させる）
      if ( !status.fy || !status.fy.startDate ) {
        return '/home';
      }
      return	(`/journal/${status.fy.startDate.getFullYear()}/${status.fy.startDate.getMonth()+1}`);
    },
    icon: { name: 'bi:calendar3'},
    description: `
  伝票入力等の基本画面です。<br/>
  入力した伝票の閲覧、伝票の入力(修正)が可能です。`
  }, {
    name: 'bank',
    section: 'daily',
    title: '通帳',
    match: /^\/bank-ledger|^\/bank-statement/,
    href: (status) => {
      return	(`/bank-ledger`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing );
    },
    icon: { name: 'bi:bank' },
    description: `
通帳（銀行・カード・計算書）など、外部の帳簿を扱う画面です。<br/>
預金通帳を模した「通帳元帳」と、通帳・カード・計算書の一覧と取込を行う「通帳一覧」があります。`,
    submenu: [
      {
        name: 'bank-ledger',
        title: '通帳元帳',
        href: (status) => {
          return	(`/bank-ledger`);
        },
        match: /^\/bank-ledger/,
      }, {
        name: 'bank-statement',
        title: '通帳一覧',
        href: (status) => {
          return	(`/bank-statement`);
        },
        match: /^\/bank-statement/,
      }
    ]
  }, {
    name: 'voucher',
    section: 'daily',
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
    name: 'schedule',
    section: 'daily',
    title: '予定表',
    match: /^\/schedule/,
    href: (status) => {
      return	(`/schedule`);
    },
    authority: (user) => {
      return ( user.accounting || user.fiscalBrowsing || user.administrable );
    },
    icon: { name: 'bi:calendar-week' },
    description: `
月々の決まった入出金や、資金繰りに影響する入出金の予定を管理します。<br/>
予定はICSフィードとして配信され、Googleカレンダーやグループウェアから購読できます。`
  }, {
    // ---- 経費精算: 独立セクション（旧サブメニューをフラット化） ----
    name: 'expense',
    section: 'expense',
    title: '経費精算',
    match: /^\/expense\/($|entry|new)/,
    href: (status) => {
      return	(`/expense/`);
    },
    authority: (user) => {
      return  true;
    },
    icon: { name: 'bi:wallet2' },
    description: `
経費精算書の入力・提出を行います。<br/>
領収書等の証憑を添付して提出すると、承認後に仕訳伝票が起票されます。`
  }, {
    name: 'expense-unsorted',
    section: 'expense',
    title: '未整理の証憑',
    match: /^\/expense\/unsorted/,
    href: (status) => {
      return	(`/expense/unsorted`);
    },
    authority: (user) => {
      return  true;
    },
    description: `
未整理の証憑の認識・管理を行います。`
  }, {
    name: 'expense-payee',
    section: 'expense',
    title: '支払先マッピング',
    match: /^\/expense\/payee/,
    href: (status) => {
      return	(`/expense/payee`);
    },
    authority: (user) => {
      return  true;
    },
    description: `
精算書の説明から支払先を決めるマッピングを管理します。`
  }, {
    name: 'expense-payment',
    section: 'expense',
    title: '出金元マッピング',
    match: /^\/expense\/payment/,
    href: (status) => {
      return	(`/expense/payment`);
    },
    authority: (user) => {
      return  true;
    },
    description: `
精算の支払い資金を決める出金元マッピングを管理します。`
  }, {
    name: 'karibarai',
    section: 'expense',
    title: '立替精算',
    href: (status) => {
      return	(`/karibarai`);
    },
    match: /^\/karibarai/,
    authority: (user) => {
      return  ( user.accounting );
    },
    description: `
立替者別の精算額を表示し、精算の伝票を起票します。<br/>
精算対象科目は立替フラグ付き出金元マッピングの勘定科目から決まります。<br/>
精算額は正なら立替者が返してもらえる額、負なら会社が受け取る額です。<br/>
精算の向き（返す/もらう）は精算額の符号から自動的に決まります。`
  }, {
    // ---- 確認・帳票: 見る・確かめる ----
    name: 'ledger',
    section: 'reports',
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
    name: 'trial-balance',
    section: 'reports',
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
    section: 'reports',
    title: '推移表',
    match: /^\/changes/,
    href: (status) => {
      // 年度未選択のときは決め打ちのURLに飛ばさない（ホームで選択させる）
      if ( !status.fy || !status.fy.term ) {
        return '/home';
      }
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
    // ---- 顧客・案件: CRM系 ----
    name: 'company',
    section: 'crm',
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
    section: 'crm',
    title: '案件管理',
    href: (status) => {
      return	(`/task/`);
    },
    authority: (user) => {
      return  (user.companyManagement);
    },
    icon: { name: 'bi-folder2-open'},
    match: /^\/task/,
    description: `
顧客取引の「案件」を管理します。<br/>
見積請求等の取引や各種文書の管理等は、案件を単位に行います。`
  }, {
    name: 'transaction',
    section: 'crm',
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
    name: 'project',
    section: 'crm',
    title: 'プロジェクト管理',
    href: (status) => {
      return	(`/project/`);
    },
    match: /^\/project/,
    authority: (user, company) => {
      if (!company) return false;
      return  (company.useProjectAccounting && (user.companyManagement || user.accounting));
    },
    icon: { name: 'bi:diagram-3' },
    description: `
会計の部門計算や、案件の原価計算に用いる「プロジェクト」を管理します。`,
    submenu: [
      {
        title: 'プロジェクト管理',
        href: (status) => {
          return	(`/project/`);
        },
        match: /^\/project\/($|entry|new|settings)/,
      },
      {
        title: '集計用ラベル管理',
        match: /^\/project\/labels/,
        href: (status) => {
          return	(`/project/labels`);
        }
      },
      {
        title: 'プロジェクト集計',
        match: /^\/project\/summary/,
        href: (status) => {
          return	(`/project/summary`);
        }
      }
    ]
  }, {
    // ---- マスタ: 設定後にあまり触らない ----
    name: 'accounts',
    section: 'master',
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
    name: 'item',
    section: 'master',
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
    // 取引先は支払先としても使うため、マスタ側からも同じページへ
    // リンクする（submenuを持たない単純リンク）。アクティブ強調は
    // 顧客・案件側だけにするため match は実在しないパスにしておく
    name: 'company-master',
    section: 'master',
    title: '取引先管理',
    match: /^\/company\/master$/,
    href: (status) => {
      return	(`/company/`);
    },
    authority: (user) => {
      return  (user.companyManagement || user.accounting);
    },
    description: `
取引先管理へのショートカット（マスタとしての取引先管理）。`
  }, {
    name: 'member',
    section: 'master',
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
現在は担当者名の情報源として使っているだけですが、将来的には人事給与システムが付加されます。`,
    submenu: [
      {
        title: '役職員管理',
        href: (status) => {
          return	(`/member/`);
        },
        match: /^\/member\/($|entry|new)/,
      }, {
        title: '設定',
        match: /^\/member\/home/,
        href: (status) => {
          return	(`/member/home`);
        }
      }
    ]
  }, {
    // ---- 管理: 管理者向け ----
    name: 'users',
    section: 'admin',
    title: 'ユーザ管理',
    authority: (user) => {
      return  (user.administrable);
    },
    href: (status) => {
      return	('/users/');
    },
    match: /^\/users/,
    icon: { name: 'bi:people' },
    description: `
本システムの利用者アカウントの管理です。<br/>
操作権限の設定も可能です。`
  }
];
