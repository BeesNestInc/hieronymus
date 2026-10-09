<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  {#if ( accounts.length === 0 )}
  <p>読み込み中...</p>
  {:else}
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <TableMaintenance
        title={'支払先マッピング'}
        endpoint={'/api/expense_mapping/payee'}
        accounts={accounts}
        bind:minimize={payeeMinimize}
        columns={[
          { type: "id", name: 'id'},
          { type: "text", name: 'key', title: "検索キー", width: "90px", align: "left"},
          { type: "text", name: 'name', title: "名前", width: "150px", align: "left"},
          { type: "company", name: 'companyId', title: "取引先"},
          { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目"}
      ]}></TableMaintenance>
    </div>
  </div>
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <TableMaintenance
        title={'出金元マッピング'}
        endpoint={'/api/expense_mapping/payment'}
        accounts={accounts}
        bind:minimize={paymentMinimize}
        columns={[
          { type: "id", name: 'id'},
          { type: "text", name: 'key', title: "検索キー", width: "90px", align: "left"},
          { type: "text", name: 'name', title: "名前", width: "150px", align: "left"},
          { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目"},
          { type: "checkbox", name: 'advance', title: "立替", width: "50px"}
      ]}></TableMaintenance>
    </div>
  </div>
  {/if}
</div>
<script>
import {onMount} from 'svelte';
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';
import {setAccounts} from '../../javascripts/cross-slip';

export let status;

let payeeMinimize = false;
let paymentMinimize = false;
let accounts = [];

onMount(() => {
  axios.get('/api/accounts').then((result) => {
    accounts = result.data || [];
    setAccounts(accounts);
  });
});
</script>
