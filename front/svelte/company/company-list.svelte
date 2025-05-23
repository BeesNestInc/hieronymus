<div class="page-title d-flex justify-content-between">
  <h1>顧客台帳</h1>
  <button type="button" class="btn btn-primary"
    on:click={() => {
      openCompany(null);
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
            {#each companyClasses as ent}
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
      {#each companies as line}
      <tr class="fontsize-12pt">
        <td>
          <button type="button" class="btn btn-link"
            on:click={openCompany} data-no={line.id}>
            {line.name}
          </button>
        </td>
        <td>
          {line.companyClass ? line.companyClass.name : 'その他'}
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
export let companies;

let companyClasses = [];

const openCompany = (event) => {
  let	company;
  if  ( event ) {
    let id = event.target.dataset.no;

    //console.log('openCompany', id);
    //console.log('companies', companies);

    for ( let i = 0; i < companies.length; i ++ ) {
      if ( companies[i].id == id ) {
        company = companies[i];
        break;
      }
    }
  } else {
    company = {};
  }
  dispatch('open', company);
}

onMount(() => {
  console.log('company-list onMount');
  axios.get(`/api/company/kinds`).then((result) => {
    companyClasses = result.data.values;
  });
})
beforeUpdate(() => {
});
</script>
