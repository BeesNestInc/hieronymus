<div class="page-title d-flex justify-content-between">
  <h1>顧客台帳</h1>
  <button type="button" class="btn btn-primary"
    on:click={() => {
      openCustomer(null);
    }}>顧客入力&nbsp;<i class="bi bi-pencil-square"></i></button>
</div>
<div class="fontsize-12pt">
  <table class="table table-bordered">
    <thead>
      <tr>
        <th scope="col" style="width: 200px;">
          名前
        </th>
        <th scope="col" style="width: 150px;">
          種別
        </th>
        <th scope="col" style="width: 100px;">
          郵便番号
        </th>
        <th scope="col">
          住所
        </th>
        <th scope="col" style="width: 120px;">
          電話番号
        </th>
        <th scope="col" style="width: 200px;">
          E-mail
        </th>
        <th scope="col" style="width: 200px;">
          担当者名
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td></td>
        <td>
          <select class="form-select" id="kind"
            on:input={(event) => {
              let value = parseInt(event.currentTarget.value);
              status.params.set('kind', value);
              dispatch('selectKind')
            }}
            value={status.params ? parseInt(status.params.get('kind')) : -1}>
            <option value={-1}>全て</option>
            {#each status.customerClasses as ent}
            <option value={ent.id}>{ent.name}</option>
            {/each}
          </select>
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      {#each customers as line}
      <tr class="fontsize-12pt">
        <td>
          <button type="button" class="btn btn-link"
            on:click={openCustomer} data-no={line.id}>
            {line.name}
          </button>
        </td>
        <td>
          {line.customerClass ? line.customerClass.name : 'その他'}
        </td>
        <td>
          {line.zip}
        </td>
        <td>
          {line.address1}<br/>
          {line.address2}
        </td>
        <td>
          {line.telNo}
        </td>
        <td>
          {line.email}
        </td>
        <td>
          {line.chargeName}
        </td>
      </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
th {
  text-align: center;
}
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export let status;
export let customers;

const openCustomer = (event) => {
  let	customer;
  if  ( event ) {
    let id = event.target.dataset.no;

    //console.log('openCustomer', id);
    //console.log('customers', customers);

    for ( let i = 0; i < customers.length; i ++ ) {
      if ( customers[i].id == id ) {
        customer = customers[i];
        break;
      }
    }
  }
  dispatch('open', customer);
}

onMount(() => {
});
beforeUpdate(() => {
});
</script>
