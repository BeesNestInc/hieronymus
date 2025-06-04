<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>品目一覧</h1>
    <button type="button" class="btn btn-primary"
      on:click={() => {
        openItem(null);
      }}
      id="item-info">品目入力&nbsp;<i class="bi bi-pencil-square"></i></button>
  </div>
  <div class="full-height fontsize-12pt">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 150px;">
            クラス
          </th>
          <th scope="col" style="width: 150px;">
            検索キー
          </th>
          <th scope="col" style="width: 150px;">
            サムネイル
          </th>
          <th scope="col" style="width: 150px;">
            商品名 / 公的コード
          </th>
          <th scope="col">
            規格
          </th>
          <th scope="col" style="width: 80px;">
            単位
          </th>
          <th scope="col" style="width: 110px;">
            単価
          </th>
        </tr>
        <tr>
          <th style="padding:5px;">
            <select class="form-select" id="itemClass"
              on:input={(event) => { dispatch('selectItemClass', event.currentTarget.value) }}
              bind:value={itemClassId}>
              <option value="-1">全て</option>
              {#each itemClasses as line}
              <option value={line.id}>{line.name}</option>
              {/each}
            </select>
          </th>
          <th style="padding:5px;">
            <input type="text" class="form-control"
              bind:value={key}
              on:input={() => { dispatch('keyInput', key)}}
            />
          </th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each items as line}
        <tr>
          <td>
            {line.itemClass.name}
          </td>
          <td>
            {line.key}
          </td>
          <td>
            {#if line.document && line.document.files && line.document.files.length > 0 }
            <button type="button" class="btn btn-link"
              on:click={() => {
                openItem(line.id);
              }}>
              <img src="/api/document/file/{line.document.files[0].id}"
                style="width:180px;" alt="thumb">
            </button>
            {/if}
          </td>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
                openItem(line.id);
              }}>
              {line.name || '____'}<br/>
              {line.globalCode || ''}
            </button>
          </td>
          <td>
            {line.spec || ''}
          </td>
          <td>
            {line.unit || ''}
          </td>
          <td class="number">
            {numeric(line.standardPrice).toLocaleString()}<br/>
            {numeric(line.costPrice).toLocaleString()}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script>
import axios from 'axios';
import {numeric} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export	let	items;
export  let status;

let itemClassId;
let itemClasses = [];
let key = '';

onMount(() => {
  axios.get('/api/item/classes').then((result) => {
    console.log(result);
    itemClasses = result.data.values;
  })
})
beforeUpdate(() => {
  //console.log('item-list beforeUpdate');
});

const openItem = (id) => {
  let	item;
  if  ( id )  {
    for ( let i = 0; i < items.length; i ++ ) {
      if ( items[i].id == id ) {
        item = items[i];
        break;
      }
    }
  }
  dispatch('open', item);
}
</script>
