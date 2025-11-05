<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>取引文書(見積/請求/取引情報)</h1>
    {#if transaction?.no}
    <span>管理番号:&nbsp;{transaction.no}</span>
    {:else}
    <span>新規</span>
    {/if}
  </div> 
  <div class="row full-height fontsize-12pt">
    <div class="content">
      <div class="body">
        <FormError
        	messages={errorMessages}></FormError>
        <TransactionInfo
          on:startregister={() => { disabled = true}}
          on:endregister={() => { disabled = false}}
          bind:status={status}
          bind:transaction={transaction}
          users={users}
          bind:files={files}
          ></TransactionInfo>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={back}>もどる</button>
        {#if ( transaction && transaction.id && transaction.id > 0 )}
        <button type="button" class="btn btn-danger" disabled={disabled}
          on:click={deleteTransaction}
          id="delete-button">削除</button>
        <button type="button" class="btn btn-info" disabled={disabled}
          on:click={() => {
              transaction.id = undefined;
              transaction.no = undefined;
              save()
            }
          }
          id="create-button">複製</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={save}
          id="save-button">保存</button>
        {#if ( transaction && transaction.id && transaction.id > 0 )}
        {#if ( transaction.kind.book && transaction.kind.book.form )}
        <a href="/forms/transaction/{transaction.kind.book.form}/{transaction.id}"
        	class="btn btn-info" target="_blank" disabled={disabled}>
          {transaction.kind.label}書作成
          <Icon icon="mdi:language-html5" width="24" color="#E34F26" />
        </a>
        <a href="/forms/transaction/{transaction.kind.book.form}/{transaction.id}?format=pdf"
        	class="btn btn-info" target="_blank" disabled={disabled}>
          {transaction.kind.label}書作成
          <Icon icon="mdi:file-pdf-box" width="24" color="#D32F2F" />
        </a>
        {#if (transaction.voucherId)}
        <button type="button" class="btn btn-info" disabled={disabled}
          on:click={() => {
            link(`/voucher/entry/${transaction.voucherId}`)
          }
        }>証票参照</button>
        {:else}
        {#if ( transaction.kind.forBook )}
        <button type="button" class="btn btn-info" disabled={disabled}
          on:click={book}
          >計上</button>
        {/if}
        {/if}
        {/if}
        {/if}
      </div>
    </div>
  </div>
</div>
<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={operation}
  ></OkModal>
<script>
import axios from 'axios';
import Icon from '@iconify/svelte';
import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate} from 'svelte';
import TransactionInfo from './transaction-info.svelte';
import FormError from '../common/form-error.svelte';
import OkModal from '../common/ok-modal.svelte';
import {currentTransaction, currentTask, getStore} from '../../javascripts/current-record.js';
import {bindFile} from '../../javascripts/document.js';
import { link } from '../../javascripts/router.js';

export	let	status;
export let toast;
export	let transaction;
export	let users;

let disabled = false;
let errorMessages = [];
let files;

let modal;
let title;
let description;
let operation = () => {};

const book = (event) => {
  axios.post(`/api/transaction/book/${transaction.id}`).then((result) => {
    toast.show(`${transaction.kind.label}書`, '計上しました');
    axios.get(`/api/transaction/${transaction.id}`).then((result) => {
      transaction = result.data.transaction;
    });
  })
}
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

const deleteTransaction = (event) => {
  console.log('deleteTransaction', transaction);
  title = '取引の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
			<td>相手先</td><td>${transaction.companyName || ''}</td>
		</tr>
    <tr>
			<td>件名</td><td>${transaction.subject || ''}</td>
		</tr>
    <tr>
			<td>担当</td><td>${transaction.handleUser.member.tradingName || ''}</td>
    </tr>
  </tbody>
</table>
`;
  operation = doDelete;
  modal.show();
}

const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
      let result = await axios.delete(`/api/transaction/${transaction.id}`);
  		console.log(result);
    	back();
  	} catch (e) {
	    console.log(e);
  	}
  }
}

const save = () => {
  errorMessages = [];
  let ok = true;
  console.log('input', transaction);
  if	( transaction.companyId )	{
    transaction.companyId = parseInt(transaction.companyId);
  }
  if	( transaction.amount )	{
    transaction.amount = numeric(transaction.amount);
  }
  if	( transaction.tax )	{
    transaction.tax = numeric(transaction.tax);
  }
  transaction.taxClass = parseInt(transaction.taxClass);
  console.log('kind', transaction.kindId);
  if  ( (!transaction.kindId) || (transaction.kindId == 0) )	{
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
      	if  ( !result.data.code ) {
        	let id = result.data.id;
          let documentId = result.data.documentId;
          //console.log({documentId});
          bindFile(files, documentId);
          axios.get(`/api/transaction/${id}`).then((result) => {
        		console.log('new load', result.data);
        		transaction = result.data.transaction;
        		currentTransaction.set(transaction);
				    if	( create )	{
        	    link(`/transaction/entry/${transaction.id}`);
      	    } else {
              currentTransaction.set(transaction);
            }
          });
        } else {
          errorMessages.push('保存できませんでした。');
          errorMessages = errorMessages;
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
  currentTransaction.set(null);
  errorMessages = [];
  const task = getStore(currentTask);
  if (task && task.id) {
    link(`/task/entry/${task.id}`);
  } else {
    link('/transaction');
  }
}

const makeVoucher = (event) => {

}

beforeUpdate(() => {
});

</script>
