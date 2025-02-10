<div class="entry">
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <div class="container-fluid">
      <h5 class="entry-title">取引文書(見積/請求/取引情報)</h5>
      {#if transaction.no}
      <span>管理番号:&nbsp;{transaction.no}</span>
      {:else}
      <span>新規</span>
      {/if}
    </div> 
  </nav>
  <div class="row full-height fontsize-12pt">
    <div class="entry-content">
      <div class="entry-body">
        <FormError
        	messages={errorMessages}></FormError>
        <TransactionInfo
          on:startregister={() => { disabled = true}}
          on:endregister={() => { disabled = false}}
          users={users}
          bind:transaction={transaction}
          bind:status={status}></TransactionInfo>
      </div>
      <div class="entry-footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={back}>もどる</button>
        {#if ( transaction && transaction.id && transaction.id > 0 )}
        <button type="button" class="btn btn-danger" disabled={disabled}
          on:click={delete_}
          id="delete-button">削除</button>
        <button type="button" class="btn btn-info" disabled={disabled}
          on:click={() => {
              transaction.id = undefined;
              save()
            }
          }
          id="create-button">複製</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={save}
          id="save-button">保存</button>
      </div>
    </div>
  </div>
</div>
<script>
import axios from 'axios';
import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import TransactionInfo from './transaction-info.svelte';
import FormError from '../common/form-error.svelte';
import {currentTransaction} from '../../javascripts/current-record.js'
import {bindFile} from '../../javascripts/document.js';

export	let	status;
export	let transaction;
export	let users;

let update;
let disabled = false;
let errorMessages = [];
let files;

const create_transaction = async (_transaction) => {
  let result = await axios.post('/api/transaction', _transaction);
  console.log(result);
  return	(result);
}
const update_transaction = async (_transaction) => {
  console.log('save_transaction', _transaction);
  let result = await axios.put('/api/transaction', _transaction);
     
  console.log(result);
  return	(result);
}
const delete_transaction = async (transaction) => {
  console.log('delete_transaction', transaction);
  let result = await axios.delete(`/api/transaction/${transaction.id}`);
  console.log(result);
}

const save = () => {
  errorMessages = [];
  let ok = true;
  console.log('input', transaction);
  if	( transaction.customerId )	{
    transaction.customerId = parseInt(transaction.customerId);
  }
  if	( transaction.amount )	{
    transaction.amount = numeric(transaction.amount);
  }
  if	( transaction.tax )	{
    transaction.tax = numeric(transaction.tax);
  }
  transaction.taxClass = parseInt(transaction.taxClass);
  console.log('kind', transaction.kind);
  if  ( (!transaction.kind) || (transaction.kind == 0) )	{
    ok = false;
    errorMessages.push('種別を入力してください。');
  }
  if  ( !transaction.handledBy )	{
    ok = false;
    errorMessages.push('弊社担当を入力してください。');
  }
  console.log({ok}, {errorMessages});
  if	( ok )	{
  	try {
    	let	pr;
    	let create = false;
    	if ( transaction.id  ) {
      	transaction.id = parseInt(transaction.id);
      	pr = update_transaction(transaction);
    	} else {
      	pr = create_transaction(transaction);
      	create = true;
    	}
    	pr.then((result) => {
      	console.log('result', result);
      	update = true;
      	if  ( !result.data.code ) {
        	transaction = result.data.transaction;
          bindFile(files,transaction.documentId);
      	}
				if	( create )	{
        	window.history.replaceState(
          	status, "", `/transaction/entry/${transaction.id}`);
          axios(`/api/transaction/${transaction.id}`).then((result) => {
        		console.log('new load', result.data);
        		transaction = result.data.transaction;
        		currentTransaction.set(transaction);
          });
      	} else {
          currentTransaction.set(transaction);
        }
    	});
  	}
  	catch(e) {
    	console.log(e);
    	// can't save
    	//	TODO alert
  	}
  }
};

const	back = (event) => {
  dispatch('close');
  currentTransaction.set(null);
  errorMessages = [];
  window.history.back();
}

beforeUpdate(() => {
  //console.log('transaction-entry beforeUpdate', transaction);
  update = false;
});

const	delete_ = (event) => {
  try {
    console.log('delete');
    delete_transaction(transaction).then(() => {
      back();
    });
  }
  catch(e) {
    console.log(e);
    // can't delete
    //	TODO alert
  }
}
</script>
