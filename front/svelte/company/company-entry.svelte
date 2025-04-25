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
        <CompanyInfo
        	bind:status={status}
        	bind:company={company}></CompanyInfo>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary"
          on:click={back}>もどる</button>
        {#if (company && company.id && company.id > 0)}
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
import {currentCompany, getStore} from '../../javascripts/current-record.js'

import CompanyInfo from './company-info.svelte';
import OkModal from '../common/ok-modal.svelte';

export let status;
export let company;
export  let inline;

let ok = true;
let errorMessages = [];

let modal;
let title;
let description;

const create_company = async (company) => {
  console.log('create_company', company);
  let result = await axios.post('/api/company', company);

  console.log(result);
}
const update_company = async (company) => {
  console.log('save_company', company);
  let result = await axios.put('/api/company', company);
     
  console.log(result);
}
const delete_company = async (company) => {
  title = '顧客情報の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
      <td>名前</td><td>${company.name}</td>
      <td>種別</td><td>${company.companyClass.name}</td>
      <td>住所</td><td>${company.address1}<br>${company.address2}</td>
      <td>担当者</td><td>${company.chargeName}</td>
    </tr>
  </tbody>
</table>
`;
	modal.show();
}
const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
      let result = await axios.delete(`/api/company/${company.id}`);
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
  if ( company.name === undefined ){
    ok = false;
    errorMessages.push("名前が未入力です。");
  }
  if ( company.name !== undefined && company.name.trim().length === 0 ){
    ok = false;
    errorMessages.push("名前が未入力です。");
  }
  if ( company.ruby === undefined ){
    ok = false;
    errorMessages.push("フリガナが未入力です。");
  }
  if ( company.ruby !== undefined && company.ruby.trim().length === 0 ){
    ok = false;
    errorMessages.push("フリガナが未入力です。");
  }
  if ( company.key === undefined ){
    ok = false;
    errorMessages.push("呼び出しキーが未入力です。");
  }
  if ( company.key !== undefined && company.key.trim().length === 0 ){
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
  company.companyClassId = parseInt(company.companyClassId);
  company.name = company.name ? company.name : '';
  company.ruby = company.ruby || '';
  company.key = company.key || '';
  company.zip = company.zip || '';
  company.address1 = company.address1 || '';
  company.address2 = company.address2 || '';
  company.closingDate = company.closingDate ? parseInt(company.closingDate) : 0;
  company.paymentDate = company.paymentDate ? parseInt(company.paymentDate) : 0;
  company.bankName = company.bankName || '';
  company.bankBranchName = company.bankBranchName || '';
  company.accountType = company.accountType;
  company.accountNo = company.accountNo || '';
  company.telNo = company.telNo || '';
  company.faxNo = company.faxNo || '';
  company.email = company.email || '';
  company.url = company.url || '';
  company.invoiceNo = company.invoiceNo || '';
  company.chargeName = company.chargeName || '';
  company.description = company.description || '';
  console.log('input', company);

  try {
    let	pr;
    let create = false;
    if ( company.id  ) {
      company.id = parseInt(company.id);
      pr = update_company(company);
    } else {
      pr = create_company(company);
      create = true;
    }
    pr.then(() => {
      if	( create )	{
        window.history.replaceState(
          status, "", `/company/entry/${company.id}`);
      }
    });
  } catch(e) {
    console.log(e);
    // can't save
    //	TODO alert
  }
}

const clean = () => {
  company = undefined;
  ok = true;
  currentCompany.set(null);
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
  console.log('beforeUpdate company-entry', company);
})

const delete_ = (event) => {
  try {
    console.log('delete');
    delete_company(company).then(() => {
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
