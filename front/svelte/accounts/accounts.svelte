<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>科目管理</h1>
  </div>
  <div class="full-height fontsize-12pt">
    <AccountsList
      status={status}
      lines={lines}
      accounts={accounts}
      on:open={openAccount}>
    </AccountsList>
  </div>
</div>

<AccountModal
  account={account}
  subAccount={subAccount}
  mode={mode}
  status={status}
  modal={modal}
  on:close={updateAccounts}>
</AccountModal>

<style>
</style>

<script>
import axios from 'axios';
import Modal from 'bootstrap/js/dist/modal';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import AccountsList from './accounts-list.svelte';
import AccountModal from './account-modal.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {numeric, formatDate} from '../../../libs/utils.js';
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let accounts;
let	lines = [];
let modal;
let	mode;
let	account = {};
let	subAccount = {};

const ready = () => {
  lines = [];
  let last_account = {};
  for ( let i = 0; i < accounts.length; i ++ ) {
    let account = accounts[i];
    let new_line = {
      aclId: account.acl_id,
      aclCode: account.acl_code
    };
    if ( last_account.major_name != account.major_name ) {
      new_line.majorName = account.major_name;
    } else {
      new_line.majorName = '';
    }
    if ( last_account.middle_name != account.middle_name ) {
      new_line.middleName = account.middle_name;
    } else {
      new_line.middleName = '';
    }
    if ( last_account.minor_name != account.minor_name ) {
      new_line.minorName = account.minor_name;
    } else {
      new_line.minorName = '';
    }
    if		(( new_line.major_name != '') ||
         ( new_line.middle_name != '' ) ||
         ( new_line.minor_name != '' )) {
      lines.push(new_line);
    }
    if	( account.name && ( account.name != '' ) )	{
      lines.push({
        majorName: '',
        middleName: '',
        minorName: '',
        accountName: account.name,
        subAccountName: '',
        taxClass: ( account.subAccounts && account.subAccounts.length > 0 ) ? 0 : account.taxClass,
        key: account.key ? account.key : '',
        debit: account.debit ? numeric(account.debit) : 0,
        credit: account.credit ? numeric(account.credit) : 0,
        remaining: account.balance ? numeric(account.balance) : 0,
        subCode: -1,
        code: account.code
      });
      if ( account.subAccounts && account.subAccounts.length > 0 ) {
        for ( let j = 0; j < account.subAccounts.length; j ++) {
          let sub = account.subAccounts[j];
          lines.push({
            majorName: '',
            middleName: '',
            minorName: '',
            accountName: '',
            subAccountName: sub.name,
            taxClass: sub.taxClass,
            key: sub.key,
            debit: sub.debit ? numeric(sub.debit) : 0,
            credit: sub.credit ? numeric(sub.credit) : 0,
            remaining: sub.balance ? numeric(sub.balance) : 0,
            subCode: sub.code,
            code: account.code
          });
        }
      }
    }
    last_account = account;	 
  }
}


const	updateAccounts = () => {
  axios.get(`/api/accounts4/${status.fy.term}`).then((result) => {
    accounts = result.data;
    console.log('accounts', accounts);
    setAccounts(accounts);
    ready();
  });
}

const checkPage = () => {
  let args = location.pathname.split('/');
}
onMount(() => {
  status.params = parseParams();
  modal = new Modal(document.getElementById('account-modal'));
  updateAccounts();
})

beforeUpdate(() => {
  checkPage();
  console.log('account.svelte', {status})
});

let openModal = false;
afterUpdate(() => {
  if	( openModal )	{
    modal.show();
    openModal = false;
  }
});
const	openAccount = (event) => {
  let	args = event.detail;
  console.log({args});
  mode = args.mode;
  account = args.account;
  subAccount = args.subAccount;
  openModal = true;
}
</script>
