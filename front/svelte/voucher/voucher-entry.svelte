<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>証憑情報</h1>
  </div> 
  <div class="full-height fontsize-12pt">
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
        <VoucherInfo
          on:startregister={() => { disabled = true} }
          on:endregister={() => { disabled = false} }
          bind:status={status}
          bind:voucher={voucher}
          bind:files={files}></VoucherInfo>
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={close_}
          >もどる</button>
        {#if ( voucher && voucher.id && voucher.id > 0 )}
          <button type="button" class="btn btn-danger" disabled={disabled}
              on:click={delete_}
                  id="delete-button">削除</button>
          <button type="button" class="btn btn-success" disabled={disabled}
            on:click|preventDefault={() => {
              let issueDate = new Date(voucher.issueDate);
              dispatch('open', {
                year: issueDate.getFullYear(),
                month: issueDate.getMonth()+1,
                day: issueDate.getDate()
              });
            }}
            id="slip-button">伝票</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
            on:click={save}
            id="save-button">保存</button>
      </div>
    </div>
  </div>
</div>
<script>
/*
  voucherに関する処理をここで行い、voucher_fileに関する処理をVoucherInfoで行うのは、なんか変である。
  voucher_fileに関する処理もここに移した方が良いかも知れない。
*/
import axios from 'axios';
import {numeric, formatDate} from '../../../libs/utils';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import VoucherInfo from './voucher-info.svelte';
import {currentVoucher, getStore} from '../../javascripts/current-record.js'


export let voucher;
export let status;

let	files;
let ok = true;
let errorMessages = [];
let disabled = false;

const create_voucher = async (_voucher) => {
  let result = await axios.post('/api/voucher', _voucher);
  console.log(result);
  return	(result);
}
const update_voucher = async (_voucher) => {
  console.log('save_voucher', _voucher);
  let result = await axios.put('/api/voucher', _voucher);
     
  console.log(result);
  return	(result);
}
const delete_voucher = async (voucher) => {
  console.log('delete_voucher', voucher);
  let result = await axios.delete('/api/voucher', {
    data: {
      id: voucher.id
    }
  });
  console.log(result);
}
const bind_file = async(file) => {
  console.log('bind_file', file.id, file.voucherId);
  let	result = await axios.put('/api/voucher/bind', {
    id: file.id,
    voucherId: file.voucherId
  });
  return	(result);
}

const validateForm = () => {
  ok = true;
  errorMessages = [];
  if ( voucher.companyId === undefined ) {
    ok = false;
    errorMessages.push("相手先が未入力もしくは、取引先に存在しない相手先が入力されました。");
  }
  return ok;
}
const save = (event) => {
  console.log('voucher', voucher);
  if ( !validateForm() ){
    return ;
  }
  if	( voucher.type )	{
    voucher.type = parseInt(voucher.type);
  }
  if	( voucher.companyId )	{
    voucher.companyId = parseInt(voucher.companyId);
  }
  if	( voucher.amount )	{
    voucher.amount = numeric(voucher.amount);
  }
  if	( voucher.tax )	{
    voucher.tax = numeric(voucher.tax);
  }
  voucher.taxRuleId = parseInt(voucher.taxRuleId);
  voucher.update = undefined;
  voucher.files = undefined;
  console.log('input', voucher);
  try {
    let	pr;
    let create = false;
    console.log(voucher)
    if ( voucher.id  ) {
      voucher.id = parseInt(voucher.id);
      pr = update_voucher(voucher);
    } else {
      pr = create_voucher(voucher);
      create = true;
    }
    pr.then((result) => {
      console.log('result', result);
      let voucher = result.data.voucher;
      if	( files )	{
      	console.log('files', files.length);
      	for	( let i = 0; i < files.length ; i += 1 )	{
        	console.log('voucherId', files[i].voucherId);
        	if	( !files[i].voucherId )	{
          	files[i].voucherId = voucher.id;
          	bind_file(files[i]);
        	}
      	}
      }
      if	( create )	{
        window.history.replaceState(
          status, "", `/voucher/entry/${voucher.id}`);
        axios.get(`/api/voucher/${voucher.id}`).then((result) => {
          voucher = result.data.voucher;
          currentVoucher.set(voucher);
        })
      } else {
        currentVoucher.set(voucher);
      }
    });
  }
  catch(e) {
    console.log(e);
    // can't save
    //	TODO alert
  }
};


const clean_popup = () => {
  files = [];
  ok = true;
  errorMessages = [];
}

const	close_ = (event) => {
  currentVoucher.set(null);
  clean_popup();
  window.history.back();
  dispatch('close');
}

onMount(() => {

})

beforeUpdate(() => {
  console.log('voucher-entry beforeUpdate', voucher);
});

const	delete_ = (event) => {
  try {
    console.log('delete');
    delete_voucher(voucher).then(() => {
      close_();
    });
  }
  catch(e) {
    console.log(e);
    // can't delete
    //	TODO alert
  }
}
</script>
