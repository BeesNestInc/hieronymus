<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>品目情報</h1>
  </div> 
  <div class="row full-height fontsize-12pt">
    <div class="content">
      <div class="body">
        {#if !ok }
        <div class="border rounded border-danger mb-3 ms-2 me-2 p-3">
          <h5 class="fs-5 text-danger"><i class="bi bi-exclamation-triangle-fill"></i>&nbsp;エラー</h5>
          <ul>
          <FormError
        	  messages={errorMessages}></FormError>
          </ul>
        </div>
        {/if}
        <ItemInfo
          bind:files={files}
          bind:item={item}
          bind:status={status} />
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={back}>もどる</button>
        {#if ( item && item.id && item.id > 0 )}
        <button type="button" class="btn btn-danger" disabled={disabled}
          on:click={deleteItem}
          id="delete-button">削除</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={save}
          id="save-button">保存</button>
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
import {numeric, formatDate} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import ItemInfo from './item-info.svelte';
import OkModal from '../common/ok-modal.svelte';
import {bindFile} from '../../javascripts/document';
import {currentItem, getStore} from '../../javascripts/current-record.js'
import eventBus from '../../javascripts/event-bus.js';
import FormError from '../common/form-error.svelte';

export let status;
export let item;

let disabled = false;
let errorMessages = [];
let ok = true;
let files;

let modal;
let title;
let description;
let operation = () => {};

const create_item = async (_item) => {
  let result = await axios.post('/api/item', _item);
  console.log('create', result);
  return	(result);
}
const update_item = async (_item) => {
  console.log('save_item', _item);
  let result = await axios.put('/api/item', _item);
     
  console.log(result);
  return	(result);
}

const deleteItem = (event) => {
  console.log('deleteItem', item);
  title = '品目の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
			<td>種別</td><td>${item.itemClass.name}</td>
		</tr>
    <tr>
			<td>一般名</td><td>${item.name}</td>
		</tr>
    <tr>
			<td>正式名</td><td>${item.normalName}</td>
		</tr>
    <tr>
			<td>規格</td><td>${item.spec}</td>
    </tr>
  </tbody>
`;
  operation = doDelete;
  modal.show();
}

const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
  		let result = await axios.delete(`/api/item/${item.id}`);
  		console.log(result);
    	back();
  	} catch (e) {
	    console.log(e);
  	}
  }
}

const save = () => {
  console.log('item', item);
  ok = true;
  errorMessages = [];
  if	( item.itemClassId )	{
    item.itemClassId = parseInt(item.itemClassId);
  } else {
    ok = false;
    errorMessages.push('種別が未入力です')
  }
  if  (( !item.key ) ||
       ( item.key === ''))  {
    ok = false;
    errorMessages.push("呼び出しキーが未入力です。");
  }
  if  ( !ok )  {
    errorMessages = errorMessages;
    return;
  }
  if	( item.standardPrice )	{
    item.standardPrice = numeric(item.standardPrice);
  }
  if	( item.costPrice )	{
    item.costPrice = numeric(item.costPrice);
  }
  item.taxClass = parseInt(item.taxClass);
  console.log('input', item);
  try {
    let	it;
    let create = false;
    if ( item.id  ) {
      item.id = parseInt(item.id);
      it = update_item(item);
    } else {
      it = create_item(item);
      create = true;
    }
    it.then((result) => {
      //console.log('result', result);
      if  ( !result.data.code ) {
        item = result.data.item;
        bindFile(files, item.documentId);
      }
      if  ( create )  {
        window.history.replaceState(
          status, "", `/item/entry/${item.id}`);
      }
    });
  }
  catch(e) {
    console.log(e);
    // can't save
    //	TODO alert
  }
};


const	back = (event) => {
  dispatch('close');
  currentItem.set(null);
  errorMessages = [];
  window.history.back();
}

beforeUpdate(() => {
  console.log('item-entry beforeUpdate', item);
});

onMount(() => {
  console.log('item-entry onMount', status);
})

</script>
