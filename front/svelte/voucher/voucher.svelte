{#if ( state === 'list' )}
<VoucherList
  bind:status={status}
  bind:vouchers={vouchers}
  on:open={openEntry}
  on:slip={openSlip}
  on:update={changeMonth}
  ></VoucherList>
{:else if ( state === 'entry' || state === 'new' )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:open={openSlip}
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
  on:close={updateSlip}></CrossSlipModal>
{/key}
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js';
import {setAccounts} from '../../javascripts/cross-slip';
import {parseParams, buildParam} from '../../javascripts/params.js';
import {currentPage, link} from '../../javascripts/router.js';

let slip = {
  year: 0,
  month: 0,
  lines: []
};
let modalCount = 0;
let popUp;

export let status;

let	voucher;
let vouchers = [];
let accounts = [];
let state;

const openSlip = (event) => {
  const slipNo = event.detail;
  if	( slipNo.no )	{
    axios.get(`/api/cross_slip/${slipNo.year}/${slipNo.month}/${slipNo.no}`).then((result) => {
      slip = result.data;
      slip.approvedAt = slip.approvedAt ? new Date(slip.approvedAt) : null;
      console.log('slip', slip);
      popUp = true;
    })
  } else {
    slip = {
      year: parseInt(slipNo.year),
      month: parseInt(slipNo.month),
      day: parseInt(slipNo.day),
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
  voucher = event.detail;
  if ( !voucher || !voucher.id )	{
    link('/voucher/new');
  } else {
    link(`/voucher/entry/${voucher.id}`);
  }
};

const updateSlip = (event) => {
  checkPage(location.href);
}

const closeEntry = (event) => {
  const query = status.params ? `?${status.params.toString()}` : '';
  link(`/voucher${query}`);
}

const changeMonth = (event) => {
  const param = buildParam(status, event.detail);
  link(`/voucher?${param}`);
}

const updateVouchers = (event) => {
  const param = status.params ? status.params.toString() : '';
  axios.get(`/api/voucher?${param}`).then((result) => {
    vouchers = result.data.vouchers;
  });
};

const checkPage = (pageUrl) => {
  const args = location.pathname.split('/');
  status.params = new URLSearchParams(location.search);
  console.log('voucher checkPage', args, status.params, status.params.get('month'));

  state = args[2];
  if ( state === 'entry' || state === 'new') {
    if ( state === 'entry') {
      axios.get(`/api/voucher/${args[3]}`).then((result) => {
        voucher = result.data.voucher;
        currentVoucher.set(voucher);
      });
    } else { // 'new'
      voucher = {
        issueDate: formatDate(new Date()),
        paymentDate: null,
        amount: 0,
        taxClass: -1,
        tax: 0,
        type: -1
      };
      currentVoucher.set(voucher);
    }
  } else { // list view
    state = 'list';
    updateVouchers();
  }
}

onMount(async () => {
  axios.get(`/api/accounts`).then((res) => {
    accounts = res.data;
    setAccounts(accounts);
  });

  checkPage(location.href);

  const unsubscribe = currentPage.subscribe((page) => {
    if (page) {
      const path = location.pathname;
      if (path.split('/')[1] === 'voucher') {
        checkPage(page);
      }
    }
  });

  return () => unsubscribe();
})

afterUpdate(() => {
  if  (!popUp)  {
    modalCount += 1;
  }
})
</script>
