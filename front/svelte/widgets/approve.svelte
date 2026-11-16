<div class="menu">
	<div class="body">
    {#if ( count === 0 )}
    <div class="text-muted small p-2">承認待ちの伝票はありません</div>
    {:else}
    <div class="row">
    	<ul class="list-group">
        <li class="list-group-item">
          件数: {count}
        </li>
      </ul>
    </div>
    {/if}
    {#if ( count > 0 )}
	  <div class="row full-height scroll-table">
		  <table class="table table-bordered">
        <thead class="table-light">
          <th colspan="2">
            日付 / 伝番
          </th>
          <th style="width: 100px;">
            作成者
          </th>
          <th style="width: 100px;">
            更新者
          </th>
          <th>
            適用
          </th>
        </thead>
        <tbody>
          {#each slips as slip}
          <tr>
            <td style="width:50px;text-align:center;">
              {slip.month}/{slip.day}
            </td>
            <td style="width:50px;" class='number'>
              <button type="button" class="btn btn-link"
                on:click|preventDefault={() => {
                  openSlip(slip.year, slip.month, slip.no);
                }}>
                {slip.no}
              </button>
            </td>
            <td class="">
              {slip.creater ? slip.creater.name: ''}
            </td>
            <td class="">
              {slip.updater ? slip.updater.name: ''}
            </td>
            <td>
              {slip.lines[0]?.application1}/{slip.lines[0]?.application2 || ''}
            </td>
          </tr>
          {/each}
        </tbody>              
      </table>
    </div>
    {/if}
  </div>
</div>
<style>

</style>
<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {link} from '../../javascripts/router.js';

export let status;
export let toast;

let count = 0;
let slips = [];
let accounts;


const setupAccount = () => {
	accounts = [];
	axios.get(`/api/accounts`).then((res) => {
		accounts = res.data;
		setAccounts(accounts);
	});
}

const openSlip = (year, month, no) => {
  link(`/slip/${year}/${month}/${no}?returnTo=${encodeURIComponent('/home')}`);
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