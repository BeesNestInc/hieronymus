{#if ( count > 0 )}
<div class="menu">
	<div class="body">
  	<div class="text">件数: {count}</div>
		<table class="table table-bordered">
    	<thead>
      	<th scope="col" colspan="2">
      	  日付 / 伝番
    	  </th>
  	    <th scpe="col">
	        適用
      	</th>
      	<th scope="col" style="width: 100px;">
        	作成者
      	</th>
      	<th scope="col" style="width: 100px;">
        	更新者
      	</th>
    	</thead>
    	<tbody>
      	{#each slips as line}
  	    <tr>
	        <td style="width:50px;text-align:center;">
      	    {line.month}/{line.day}
    	    </td>
  	      <td style="width:50px;" class='number'>
	          <a href="#"
            	on:click|preventDefault={() => {
            	  openSlip(line.year, line.month, line.no);
          	  }}>
        	    {line.no}
      	    </a>
    	    </td>
  	      <td>
	          {line.application1 || ''}<br/>
          	{line.application2 || ''}
        	</td>
      	  <td class="">
    	      {line.creater ? line.creater.name: ''}
  	      </td>
	        <td class="">
          	{line.updater ? line.updater.name: ''}
        	</td>
      	</tr>
      	{/each}
    	</tbody>              
  	</table>
  </div>
</div>
<CrossSlipModal
  id={newId}
	slip={slip}
	bind:modal={modal}
	term={status.term}
	user={status.user}
	accounts={accounts}
	bind:init={init}
	on:close={close_}></CrossSlipModal>
{/if}
<style>

</style>
<script>
import axios from 'axios';
import {onMount, beforeUpdate, tick, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import CrossSlipModal from '../cross-slip/cross-slip-modal.svelte';
import Modal from 'bootstrap/js/dist/modal';
import {setAccounts} from '../../javascripts/cross-slip';
import { v4 as uuidv4 } from "uuid";

export let status;
export let toast;

let count = 0;
let slips = [];
let slip = {
  lines:[]
};
let init = true;
let accounts;
let modal;
const newId = uuidv4();

const setupAccount = () => {
	accounts = [];
	axios.get(`/api/accounts`).then((res) => {
		accounts = res.data;
		setAccounts(accounts);
	});
}

const close_ = (event) => {
	getSlips();
}

const openSlip = (year, month, no) => {
  if  ( !modal )  {
    modal = new Modal(document.getElementById(newId));
  }
  axios.get(`/api/cross_slip/${year}/${month}/${no}`).then((result) => {
    slip = result.data;
    init = true;
    modal.show();
  })
}

const getSlips = () => {
  axios.get('/api/cross_slips/not_approved').then((result) => {
    slips = result.data;
    count = slips.length;
  })
}

onMount(() => {
  console.log('approve onMount');
  if  ( !accounts ) {
    setupAccount();
  }
  getSlips();
  console.log('approve onMount end');
})
</script>