// ページ（画面コンポーネント）の対応表。
// - サイドバー/サーバ側の権限解決（name/match/href/authority）は config/module-list.js
// - 画面本体の対応（name → component）はこのファイル
// 新しいページを追加するときは module-list.js に項目を足し、ここで
// 同じ name の対応を書くこと（submenuのページは submenu 側に name を足す）
import Home from '../svelte/home/home.svelte';
import Menu from '../svelte/menu/menu.svelte';
import Journal from '../svelte/journal/journal.svelte';
import SlipPage from '../svelte/cross-slip/slip-page.svelte';
import Ledger from '../svelte/ledger/ledger.svelte';
import BankLedger from '../svelte/bank-ledger/bank-ledger.svelte';
import BankStatement from '../svelte/bank-statement/bank-statement.svelte';
import TrialBalance from '../svelte/trial-balance/trial-balance.svelte';
import Schedule from '../svelte/schedule/schedule.svelte';
import Changes from '../svelte/changes/changes.svelte';
import Voucher from '../svelte/voucher/voucher.svelte';
import Accounts from '../svelte/accounts/accounts.svelte';
import Company from '../svelte/company/company.svelte';
import Project from '../svelte/project/project.svelte';
import Expense from '../svelte/expense/expense-report.svelte';
import Karibarai from '../svelte/karibarai/karibarai.svelte';
import Task from '../svelte/task/task.svelte';
import Transaction from '../svelte/transaction/transaction.svelte';
import Item from '../svelte/item/item.svelte';
import Member from '../svelte/member/member.svelte';
import Users from '../svelte/users/users.svelte';
import AiSettings from '../svelte/ai/ai-settings.svelte';
import Settings from '../svelte/settings/settings.svelte';
import modules from '../../config/module-list.js';

const pages = {
  menu: Menu,
  journal: Journal,
  'bank-ledger': BankLedger,
  'bank-statement': BankStatement,
  ledger: Ledger,
  'trial-balance': TrialBalance,
  schedule: Schedule,
  changes: Changes,
  voucher: Voucher,
  accounts: Accounts,
  company: Company,
  project: Project,
  expense: Expense,
  'expense-unsorted': Expense,
  'expense-payee': Expense,
  'expense-payment': Expense,
  karibarai: Karibarai,
  task: Task,
  transaction: Transaction,
  item: Item,
  member: Member,
  users: Users,
  'ai-settings': AiSettings,
  settings: Settings,
  'company-master': Company
};

// module-list に項目を持たないページ（サイドバーに出ない画面）
const extras = [
  { match: /^\/home/, component: Home, title: 'ホーム' },
  { match: /^\/slip/, component: SlipPage, title: '仕訳明細入力' }
];

// module-list（submenuを優先）からページを解決する
export const findPage = (pageUrl) => {
  const path = ( pageUrl || '' ).split('?')[0];
  for ( const ent of modules ) {
    if ( ent.submenu ) {
      for ( const sub of ent.submenu ) {
        if ( sub.name && pages[sub.name] && path.match(sub.match) ) {
          return { component: pages[sub.name], title: sub.title || ent.title, name: sub.name };
        }
      }
    }
  }
  for ( const ent of modules ) {
    if ( ent.name && pages[ent.name] && path.match(ent.match) ) {
      return { component: pages[ent.name], title: ent.title, name: ent.name };
    }
  }
  for ( const extra of extras ) {
    if ( path.match(extra.match) ) {
      return extra;
    }
  }
  return null;
};

// router.svelte 用のルート表（match → component）。
// submenuにnameを持つページ（通帳元帳/通帳一覧等）は個別ルートとして先に、
// 親エントリを後に置く（findRouteは最初に一致したものを使う）
export const pageRoutes = modules
  .flatMap((ent) => {
    const subs = ( ent.submenu || [] )
      .filter((sub) => sub.name && pages[sub.name])
      .map((sub) => ({ match: sub.match, component: pages[sub.name] }));
    const top = ( ent.name && pages[ent.name] ) ?
      [{ match: ent.match, component: pages[ent.name] }] : [];
    return [ ...subs, ...top ];
  })
  .concat(extras.map((extra) => ({ match: extra.match, component: extra.component })));
