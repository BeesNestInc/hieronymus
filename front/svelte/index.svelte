{#if ( status.current === 'login') }
<Login
  bind:current={status.current}></Login>
{:else if ( status.current === 'signup' ) }
<SignUp
  bind:current={status.current}></SignUp>
{:else}
<nav class="main-header navbar navbar-expand-lg">
  <NavBar
    status={status}></NavBar>
</nav>
<aside 
  class="main-sidebar">
  <SideBar
    bind:status={status}></SideBar>
</aside>
<main class="content-wrapper">
  <div class="container-fluid">
    <div class="content">
      <Alert bind:alert={alert} {alert_level}></Alert>
      {#if false}
      <p></p>
      {:else if ( status.current === '' || status.current === 'home' )}
      <Home
        bind:status={statusHome}
        bind:toast={toast}
        bind:alert={alert}
        bind:alert_level={alert_level}
        ></Home>
      {:else if ( status.current === 'menu' )}
      <Menu
        bind:status={statusMenu}
        bind:toast={toast}></Menu>
      {:else if ( status.current === 'journal' )}
      <Journal
      	bind:status={statusJournal}
      	bind:alert={alert}
      	bind:alert_level={alert_level}></Journal>
			{:else if ( status.current === 'ledger' )}
      <Ledger
        bind:status={statusLedger}
        bind:alert={alert}
        bind:alert_level={alert_level}
      ></Ledger>
      {:else if ( status.current === 'bank-ledger' )}
      <BankLedger
      	bind:status={statusBankLedger}
      	bind:alert={alert}
      	bind:alert_level={alert_level}></BankLedger>
      {:else if ( status.current === 'trial-balance' )}
      <TrialBalance
        bind:status={statusTrialBalance}
        bind:alert={alert}
        bind:alert_level={alert_level}></TrialBalance>
      {:else if ( status.current === 'changes' )}
      <Changes
      	bind:status={statusChanges}
      	bind:alert={alert}
      	bind:alert_level={alert_level}/>
      {:else if ( status.current === 'voucher' )}
      <Voucher
        bind:status={statusVoucher}
        bind:alert={alert}
        bind:alert_level={alert_level}></Voucher>
      {:else if ( status.current === 'accounts' )}
      <Accounts
      	bind:status={statusAccounts}
      	bind:alert={alert}
      	bind:alert_level={alert_level}></Accounts>
			{:else if ( status.current === 'company' )}
      <Company
        bind:status={statusCompany}
        bind:alert={alert}
        bind:alert_level={alert_level}></Company>
      {:else if ( status.current === 'task' )}
      <Task
        bind:status={statusTask}></Task>
      {:else if ( status.current === 'transaction' )}
      <Transaction
        bind:status={statusTransaction}></Transaction>
      {:else if ( status.current === 'item')}
      <Item
        bind:status={statusItem}></Item>
      {:else if ( status.current == 'users' )}
      <Users
        bind:status={statusUsers}></Users>
      {:else if ( status.current === 'member' )}
      <Member
        bind:status={statusMember}></Member>
      {/if}
    </div>
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
import Ledger from './ledger/ledger.svelte';
import BankLedger from './bank-ledger/bank-ledger.svelte';
import TrialBalance from './trial-balance/trial-balance.svelte';
import Changes from './changes/changes.svelte';
import Voucher from './voucher/voucher.svelte';
import Accounts from './accounts/accounts.svelte';
import Company from './company/company.svelte';

import Users from './users/users.svelte';
import Transaction from './transaction/transaction.svelte';
import Item from './item/item.svelte';
import Member from './member/member.svelte';
import Task from './task/task.svelte';
import OkModal from './common/ok-modal.svelte';

export let term;

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
  user: {},
  pathname: '',
  companyClasses: [],
  voucherClasses: [],
  current: 'login'
}
let statusHome = status;
let statusMenu = status;
let statusJournal = status;
let statusLedger = status;
let statusBankLedger = status;
let statusTrialBalance = status;
let statusChanges = status;
let statusVoucher = status;
let statusAccounts = status;
let statusCompany = status;
let statusTask = status;
let statusTransaction = status;
let statusItem = status;
let statusUsers = status;
let statusMember = status;

let reply;
const doReply = (event) => {
  eventBus.emit(reply, event.detail);
}
onMount(() => {
  console.log('index onMount');
  status.pathname = location.pathname;
  axios.get('/api/user').then((res) => {
    status.user = res.data.user;
  });
  axios.get(`/api/term/${term}`).then((res) => {
    let fy = res.data;
    status.fy = fy;
    console.log({fy});
    status.fy.startDate = new Date(fy.startDate);
    status.fy.endDate = new Date(fy.endDate);
  });
	window.onpopstate = (event) => {
    console.log('maybe back', event);
    status = event.state;
    status.change = true;
    console.log({status});
	}
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
  console.log('index beforeUpdate', args);
  status.current = args[1];
  status = status;
  //console.log('index beforeUpdate', {status});
  switch  (status.current) {
    case  'home':
      statusHome = status;
      break;
    case	'menu':
      statusMenu = status;
      break;
    case  'journal':
      statusJournal = status;
      break;
    case  'ledger':
      statusLedger = status;
      break;
    case  'bank-ledger':
      statusBankLedger = status;
      break;
    case  'trial-balance':
      statusTrialBalance = status;
      break;
    case  'changes':
      statusChanges = status;
      break;
    case  'voucher':
      statusVoucher = status;
      break;
    case  'accounts':
      statusAccounts = status;
      break;
    case  'company':
      statusCompany = status;
      break;
    case  'task':
      statusTask = status;
      break;
    case  'transaction':
      statusTransaction = status;
      break;
    case  'item':
      statusItem = status;
      break;
    case  'users':
      statusUsers = status;
      break;
    case  'member':
      statusMember = status;
      break;
  }
})

</script>