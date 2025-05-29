<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>取引一覧</h1>
    <button type="button" class="btn btn-primary"
      on:click={() => {
        openTransaction(null);
      }}
      id="transaction-info">新規入力&nbsp;<i class="bi bi-pencil-square"></i></button>
  </div> 
  <div class="full-height fontsize-12pt">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th scope="col" style="width: 150px;">
            種別
          </th>
          <th scope="col" style="width: 300px;">
            相手先
          </th>
          <th scope="col" style="">
            件名
          </th>
          <th scope="col" style="width: 100px;">
            担当
          </th>
          <th scope="col" style="width: 100px;">
            発生日
          </th>
          <th scope="col" style="width: 120px;">
            金額
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:5px;">
            <select class="form-select" id="kind"
              on:input={(event) => {
                let value = parseInt(event.currentTarget.value);
                status.params.set('kind', value);
                dispatch('selectKind')
              }}
              value={status.params ? parseInt(status.params.get('kind')) : -1}>
              <option value={-1}>全て</option>
              {#each transactionKinds as ent}
              <option value={ent.id}>{ent.label}</option>
              {/each}
            </select>
          </td>
          <td style="padding:5px;">
            <CompanySelect
              register=false
              clientOnly=true
              bind:value={companyId}
              on:input={changeCompany}>
            </CompanySelect>
          </td>
          <td>
          </td>
          <td>
          </td>
          <td>
          </td>
          <td style="text-align:right;">
          </td>
        </tr>
        {#each transactions as line}
        <tr>
          <td>
            {line.kindId ? line.kind.label : '_'}
          </td>
          <td>
            {#if (line.companyId)}
            <button type="button" class="btn btn-link"
              on:click={() => {
                link(`/company/entry/${line.companyId}`);
              }}>
              {line.companyName ? line.companyName : line.company.name}
            </button>
            {:else}
            {line.companyName ? line.companyName : '__' }
            {/if}
          </td>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
                openTransaction(line.id)
              }}>
              {line.subject ? line.subject : '__'}
            </button>
          </td>
          <td>
            { line.handleUser ? (line.handleUser.member.tradingName || '') : '__'}
          </td>
          <td>
            {formatDate(line.issueDate)}
          </td>
          <td class="number">
            {numeric(line.amount).toLocaleString()}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script>
import axios from 'axios';

import CompanySelect from '../components/company-select.svelte';

import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export let status;
export let transactions;

let companyId;
let upperAmount;
let lowerAmount;
let transactionKinds = [];

const compDate = (date, year, month, day) => {
  let ymd = date.split('-');
  return	(	( parseInt(ymd[0]) == year )
    &&	( parseInt(ymd[1]) == month )
    &&	( parseInt(ymd[2]) == day ));
}
const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
  console.log({status});
}

beforeUpdate(() => {
  //sconsole.log('transaction-list beforeUpdate');
});

const changeCompany = (event) => {
  let companyId = event.detail;
  console.log({companyId});
  dispatch('selectCompanyId', companyId);
}
const changeAmount = (event) => {
  if	( event.keyCode == 13 )	{
    dispatch('selectAmount', {
      lowerAmount: lowerAmount,
      upperAmount: upperAmount
    });
  }
}

const openTransaction = (id) => {
  let	transaction;

  if  ( id )  {
    for ( let i = 0; i < transactions.length; i ++ ) {
      if ( transactions[i].id == id ) {
        transaction = transactions[i];
        break;
      }
    }
  }
  dispatch('open', transaction);
}
onMount(() => {
  axios.get(`/api/transaction/kinds`).then((result) => {
    transactionKinds = result.data.values;
    console.log({transactionKinds});
  });
})
</script>
