<input type="hidden" id="id" bind:value={transaction.id}>
<div class="container-fluid">
  <div class="row">
    <label for="kind" class="col-1 col-form-label">種別</label>
    <div class="col-2">
      <select class="form-control" id="kind"
        bind:value={transaction.kindId}
        on:change={setKind}>
        <option value={0}> -- 未設定 --</option>
        {#each transactionKinds as ent}
        <option value={ent.id}>{ent.label}</option>
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
  <div class="row mt-3">
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
  <div class="row mt-3">
    <div class="col-1">
      <label class="col-form-label">相手先</label>
      {#if ( transaction.companyId )}
      {#if (companyEditting)}
      <a href="#" on:click|preventDefault={() => {
        companyEditting = false
      }}>
        <i class="bi bi-check"></i>
      </a>
      {:else}
      <a href="#" on:click|preventDefault={() => {
        companyEditting = true
      }}>
        <i class="bi bi-pencil"></i>
      </a>
      {/if}
      {/if}
    </div>
    <div class="col-11">
      {#if (companyEditting || !transaction.companyId )}
      <CustomerSelect
        on:startregister
        on:endregister
        register="true"
        input="input"
        bind:companyId={transaction.companyId}
        bind:companyName={transaction.companyName}
        bind:chargeName={transaction.chargeName}
        bind:zip={transaction.zip}
        bind:address1={transaction.address1}
        bind:address2={transaction.address2}
      />
      {:else}
      <span>{transaction.companyName}</span>
      <button type="button" class="btn btn-warning"
      	on:click={() => {
          transaction.companyId = null;
        }}>
      	変更
    	</button>
  		{/if}
    </div>
  </div>
  <div class="row mt-3">
    <div class="col-1">
      <label for="subject" class="col-form-label">件名</label>
    </div>
    <div class="col-8">
      <div class="row">
        <div class="col-12">
      	  <input type="text" class="form-control" id="subject"
        	  bind:value={transaction.subject} />
        </div>
      </div>
      {#if ( viewTasks )}
      <div class="row mt-3">
        <div class="col-12">
          <select class="form-control"
      		  bind:value={transaction.taskId}
        	  on:blur={() => {
          	  viewTasks = false;
              if	( transaction.taskId )	{
                for	( let i = 0; i < tasks.length; i += 1 )	{
                  console.log(tasks[i].id, transaction.taskId);
                  if	( tasks[i].id === transaction.taskId )	{
                    let task = tasks[i];
                    //console.log('select', task);
                    transaction.task = task;
                    transaction.companyId = task.companyId;
                    transaction.companyName = task.companyName;
                    transaction.chargeName = task.chargeName;
                    transaction.zip = task.zip;
                    transaction.address1 = task.address1;
                    transaction.address2 = task.address2;
                    transaction.subject = task.subject;
                    break;
                  }
                }
              }
        	  }}>
        	  <option value={0}>未選択</option>
        	  {#each tasks as task}
        	  <option value={task.id}>{task.subject}</option>
        	  {/each}
      	  </select>
        </div>
      </div>
      {/if}
    </div>
    <div class="col-3">
      {#if ( transaction.taskId )}
      <button type="button" class="btn btn-warning"
      	on:click={selectTasks}>
        案件選択
      </button>
      <button type="button" class="btn btn-info"
      	on:click={() => {
          openTask(transaction.taskId);
        }}>
        案件参照
      </button>
      {:else}
      <button type="button" class="btn btn-primary"
      	on:click={selectTasks}>
        案件選択
      </button>
      <button type="button" class="btn btn-primary"
      	on:click={() => {
          openTask(null);
        }}>
        案件作成
      </button>
      {/if}
    </div>
  </div>
  <div class="row mt-3">
    <div class="col-1">
    	<label for="handler" class="col-form-label">弊社担当</label>
  	</div>
    <div class="col-3">
      <select id="handler" class="form-control"
        bind:value={transaction.handledBy}>
        <option value={0}> -- 未設定 --</option>
        {#each users as user}
        <option value={user.id}>{user.name}</option>
        {/each}
      </select>
    </div>
  </div>
  {#if ( currentKind && currentKind.hasDetails )}
  <div class="row mt-3">
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
  <div class="row mt-3">
    <label for="paymentMethod" class="col-1 col-form-label">支払方法</label>
    <div class="col-sm-3">
      <input type="text" class="form-control" id="paymentMethod"
        bind:value={transaction.paymentMethod} />
    </div>
  </div>
  <div class="row mt-3">
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
  <div class="row mt-3">
    <label for="amount" class="col-1 col-form-label">金額</label>
    <div class="col-sm-3">
      <input type="text" class="form-control number" id="amount" disabled="true"
        value={transaction.amount.toLocaleString()}>
    </div>
  </div>
  <div class="row mt-3">
    <label for="description" class="col-1 col-form-label">備考</label>
    <div class="col-11">
      <textarea class="form-control" id="description"
        bind:value={transaction.description} />
    </div>
  </div>
  {/if}
  <div class="row mt-3">
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
  <div class="row mt-3">
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

</style>

<script>
import {numeric, TAX_CLASS} from '../../../libs/utils.js';
import {DOCUMENT_KIND} from '../../../libs/transaction-documents.js';
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher, onDestroy, tick} from 'svelte';
import CustomerSelect from '../components/company-select.svelte';
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

let	original_companys;
let companyKey;
let currentKind;
let companyEditting = false;
let documentEditting = false;
let viewDescription = false;
let viewDetail = true;
let viewFiles = false;
let viewTasks = false;
let sum = 0;
let transactionKinds = [];
let tasks = [];

//$: computeTax();

beforeUpdate(() => {
  if	( !currentKind && transaction && transaction.kind )	{
  	currentKind = transaction.kind;
  }
  computeTax();
})

const selectTasks = () => {
  if	( tasks.length === 0 )	{
		axios.get('/api/task').then((result) => {
			tasks = result.data;
    	viewTasks = true;
  	});
  } else {
    viewTasks = true;
  }
}

const setKind = () => {
  for	( let i = 0; i < transactionKinds.length ; i ++ )	{
  	if	( transactionKinds[i].id == transaction.kindId )	{
      currentKind = transactionKinds[i];
      break;
    }
  }
  console.log('kind',{currentKind});
  viewDetail = currentKind.hasDetails;
  switch	( currentKind.hasDocument )	{
    case	0:
      viewDescription = false;
      viewFiles = false;
      documentEditting = false;
      break;
    case	1:
      viewDescription = true;
      viewFiles = true;
      documentEditting = false;
      break;
    case	2:
      viewDescription = true;
    	viewFiles = true;
      documentEditting = true;
      break;
  }
}

const	openTask = (id)	=> {
  console.log('openTask', id);
  if  ( !id )  {
    status.task = {
      issueDate: transaction.issueDate,
      deliveryLimit: transaction.deliveryLimit,
      subject: transaction.subject,
      companyId: transaction.companyId,
      companyName: transaction.companyName,
      chargeName: transaction.chargeName,
      zip: transaction.zip,
      address1: transaction.address1,
      address2: transaction.address2,
      lines: [...transaction.lines],
      taxClass: transaction.taxClass,
      tax: transaction.tax,
      amount: transaction.amount
    };
    currentTransaction.set(transaction);
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
    companyKey = transaction.companyName;
  } else {
    companyKey = '';
  }
  axios.get(`/api/company/`).then((result) => {
    original_companys = result.data;
    console.log('company update', original_companys);
  });
  axios.get(`/api/transaction/kinds`).then((result) => {
    transactionKinds = result.data.values;
    console.log({transactionKinds});
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
