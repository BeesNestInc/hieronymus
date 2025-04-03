<input type="hidden" id="id" bind:value={task.id}>
<div class="container-fluid">
  <div class="row mb-3">
    <label for="issueDate" class="col-1 col-form-label">発生日</label>
    <div class="col-2">
      <input type="date" class="form-control" id="issueDate"
        bind:value={task.issueDate}>
    </div>
    <label for="deliveryLimit" class="col-1 col-form-label">納期</label>
    <div class="col-2">
      <input type="date" class="form-control" id="deliveryLimit"
        bind:value={task.deliveryLimit}>
    </div>
    <label for="endedAt" class="col-1 col-form-label">終了日</label>
    <div class="col-2">
      <input type="date" class="form-control" id="endedAt"
        bind:value={task.endedAt}>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-1">
      <label class="col-form-label">相手先</label>
      {#if ( task.customerId && task.id)}
      {#if (customerEditting)}
      <a href="#" on:click|preventDefault={() => {
        customerEditting = false
      }}>
        <i class="bi bi-check"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        customerEditting = true
      }}>
        <i class="bi bi-pencil"></i>
      </a>
      {/if}
      {/if}
    </div>
    <div class="col-11">
      {#if (customerEditting || !task.customerId)}
      <CustomerSelect
        on:startregister
        on:endregister
        register="true"
        input="input"
        clientOnly="true"
        bind:customerId={task.customerId}
        bind:customerName={task.customerName}
        bind:chargeName={task.chargeName}
        bind:zip={task.zip}
        bind:address1={task.address1}
        bind:address2={task.address2}
      />
      {:else}
      <span>{task.customerName}</span>
      <button type="button" class="btn btn-warning"
      	on:click={() => {
          task.customerId = null;
        }}>
      	変更
    	</button>
  		{/if}
    </div>
  </div>
  <div class="row mb-3">
    <label for="subject" class="col-1 col-form-label">件名</label>
    <div class="col-7">
      <input type="text" class="form-control" id="subject"
        bind:value={task.subject} />
    </div>
    <div class="col-4">
      <label for="handler" class="col-form-label">担当</label>
      <select id="handler" class="form-control" style="display:inline;margin:0 10px;width:200px;"
        bind:value={task.handledBy}>
        {#each users as user}
        <option value={user.id}>{user.name}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-1">
      <label class="col-form-label">見積</label>
      {#if (task.id)}
      {#if (viewDetail)}
      <a href="#" on:click|preventDefault={() => {
        viewDetail = false
      }}>
    	  <i class="bi bi-arrows-collapse"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        viewDetail = true
      }}>
        <i class="bi bi-arrows-expand"></i>
      </a>
      {/if}
      {/if}
    </div>
    {#if (viewDetail || !task.id)}
    <div class="col-11">
      <TaskDetails
      	bind:details={task.lines}
      	bind:sum={sum}
      	on:sum={computeTax}
    	></TaskDetails>
      <div class="row">
        <div class="row mb-3">
          <label for="taxClass" class="col-1 col-form-label">消費税</label>
          <div class="col-sm-2">
            <select class="form-control" id="taxClass"
              bind:value={task.taxClass}>
              {#each TAX_CLASS as ent}
              <option value={ent[1]}>{ent[0]}</option>
              {/each}
            </select>
          </div>
          <div class="col-sm-2">
            {#if ( parseInt(task.taxClass) === 9 )}
            <input type="text" class="form-control number" id="tax"
              bind:value={task.tax}>
            {:else}
            <input type="text" class="form-control number" id="tax" disabled="true"
              value={task.tax.toLocaleString()}>
            {/if}
          </div>
        </div>
      </div>
    </div>
    {:else}
    <div class="col-11">
      <div class="label" style="width:70px;">
				<span>金額</span>
      </div>
      <div class="disabled">
      	<span>{task.amount ? task.amount.toLocaleString(): '0'}</span>
      </div>
      <div class="label" style="width:120px;">
				<span>
      		消費税(
        		{task.taxClass ? TAX_CLASS.find((item) => item[1] === task.taxClass)[0]: ''}
      		)
        </span>
      </div>
      <div class="disabled">
      	<span>{task.tax ? task.tax.toLocaleString(): '0'}</span>
    	</div>
    </div>
    {/if}
  </div>
  <div class="row mb-3">
    <div class="col-1">
      <label for="description" class="col-form-label">備考</label>
      {#if ( documentEditting )}
      <a href="#" on:click|preventDefault={() => {
        documentEditting = false
      }}>
        <i class="bi bi-check"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        documentEditting = true;
        viewDescription = true;
        viewFiles = true;
      }}>
        <i class="bi bi-pencil"></i>
      </a>
      {#if ( viewDescription )}
      <a href="#" on:click|preventDefault={() => {
	      viewDescription = false;
  	  }}>
    	  <i class="bi bi-arrows-collapse"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        viewDescription = true;
      }}>
        <i class="bi bi-arrows-expand"></i>
      </a>
      {/if}
      {/if}
  	</div>
    <div class="col-11">
      <Document
        editting={documentEditting}
        {viewDescription}
        bind:document={task.document}></Document>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-1">
      ファイル
      {#if ( viewFiles )}
      <a href="#" on:click|preventDefault={() => {
        viewFiles = false;
      }}>
        <i class="bi bi-arrows-collapse"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        viewFiles = true;
      }}>
        <i class="bi bi-arrows-expand"></i>
      </a>
      {/if}
    </div>
    <div class="col-11">
      {#if ( viewFiles )}
      <DocumentFiles
      	document={task.document}
        bind:files={files}></DocumentFiles>
      {/if}
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-1">
      取引
      {#if ( viewTransaction )}
      <a href="#" on:click|preventDefault={() => {
        viewTransaction = false;
      }}>
        <i class="bi bi-arrows-collapse"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        viewTransaction = true;
      }}>
        <i class="bi bi-arrows-expand"></i>
      </a>
      {/if}
    </div>
    <div class="col-11">
      {#if (viewTransaction && transactions )}
      <table class="table table-bordered">
        <thead>
          <tr>
            <th scope="col" style="width: 100px;">
              種別
            </th>
            <th scope="col" style="width: 100px;">
              発生日
              <a href=""
              	on:click|preventDefault={() => {
                if	( transactionOrder === 'asc' )	{
									transactionOrder = 'desc';
                } else {
                  transactionOrder = 'asc';
                }
                transactionParams.set('order', transactionOrder);
                transactions = null;
              }}>
							  {#if ( transactionOrder === 'asc')}
                ▲
                {:else}
                ▼
                {/if}
              </a>
            </th>
            <th scope="col" style="">
              件名
            </th>
            <th scope="col" style="width: 100px;">
              担当
            </th>
            <th scope="col" style="width: 100px;">
              金額
            </th>
          </tr>
        </thead>
				<tbody>
          {#each transactions as line}
          <tr>
            <td>
              {line.kindId ? line.kind.label : '_'}
            </td>
            <td>
              {formatDate(line.issueDate)}
            </td>
            <td>
              <a href="#" on:click|preventDefault={() => {
                  openTransaction(line.id)
                }}>
                {line.subject ? line.subject : '__'}
              </a>
            </td>
            <td>
              { line.handleUser ? line.handleUser.member.tradingName: '__'}
            </td>
            <td class="number">
              {numeric(line.amount).toLocaleString()}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
      <div class="row">
        <div class="col-5">
        	<button type="button" class="btn btn-info"
        		on:click={() => {
              transactionParams.delete('kind');
              transactionParams.set('voucher','true');
              transactions = null;
          	}}>
          	請求回収
        	</button>
        	<button type="button" class="btn btn-info"
	        	on:click={() => {
              transactionParams.delete('kind');
              transactionParams.set('voucher', 'false');
              transactions = null;
        	  }}>
          	業務関係
        	</button>
	        <button type="button" class="btn btn-info"
  	      	on:click={() => {
              transactionParams.delete('voucher');
              transactionParams.delete('kind');
              transactions = null;
	        	}}>
  	      全て
    	    </button>
      		<select class="form-select" style="display:inline;width:150px;"
        		bind:value={kind}
          	on:change={() => {
              transactionParams.set('kind', kind);
              transactions = null;
          	}}>
        		<option value={-1}></option>
        		{#each transactionKinds as ent}
        		<option value={ent.id}>{ent.label}</option>
        		{/each}
      		</select>
      	</div>
    	</div>
			{/if}
    </div>
  </div>
</div>
<style>
.disabled {
  background-color: #e9ecef;
  border-radius: 0.375rem;
  padding: .375rem .75rem;
  display: inline-block;
  line-height: 1.5;
  width: 120px;
  text-align: right;
}
.label {
  margin-top:5px;
  display: inline-block;
  line-height: 1.5;
}
</style>

<script>
import axios from 'axios';
import {numeric, formatDate, TAX_CLASS} from '../../../libs/utils';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import CustomerSelect from '../components/customer-select.svelte';
import Document from '../components/document.svelte';
import DocumentFiles from '../components/document-files.svelte';
import TaskDetails from '../transaction/transaction-details.svelte';
const dispatch = createEventDispatcher();

export let task;
export let users;
export let files;

let customerKey;
let customerEditting = false;
let documentEditting = false;
let viewDescription = false;
let viewFiles = false;
let viewDetail = false;
let viewTransaction = true;
let sum;

let transactionParams = new Map();
let transactions;
let transactionOrder = 'desc';
let kind;
let transactionKinds = [];

$: computeTax();

const computeTax = (event) => {
  //console.log('computeTax', task.taxClass, sum);
  switch	(parseInt(task.taxClass))	{
    case	0:
      task.tax = 0;
      break;
    case	1:
      task.tax = Math.round(sum / 110 * 10);
      task.amount = sum;
      break;
    case	2:
      task.tax = Math.round(sum * 0.1);
      task.amount = sum + task.tax;
      break;
    case  9:
      task.amount = sum + parseInt(task.tax);
      break;
  }
  //console.log(task.tax, task.amount);
}

beforeUpdate(() => {
  if	( !transactions && task && task.id )	{
    transactions = [];
    console.log(transactionParams);
    let _array = [];
  	transactionParams.forEach((value, key) => {
    	console.log('key, value', key, value);
    	_array.push(encodeURI(`${key}=${value}`));
  	});
  	let param = _array.join('&');
    console.log({param});
  	axios.get(`/api/transaction?task=${task.id}&${param}`).then((result) => {
    	transactions = result.data.transactions;
    });
  }
});

onMount(() => {
  console.log('task-info onMount', task);
  if	( task.id )	{
    customerKey = task.customerName;
  } else {
    customerKey = '';
    viewDetail = true;
  }
  let details = task.lines;
  sum = 0;
  for ( let i = 0 ; i < details.length ; i += 1 ) {
    //console.log(details[i]);
    if  ( details[i].ssum ) {
      details[i].itemId = 0;
    }
    details[i].ssum = false;
    if  ( details[i].itemId === 0 ) {
      details[i].amount = sum;
      details[i].ssum = true;
    } else
    if  ( details[i].itemId ) {
      details[i].amount = parseInt(details[i].unitPrice) * parseFloat(details[i].itemNumber);
      sum += details[i].amount;
    } else {
      sum += details[i].amount;
    }
  }
  axios.get(`/api/transaction/kinds`).then((result) => {
    transactionKinds = result.data.values;
    console.log({transactionKinds});
  });
  computeTax();
});

const openTransaction = (id) => {
  dispatch('openTransaction', id);
}

</script>