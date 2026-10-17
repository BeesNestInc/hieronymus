<div class="page-title d-flex justify-content-between">
  <h1>{kind === 'payee' ? '設定（支払先マッピング）' : '設定（出金元マッピング）'}</h1>
</div>
<div class="full-height-1">
  <div style="padding:10px;">
    <TableMaintenance
      card={false}
      title={kind === 'payee' ? '支払先マッピング' : '出金元マッピング'}
      endpoint={`/api/expense_mapping/${kind}`}
      accounts={accounts}
      bind:minimize={minimize}
      initialRow={initialRow}
      columns={columnsForKind}>
    </TableMaintenance>
    {#if ( kind === 'payee' )}
    <p class="text-muted px-2" style="font-size:0.75rem;">
      説明は同じ取引先で仕訳を変えるときのヒントです（例: 書籍,本）。
      空欄のマッピングはデフォルトとして使われます。
    </p>
    {:else}
    <p class="text-muted px-2" style="font-size:0.75rem;">
      立替にチェックを入れると、精算書承認時に提出者の仮払金補助が使われます
      （マッピング名に立替者名がある場合はそちらが優先されます）。
    </p>
    {/if}
  </div>
</div>
<script>
import {onMount} from 'svelte';
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';
import {setAccounts} from '../../javascripts/cross-slip';

export let status;
export let kind = 'payee';

let minimize = false;
let accounts = [];

// 支払先マッピングの初期値付き遷移用（?payeeCompany=&payeeName=&payeeKey=）。
// 精算書のAI読み取りで未登録だった支払先を、その場で登録できるようにする
let initialRow = null;
$: if ( kind === 'payee' && ( initialRow === null ) ) {
  const params = new URLSearchParams(location.search);
  const company = params.get('payeeCompany');
  const name = params.get('payeeName');
  const key = params.get('payeeKey');
  if ( company || name || key ) {
    initialRow = {};
    if ( company ) initialRow.companyId = parseInt(company);
    if ( name ) initialRow.name = name;
    if ( key ) initialRow.key = key;
  }
}

const payeeColumns = [
  { type: "id", name: 'id'},
  { type: "text", name: 'key', title: "検索キー", width: "120px", align: "left"},
  { type: "text", name: 'name', title: "名前", width: "200px", align: "left"},
  { type: "company", name: 'companyId', title: "取引先"},
  { type: "text", name: 'description', title: "説明", align: "left"},
  { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目", width: "200px"},
  { type: "checkbox", name: 'noBundle', title: "同日まとめない", width: "90px", align: "center"}
];
const paymentColumns = [
  { type: "id", name: 'id'},
  { type: "text", name: 'key', title: "検索キー", width: "120px", align: "left"},
  { type: "text", name: 'name', title: "名前", width: "200px", align: "left"},
  { type: "text", name: 'description', title: "説明", align: "left"},
  { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目", width: "200px"},
  { type: "checkbox", name: 'advance', title: "立替", width: "70px"}
];
$: columnsForKind = ( kind === 'payee' ) ? payeeColumns : paymentColumns;

onMount(() => {
  axios.get('/api/accounts').then((result) => {
    accounts = result.data || [];
    setAccounts(accounts);
  });
});
</script>
