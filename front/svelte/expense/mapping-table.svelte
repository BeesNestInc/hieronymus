<div class="card">
  <div class="card-header d-flex">
    <h5 class="card-title">{title}</h5>
    <div class="d-flex ms-auto">
      <button type="button" class="btn"
        on:click={() => {
          minimize = !minimize;
        }}>
        {#if minimize}
        <i class="bi bi-square"></i>
        {:else}
        <i class="bi bi-dash-square"></i>
        {/if}
      </button>
    </div>
  </div>
  {#if ( !minimize )}
  <div class="card-body">
    {#if ( accounts.length === 0 )}
    <p>読み込み中...</p>
    {:else}
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 90px;">
            検索キー
          </th>
          <th scope="col" style="width: 150px;">
            名前
          </th>
          {#if ( showCompany )}
          <th scope="col" style="width: 180px;">
            取引先
          </th>
          {/if}
          <th scope="col">
            勘定科目
          </th>
          {#if ( showAdvance )}
          <th scope="col" style="width: 60px;">
            立替
          </th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each table as line}
        <tr style="height:30px;">
          <td style="padding:0;">
            <input type="text" style="width:100%;height:30px;margin:0px;font-size:12pt;"
              class="w-100" bind:value={line.key}/>
          </td>
          <td style="padding:0;">
            <input type="text" style="width:100%;height:30px;margin:0px;font-size:12pt;"
              class="w-100" bind:value={line.name}/>
          </td>
          {#if ( showCompany )}
          <td style="padding:0;">
            <select style="width:100%;height:30px;margin:0px;font-size:12pt;"
              class="w-100" bind:value={line.companyId}>
              <option value={null}></option>
              {#each companies as company}
              <option value={company.id}>{company.name}</option>
              {/each}
            </select>
          </td>
          {/if}
          <td style="padding:0;">
            <Account
              accounts={accounts}
              bind:code={line.account}
              bind:sub_code={line.subAccount}></Account>
          </td>
          {#if ( showAdvance )}
          <td style="text-align:center;">
            <input type="checkbox" bind:checked={line.advance}/>
          </td>
          {/if}
        </tr>
        {/each}
      </tbody>
    </table>
    {/if}
  </div>
  <div class="card-footer">
    <button type="button" class="btn btn-outline-primary"
      on:click|preventDefault={() => {
        table = [...table, {}];
      }}>
      新規
    </button>
    <button type="button" class="btn btn-primary"
      on:click|preventDefault={update}>
      更新
    </button>
    <button type="button" class="btn btn-danger"
      on:click|preventDefault={cancel}>
      取消
    </button>
  </div>
  {/if}
</div>
<script>
import {onMount} from 'svelte';
import axios from 'axios';
import Account from '../cross-slip/account.svelte';
import {setAccounts} from '../../javascripts/cross-slip';

export let kind;
export let title;
export let showCompany;
export let showAdvance;
export let minimize;

let table = [];
let kinds = [];
let accounts = [];
let companies = [];

// 変更があった行だけを差分として送る（spreadsheet.updateList と同じ発想）
const diff = () => {
  const fields = ['key', 'name', 'companyId', 'account', 'subAccount', 'advance'];
  const out = [];
  kinds.forEach((ent) => {
    const found = table.find((v) => ( v.id === ent.id ));
    if ( !found ) {
      out.push({ id: ent.id });
    } else {
      const changed = fields.some((f) => ( ent[f] !== found[f] ));
      if ( changed ) {
        out.push(found);
      }
    }
  });
  table.forEach((v) => {
    if ( !v.id ) {
      out.push(v);
    }
  });
  return out;
};

const update = () => {
  axios.put(`/api/expense_mapping/${kind}`, {
    values: diff()
  }).then((result) => {
    kinds = result.data.values;
    table = structuredClone(kinds);
  });
};

const cancel = () => {
  table = structuredClone(kinds);
}

onMount(() => {
  axios.get(`/api/expense_mapping/${kind}`).then((result) => {
    kinds = result.data.values || [];
    table = structuredClone(kinds);
  });
  axios.get('/api/accounts').then((result) => {
    accounts = result.data || [];
    setAccounts(accounts);
  });
  if ( showCompany ) {
    axios.get('/api/company').then((result) => {
      companies = result.data.companies || [];
    });
  }
})
</script>
