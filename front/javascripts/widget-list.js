import Approve from '../svelte/widgets/approve.svelte';
import ExpenseApprove from '../svelte/widgets/expense-approve.svelte';
import StickyMemo from '../svelte/widgets/sticky-memo.svelte';
import Backup from '../svelte/widgets/backup.svelte';
import Bookmark,{ create as createBookmark, activate as activateBookmark } from '../svelte/widgets/bookmark.svelte';
import CompanyKinds from '../svelte/widgets/company-kinds.svelte';
import FormPrint from '../svelte/widgets/form-print.svelte';
import HTMLPanel from '../svelte/widgets/html-panel.svelte';
import ItemClasses from '../svelte/widgets/item-classes.svelte';
import MemberClasses from '../svelte/widgets/member-classes.svelte';
import MenuLink,{ create as createMenuLink, activate as activateMenuLink } from '../svelte/widgets/menu-link.svelte';
import Password from '../svelte/widgets/password.svelte';
import SelectTerm from '../svelte/widgets/term.svelte';
import TransactionKinds from '../svelte/widgets/transaction-kinds.svelte';
import VoucherClasses from '../svelte/widgets/voucher-classes.svelte';

export const componentList = [
    {
      name: 'Approve',
      title: '承認待ち',
      defaultW: 5,
      defaultH: 23,
      authority: (user, options) => {
        return  (user.approvable);
      },
      component: Approve
    }, {
      name: 'ExpenseApprove',
      title: '経費精算の承認待ち',
      defaultW: 5,
      defaultH: 23,
      authority: (user, options) => {
        return  (user.approvable);
      },
      component: ExpenseApprove
    }, {
      name: 'Backup',
      title: 'バックアップ',
      defaultW: 4,
      defaultH: 23,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: Backup
    }, {
      name: 'FormPrint',
      title: '帳票出力',
      defaultW: 3,
      defaultH: 29,
      authority: (user, options) => {
        return  ( user.accounting || user.fiscal_browsing );
      },
      component: FormPrint
    }, {
      name: 'Password',
      title: 'パスワード変更',
      defaultW: 4,
      defaultH: 29,
      component: Password
    }, {
      name: 'SelectTerm',
      title: '年度選択',
      defaultW: 6,
      defaultH: 29,
      component: SelectTerm
    }, {
      name: 'CompanyKinds',
      title: '取引先種別',
      defaultW: 6,
      defaultH: 40,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: CompanyKinds,
    }, {
      name: 'TransactionKinds',
      title: '取引文書種別',
      defaultW: 6,
      defaultH: 40,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: TransactionKinds,
    }, {
      name: 'VoucherClasses',
      title: '証憑種別',
      defaultW: 6,
      defaultH: 40,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: VoucherClasses,
    }, {
      name: 'ItemClasses',
      title: '品目種別',
      defaultW: 6,
      defaultH: 40,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: ItemClasses,
    }, {
      name: 'MemberClasses',
      title: '役職員種別',
      defaultW: 6,
      defaultH: 40,
      authority: (user, options) => {
        return  (user.administrable);
      },
      component: MemberClasses,
    }, {
      name: 'HTMLPanel',
      title: '自由記述',
      defaultW: 6,
      defaultH: 40,
      component: HTMLPanel,
    }, {
      name: 'StickyMemo',
      title: '付箋メモ',
      defaultW: 4,
      defaultH: 25,
      component: StickyMemo,
    }, {
      name: 'MenuLink',
      defaultW: 3,
      defaultH: 23,
      authority: (user, options) => {
        console.log({options});
        return  (options.authority(user));
      },
      component: MenuLink,
      create: createMenuLink,
      activate: activateMenuLink
    }, {
      name: 'Bookmark',
      defaultW: 4,
      defaultH: 40,
      authority: (user, options) => {
        console.log({options});
        return  (options.authority(user));
      },
      component: Bookmark,
      create: createBookmark,
      activate: activateBookmark
    }
  ];

// ウィジェットの活性化（component の解決と activate による options の補完）。
// menuページ（配置の保存/読み込み）とグリッドコンポーネントの双方から使う。
// 呼び出し側で state を持たせないため、引数と対象オブジェクトだけを見る
export const activateWidgets = (widgets, status) => {
  for ( let widget of widgets || [] ) {
    if ( !widget._component ) {
      const component = findComponent(widget.component);
      if ( component.activate ) {
        component.activate(widget.options, status);
      }
      widget._component = component.component;
    }
  }
};

export const findComponent = (name) => {
  return  componentList.find((ent) => {
    return (ent.name === name);
  })
}