{#if ( status.state === 'list' )}
<VoucherList
  bind:status={status}
  bind:vouchers={vouchers}
  on:open={openEntry}
  ></VoucherList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
<VoucherEntry
  bind:status={status}
  bind:voucher={voucher}
  on:close={closeEntry}>
</VoucherEntry>
{/if}
<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import VoucherEntry from './voucher-entry.svelte';
import VoucherList from './voucher-list.svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {currentVoucher, getStore} from '../../javascripts/current-record.js'

export let status;

let	voucher;
let vouchers = [];

const	openEntry = (event)	=> {
  //console.log('open', event.detail);
  voucher = event.detail;
  status.change = true;
  if ( !voucher || !voucher.id )	{
    voucher = null;
    status.state = 'new';
    currentVoucher.set(null);
    window.history.pushState(
      status, "", `/voucher/new`);
  } else {
    status.state = 'entry';
    window.history.pushState(
      status, "", `/voucher/entry/${voucher.id}`);
  }
};

const closeEntry = (event) => {
  status.state = 'list';
}

const checkPage = () => {
  let args = location.pathname.split('/');
  console.log({args});
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
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
          axios.get(`/api/voucher/${args[3]}`).then((result) => {
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
}

onMount(async () => {
  console.log('voucher onMount', voucher);
  window.onpopstate = (event) => {
    if	( window.history.state )	{
      status = window.history.state;
      //console.log({current_params});
      updateVouchers();
    }
  }
})

beforeUpdate(()	=> {
  //console.log('voucher beforeUpdate');
  checkPage();
});
</script>
