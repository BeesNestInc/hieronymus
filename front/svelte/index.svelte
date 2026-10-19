{#if ( getStore(currentPage) === '/login') }
<Login
  bind:current={status.current}></Login>
{:else if ( getStore(currentPage) === '/signup' ) }
<SignUp></SignUp>
{:else}
<nav class="main-header navbar navbar-expand-lg">
  <NavBar
    status={status}></NavBar>
</nav>
<aside 
  class="main-sidebar">
  <SideBar
    bind:mainCount={mainCount}
    bind:status={status}></SideBar>
</aside>
<main class="content-wrapper" class:wide-content={isWide}>
  <div class="container-fluid">
    {#key mainCount}
    <div class="content">
      <Alert bind:alert={alert} {alert_level}></Alert>
      <Router {routes} {toast}
        bind:status={status}/>
    </div>
    {/key}
  </div>
</main>
<footer
  class="main-footer">
  <CommonFooter></CommonFooter>
</footer>
<Toast bind:this={toast}/>
<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={operation}
  ></OkModal>
{/if}

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import axios from 'axios';

import NavBar from './common/nav.svelte';
import CommonFooter from './common/footer.svelte';
import SideBar from './common/sidebar.svelte';
import Toast from './common/toast.svelte';
import eventBus from '../javascripts/event-bus.js';

import Alert from './components/alert.svelte';

import Login from './login/login.svelte';
import SignUp from './login/signup.svelte';
import Home from './home/home.svelte';
import Menu from './menu/menu.svelte';
import Journal from './journal/journal.svelte';
import SlipPage from './cross-slip/slip-page.svelte';
import Ledger from './ledger/ledger.svelte';
import BankLedger from './bank-ledger/bank-ledger.svelte';
import BankStatement from './bank-statement/bank-statement.svelte';
import TrialBalance from './trial-balance/trial-balance.svelte';
import Changes from './changes/changes.svelte';
import Voucher from './voucher/voucher.svelte';
import Accounts from './accounts/accounts.svelte';
import Company from './company/company.svelte';
import Project from './project/project.svelte';
import Expense from './expense/expense-report.svelte';
import Karibarai from './karibarai/karibarai.svelte';

import Users from './users/users.svelte';
import Transaction from './transaction/transaction.svelte';
import Item from './item/item.svelte';
import Member from './member/member.svelte';
import Task from './task/task.svelte';
import OkModal from './common/ok-modal.svelte';

import Router from './components/router.svelte';
import {currentPage, getStore} from '../javascripts/router.js';
import { getCompanyInfo } from '../../libs/utils.js';

export let term;

const routes = [
  {
    match: /^\/menu/,
    component: Menu
  },
  {
    match: /^\/home/,
    component: Home
  },
  {
    match: /^\/journal/,
    component: Journal
  },
  {
    match: /^\/slip/,
    component: SlipPage
  },
  {
    match: /^\/ledger/,
    component: Ledger
  },
  {
    match: /^\/bank-ledger/,
    component: BankLedger
  },
  {
    match: /^\/bank-statement/,
    component: BankStatement
  },
  {
    match: /^\/trial-balance/,
    component: TrialBalance
  },
  {
    match: /^\/changes/,
    component: Changes
  },
  {
    match: /^\/voucher/,
    component: Voucher
  },
  {
    match: /^\/accounts/,
    component: Accounts
  },
  {
    match: /^\/company/,
    component: Company
  },
  {
    match: /^\/project/,
    component: Project
  },
  {
    match: /^\/expense/,
    component: Expense
  },
  {
    match: /^\/karibarai/,
    component: Karibarai
  },
  {
    match: /^\/task/,
    component: Task
  },
  {
    match: /^\/transaction/,
    component: Transaction
  },
  {
    match: /^\/item/,
    component: Item
  },
  {
    match: /^\/users/,
    component: Users
  },
  {
    match: /^\/member/,
    component: Member
  }
];

let toast;
let description;
let title;
let operation;
let modal;

let alert;
let alert_level;
let status = {
  fy: {
    term: term,
    startDate: new Date(),
    endDate: new Date()
  },
  company: {},
  user: {},
  pathname: '',
  current: 'login'
}

let mainCount = 0;
// 全幅で使いたいページ（マッピング等の表がある設定画面）。他は従来の1200px固定
$: isWide = /^\/expense\/(home|unsorted|payee|payment)/.test($currentPage || '');

let reply;
const doReply = (event) => {
  eventBus.emit(reply, event.detail);
}
// currentPage.set('/home');

onMount(async () => {
  console.log('index onMount');
  status.pathname = location.pathname;
  // currentPage.set(location.pathname);
  const res = await axios.get('/api/user');
  status.user = res.data.user;
  status.company = await getCompanyInfo();
  axios.get(`/api/term/${term}`).then((res) => {
    let fy = res.data;
    if  ( fy )  {
      status.fy = fy;
      console.log({fy});
      status.fy.startDate = new Date(fy.startDate);
      status.fy.endDate = new Date(fy.endDate);
    } else {
      status.fy = {};
    }
  });
  window.onpopstate = (event) => {
    console.log('maybe back', event);
    const page = location.pathname + location.search;
    console.log("popstate:", page);
    currentPage.set(page);
  };
  eventBus.on('okModal', (args) => {
    console.log(args);
    title = args.title;
    description = args.description;
    reply = args.reply;
    operation = doReply;
    modal.show();
  })
})

beforeUpdate(() => {
  let args = location.pathname.split('/');
  //console.log('index beforeUpdate', args);
  //status = status;
  //console.log('index beforeUpdate', {status});
})
afterUpdate(() => {
  console.log('index afterUpdate');
})

</script>
<style>
/* 全幅ページ（設定画面等）。サイドバー分を除いた残りをすべて使う */
.content-wrapper.wide-content {
  width: auto;
}
.content-wrapper.wide-content :global(.content) {
  min-width: 0;
}
</style>
