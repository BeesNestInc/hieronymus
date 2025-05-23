{#if ( status.state === 'list' )}
<VoucherList
  bind:status={status}
  vouchers={vouchers}
  on:open={openEntry}
  on:openSlip={openSlip}
  on:selectVoucherType={selectVoucherType}
  on:selectCompanyId={selectCompany}
  on:selectAmount={selectAmount}
  on:gotoMonth={gotoMonth}
  ></VoucherList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:close={closeEntry}>
</VoucherEntry>
{/if}
{#if popUp}
{#key modalCount}
<CrossSlipModal
  accounts={accounts}
  slip={slip}
  status={status}
  bind:popUp={popUp}
  on:close={updateVouchers}></CrossSlipModal>
{/key}
{/if}
<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js'
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let	voucher;
let vouchers = [];
let accounts = [];
let slip = {
  year: 0,
  month: 0,
  lines: []
};
let modalCount = 0;
let popUp;

const selectVoucherType = (event) => {
  updateVouchers({});
}
const selectCompany = (event) => {
  let	companyId = event.detail;
  //console.log({companyId});
  updateVouchers({
    company: companyId
  });
}
const selectAmount = (event) => {
  let amounts = event.detail;
  //console.log({amounts});
  updateVouchers({
    upper: numeric(amounts.upperAmount),
    lower: numeric(amounts.lowerAmount)
  });
}

const gotoMonth = (event) => {
  let month = event.detail;
  //console.log('month', month);
  updateVouchers({
    month: month
  });
}

const updateVouchers = (_params) => {
  let param = buildParam(status, _params);
  console.log('param', param);
  axios.get(`/api/voucher?${param}`).then((result) => {
    vouchers = result.data.vouchers;
    //console.log('vouchers', vouchers);
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const	openSlip = (event)	=> {
  let issue = event.detail;
  if	( issue.no )	{
    axios.get(`/api/cross_slip/${issue.year}/${issue.month}/${issue.no}`).then((result) => {
      slip = result.data;
      slip.approvedAt = slip.approvedAt ? new Date(slip.approvedAt) : null;
      console.log('slip', slip);
      popUp = true;
    })
  } else {
    slip = {
      year: parseInt(issue.year),
      month: parseInt(issue.month),
      day: parseInt(issue.day),
      lines: [{
        debitAccount: "",
        debitSubAccount: 0,
        debitAmount: "",
        debitTax: "",
        creditAccount: "",
        creditSubAccount: 0,
        creditAmount: "",
        creditTax: "",
      }]
    };
    popUp = true;
  }
};

const	openEntry = (event)	=> {
  //console.log('open', event.detail);
  voucher = event.detail;
  if ( !voucher || !voucher.id )	{
    voucher = null;
    status.state = 'new';
    window.history.pushState(
      status, "", `/voucher/${status.term}/new`);
  } else {
    status.state = 'entry';
    axios.get(`/api/voucher/${voucher.id}`).then((result) => {
      voucher = result.data.voucher;
      window.history.pushState(
        status, "", `/voucher/${status.term}/entry/${voucher.id}`);
    });
  }
};

const closeEntry = (event) => {
  status.state = 'list';
  updateVouchers();
}

const checkPage = () => {
  let args = location.pathname.split('/');
  console.log({args});
  if  ( ( args[3] === 'entry' ) ||
			  ( args[3] === 'new'   )) {
    status.state = args[3];
    if  ( !voucher ) {
      voucher = {
      	issueDate: formatDate(new Date()),
      	paymentDate: null,
      	amount: 0,
      	taxClass: -1,
      	tax: 0,
      	type: -1
    	};
      let value = getStore(currentVoucher);
      if	( value )	{
        voucher = value;
      } else {
        if	( status.state === 'entry' )	{
          axios(`/api/voucher/${args[4]}`).then((result) => {
        		voucher = result.data.voucher;
        		//console.log({voucher});
            currentVoucher.set(voucher);
      		});
        } else {
          currentVoucher.set(voucher);
        }
      }
    }
  } else {
    status.state = 'list';
  }
  status.term = parseInt(args[2]);
}

onMount(async () => {
  console.log('voucher onMount', voucher);
  checkPage()
  status.params = parseParams();
  axios.get(`/api/voucher/classes`).then((result) => {
    status.voucherClasses = result.data.values;
  });
  updateVouchers();
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
  });
  window.onpopstate = (event) => {
    if	( window.history.state )	{
      state = window.history.state;
      //console.log({current_params});
      updateVouchers();
    }
  }
})

beforeUpdate(()	=> {
  //console.log('voucher beforeUpdate');
  checkPage();
});
afterUpdate(() => {
  //console.log('voucher afterUpdate');
  if  (!popUp)  {
    modalCount += 1;
  }
})
</script>
