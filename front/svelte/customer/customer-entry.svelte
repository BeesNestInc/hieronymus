<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>取引先基本情報</h1>
  </div> 
  <div class="row full-height fontsize-12pt">
    <div class="content">
      <div class="body">
        {#if !ok }
        <div class="border rounded border-danger mb-3 ms-2 me-2 p-3">
          <h5 class="fs-5 text-danger"><i class="bi bi-exclamation-triangle-fill"></i>&nbsp;エラー</h5>
          <ul>
          {#each errorMessages as errorMessage}
            <li class="text-danger">{errorMessage}</li>
          {/each}
          </ul>
        </div>
        {/if}
        <CustomerInfo
        	bind:status={status}
        	bind:customer={customer}></CustomerInfo>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary"
          on:click={back}>もどる</button>
        {#if (customer && customer.id && customer.id > 0)}
        <button type="button" class="btn btn-danger"
          on:click={delete_}>削除</button>
        {/if}
        <button type="button" class="btn btn-primary"
          on:click={save}>保存</button>
      </div>
    </div>
  </div>
</div>
<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={doDelete}
  ></OkModal>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {currentCustomer, getStore} from '../../javascripts/current-record.js'

import CustomerInfo from './customer-info.svelte';
import OkModal from '../common/ok-modal.svelte';

export let status;
export let customer;
export  let inline;

let ok = true;
let errorMessages = [];

let modal;
let title;
let description;

const create_customer = async (customer) => {
  console.log('create_customer', customer);
  let result = await axios.post('/api/customer', customer);

  console.log(result);
}
const update_customer = async (customer) => {
  console.log('save_customer', customer);
  let result = await axios.put('/api/customer', customer);
     
  console.log(result);
}
const delete_customer = async (customer) => {
  title = '顧客情報の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
      <td>名前</td><td>${customer.name}</td>
      <td>種別</td><td>${customer.customerClass.name}</td>
      <td>住所</td><td>${customer.address1}<br>${customer.address2}</td>
      <td>担当者</td><td>${customer.chargeName}</td>
    </tr>
  </tbody>
</table>
`;
	modal.show();
}
const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
      let result = await axios.delete(`/api/customer/${customer.id}`);
  		console.log(result);
    	back();
  	} catch (e) {
	    console.log(e);
  	}
  }
}

const validateForm = () => {
  ok = true;
  errorMessages = [];
  if ( customer.name === undefined ){
    ok = false;
    errorMessages.push("名前が未入力です。");
  }
  if ( customer.name !== undefined && customer.name.trim().length === 0 ){
    ok = false;
    errorMessages.push("名前が未入力です。");
  }
  if ( customer.ruby === undefined ){
    ok = false;
    errorMessages.push("フリガナが未入力です。");
  }
  if ( customer.ruby !== undefined && customer.ruby.trim().length === 0 ){
    ok = false;
    errorMessages.push("フリガナが未入力です。");
  }
  if ( customer.key === undefined ){
    ok = false;
    errorMessages.push("呼び出しキーが未入力です。");
  }
  if ( customer.key !== undefined && customer.key.trim().length === 0 ){
    ok = false;
    errorMessages.push("呼び出しキーが未入力です。");
  }
  errorMessages = errorMessages;
  return ok;
}
const save = (event) => {
  if ( !validateForm() ){
    return ;
  }
  customer.customerClassId = parseInt(customer.customerClassId);
  customer.name = customer.name ? customer.name : '';
  customer.ruby = customer.ruby || '';
  customer.key = customer.key || '';
  customer.zip = customer.zip || '';
  customer.address1 = customer.address1 || '';
  customer.address2 = customer.address2 || '';
  customer.closingDate = customer.closingDate ? parseInt(customer.closingDate) : 0;
  customer.paymentDate = customer.paymentDate ? parseInt(customer.paymentDate) : 0;
  customer.bankName = customer.bankName || '';
  customer.bankBranchName = customer.bankBranchName || '';
  customer.accountType = customer.accountType;
  customer.accountNo = customer.accountNo || '';
  customer.telNo = customer.telNo || '';
  customer.faxNo = customer.faxNo || '';
  customer.email = customer.email || '';
  customer.url = customer.url || '';
  customer.invoiceNo = customer.invoiceNo || '';
  customer.chargeName = customer.chargeName || '';
  customer.description = customer.description || '';
  console.log('input', customer);

  try {
    let	pr;
    let create = false;
    if ( customer.id  ) {
      customer.id = parseInt(customer.id);
      pr = update_customer(customer);
    } else {
      pr = create_customer(customer);
      create = true;
    }
    pr.then(() => {
      if	( create )	{
        window.history.replaceState(
          status, "", `/customer/entry/${customer.id}`);
      }
    });
  } catch(e) {
    console.log(e);
    // can't save
    //	TODO alert
  }
}

const clean = () => {
  customer = undefined;
  ok = true;
  currentCustomer.set(null);
  errorMessages = [];
}

const back = (event) => {
  dispatch('close');
  clean();
  if  ( !inline ) {
    window.history.back();
  }
}

beforeUpdate(() => {
  console.log('beforeUpdate customer-entry', customer);
})

const delete_ = (event) => {
  try {
    console.log('delete');
    delete_customer(customer).then(() => {
      dispatch('save');
      clean();
    });
  }
  catch(e) {
    console.log(e);
    // can't delete
    //	TODO alert
  }
}
</script>
