<input type="hidden" id="id" bind:value={transaction.id}>
<div class="container-fluid">
  <div class="row mb-3">
    <label for="kind" class="col-1 col-form-label">種別</label>
    <div class="col-2">
      <select class="form-control" id="kind"
        bind:value={transaction.kind}
        on:change={() => {
          if	( transaction.kind < 10 )	{
            viewDetail = true;
          } else {
            documentEditting = true;
            viewDetail = false;
      			viewDescription = true;
      			viewFiles = true;
          }
        }}>
        {#each DOCUMENT_KIND as ent}
        <option value={ent[0]}>{ent[1]}</option>
        {/each}
      </select>
    </div>
    <div class="col-9">
      {#if ( transaction.id && transaction.issueDate )}
        {#if ( transaction.kind === 1 )}
          <a class="btn btn-info" href="/transaction/estimate/{transaction.id}" target="_blank">
            見積書出力
          </a>
        {:else if ( transaction.kind === 4 )}
          <a class="btn btn-info" href="/transaction/transaction/{transaction.id}" target="_blank">
            請求書出力
          </a>
        {/if}
      {/if}
    </div>
  </div>
  <div class="row mb-3">
    <label for="issueDate" class="col-1 col-form-label">発行日</label>
    <div class="col-2">
      <input type="date" class="form-control" id="issueDate"
        bind:value={transaction.issueDate}>
    </div>
    <label for="deliveryLimit" class="col-1 col-form-label">納期</label>
    <div class="col-2">
      <input type="date" class="form-control" id="deliveryLimit"
        bind:value={transaction.deliveryLimit}>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-1">
      <label class="col-form-label">相手先</label>
      {#if ( transaction.customerId )}
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
      {#if (customerEditting || !transaction.customerId )}
      <CustomerSelect
        on:startregister
        on:endregister
        register="true"
        input="input"
        bind:customerId={transaction.customerId}
        bind:customerName={transaction.customerName}
        bind:chargeName={transaction.chargeName}
        bind:zip={transaction.zip}
        bind:address1={transaction.address1}
        bind:address2={transaction.address2}
      />
      {:else}
      <span>{transaction.customerName}</span>
      <button type="button" class="btn btn-danger"
      	on:click={() => {
          transaction.customerId = null;
        }}>
      	変更
    	</button>
  		{/if}
    </div>
  </div>
  <div class="row mb-3">
    <label for="subject" class="col-1 col-form-label">件名</label>
    <div class="col-6">
      <input type="text" class="form-control" id="subject"
        bind:value={transaction.subject} />
    </div>
    <div class="col-5">
      {#if ( transaction.taskId )}
      <button type="button" class="btn btn-info"
      	on:click={() => {
          openTask(transaction.taskId);
        }}>
        案件参照
      </button>
      {:else}
      <button type="button" class="btn btn-primary"
      	on:click={() => {
          openTask(null);
        }}>
        案件作成
      </button>
      {/if}
      <label for="handler" class="col-form-label">弊社担当</label>
      <select id="handler" class="form-control" style="display:inline;margin:0 10px;width:200px;"
        bind:value={transaction.handledBy}>
        <option value={0}></option>
        {#each users as user}
        <option value={user.id}>{user.name}</option>
        {/each}
      </select>
    </div>
  </div>
  {#if ( transaction.kind < 10 )}
  <div class="row mb-3">
    <div class="col-1">
      <label class="col-form-label">詳細</label>
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
    </div>
    <div class="col-11">
      {#if ( viewDetail)}
      <TransactionDetails
      	bind:details={transaction.lines}
      	bind:sum={sum}
      	on:sum={computeTax}
    	></TransactionDetails>
      {/if}
    </div>
  </div>
  <div class="row mb-3">
    <label for="paymentMethod" class="col-1 col-form-label">支払方法</label>
    <div class="col-sm-3">
      <input type="text" class="form-control" id="paymentMethod"
        bind:value={transaction.paymentMethod} />
    </div>
  </div>
  <div class="row mb-3">
    <label for="taxClass" class="col-1 col-form-label">消費税</label>
    <div class="col-sm-1">
      <select class="form-control" id="taxClass"
        bind:value={transaction.taxClass}>
        {#each TAX_CLASS as ent}
        <option value={ent[1]}>{ent[0]}</option>
        {/each}
      </select>
    </div>
    <div class="col-sm-2">
      {#if ( parseInt(transaction.taxClass) === 9 )}
      <input type="text" class="form-control number" id="tax"
        bind:value={transaction.tax}>
      {:else}
      <input type="text" class="form-control number" id="tax" disabled="true"
        value={transaction.tax.toLocaleString()}>
      {/if}
    </div>
  </div>
  <div class="row mb-3">
    <label for="amount" class="col-1 col-form-label">金額</label>
    <div class="col-sm-3">
      <input type="text" class="form-control number" id="amount" disabled="true"
        value={transaction.amount.toLocaleString()}>
    </div>
  </div>
  <div class="row mb-3">
    <label for="description" class="col-1 col-form-label">備考</label>
    <div class="col-sm-10">
      <textarea class="form-control" id="description"
        bind:value={transaction.description} />
    </div>
  </div>
  {/if}
  <div class="row mb-3">
    <div class="col-1">
    	<label for="description" class="col-form-label">記録</label>
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
      bind:document={transaction.document}></Document>
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
    		document={transaction.document}
    		bind:files={files}></DocumentFiles>
      {/if}
		</div>
  </div>
</div>
<style>
.file-item {
  width:90px;
  height:120px;
  border:1px #8CC solid;
  margin:10px;
  padding: 0 10px 10px 10px;
}
.rect-image {
  width:70px;
  position:absolute;
  clip:rect(0,70px,70px,0);
}
</style>

<script>
import {numeric, TAX_CLASS} from '../../../libs/utils.js';
import {DOCUMENT_KIND} from '../../../libs/transaction-documents.js';
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher, onDestroy} from 'svelte';
import CustomerSelect from '../components/customer-select.svelte';
import TransactionDetails from './transaction-details.svelte';
import Document from '../components/document.svelte';
import DocumentFiles from '../components/document-files.svelte';
const dispatch = createEventDispatcher();
import eventBus from '../../javascripts/event-bus.js';
import {currentTransaction, getStore} from '../../javascripts/current-record.js'

export let status;
export let transaction;
export let users;
export let files;

let	original_customers;
let customerKey;
let customerEditting = false;
let documentEditting = false;
let viewDescription = false;
let viewDetail = true;
let viewFiles = false;
let sum = 0;

//$: computeTax();

beforeUpdate(() => {
  computeTax();
})

const	openTask = (id)	=> {
  console.log('openTask', id);
  if  ( !id )  {
    status.task = {
      issueDate: transaction.issueDate,
      deliveryLimit: transaction.deliveryLimit,
      subject: transaction.subject,
      customerId: transaction.customerId,
      customerName: transaction.customerName,
      chargeName: transaction.chargeName,
      zip: transaction.zip,
      address1: transaction.address1,
      address2: transaction.address2,
      lines: [...transaction.lines],
      taxClass: transaction.taxClass,
      tax: transaction.tax,
      amount: transaction.amount
    };
    window.history.pushState(
      status, "", `/task/new`);
  } else {
    console.log('open', id);
    if ( !id )	{
      status.state = 'new';
      window.history.pushState(
        status, "", `/task/new`);
    } else {
      status.state = 'entry';
      window.history.pushState(
        status, "", `/task/entry/${id}`);
    }
  }
}

const computeTax = (event) => {
  console.log('computeTax');
  switch	(parseInt(transaction.taxClass))	{
    case	0:
    	transaction.tax = 0;
      break;
    case	1:
    	transaction.tax = Math.round(sum / 110 * 10);
    	transaction.amount = sum;
      break;
    case	2:
    	transaction.tax = Math.round(sum * 0.1);
    	transaction.amount = sum + transaction.tax;
      break;
    case  9:
    	transaction.amount = sum + parseInt(transaction.tax);
    	break;
  }
}

onMount(() => {
  console.log('transaction-info onMount', status);
  if	( transaction.id )	{
    customerKey = transaction.customerName;
  } else {
    customerKey = '';
  }
  axios.get(`/api/customer/`).then((result) => {
    original_customers = result.data;
    console.log('customer update', original_customers);
  });
  eventBus.on('taskSelected', (task) => {
    console.log('taskSelected', {task});
    transaction = getStore(currentTransaction);
    if	( transaction )	{
    	transaction.task = task;
    	transaction.taskId = task.id;
      currentTransaction.set(transaction);
    }
    console.log('transaction', transaction);
	})
});

</script>
