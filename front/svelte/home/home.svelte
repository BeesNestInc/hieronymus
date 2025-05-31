<div class="row" style="padding-top:10px;">
  <div class="col-2">
    {#if !company}
    <button type="button" class="btn btn-warning"
      on:click={() => {
        link(`/company/new?kind=1`);
      }}>
      自社情報の登録
    </button>
    {:else}
    <button type="button" class="btn btn-primary"
      on:click={() => {
        link(`/company/entry/${company.id}`);
      }}>
      自社情報の確認
    </button>
    {/if}
  </div>
</div>
<div class="row">
  <div class="col-7" style="padding:10px;">
    <SelectTerm
      bind:status={status}>
    </SelectTerm>
  </div>
  <div class="col-3" style="padding:10px;">
    {#if ( status.user.accounting || status.user.fiscal_browsing ) }
    <FormPrint
        status={status}>
    </FormPrint>
    {/if}
  </div>
</div>
<div class="row">
  {#if ( status.user.approvable )}
  <div class="col-7" style="padding:10px;">
    <Approve
      bind:status={status}
      bind:toast={toast} />
  </div>
  {/if}
</div>
<div class="row">
  <div class="col-6" style="padding:10px;">
    <Password
      bind:toast={toast}></Password>
  </div>
  {#if ( status.user.administrable) }
    <div class="col-4" style="padding:10px;">
      <Backup bind:toast={toast}/>
    </div>
  {/if}
</div>
<div class="row">
  {#if ( status.user.administrable) }
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'取引先種別'}
      endpoint={'/api/company/kinds'}
      bind:minimize={companyMinimize}
      columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'name', title: "種別名", align: "left"},
  { type: "checkbox", name: 'isClient', title: "顧客", width: "50px"}
]}></TableMaintenance>
  </div>
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'取引文書種別'}
      endpoint={'/api/transaction/kinds'}
      bind:minimize={transactionMinimize}
      columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'label', title: "文書種別名", align: "left"},
  { type: "checkbox", name: 'hasDetails', title: "明細有無", width: "100px"},
  { type: "dropdown", name: 'hasDocument', title: "書類有無", width: "100px",
    source:[
      [0, 'なし'],
      [1, '任意'],
      [2, '必須'],
    ]
  },
  { type: "checkbox", name: 'forCustomer', title: "顧客用", width: "70px"},
  { type: "dropdown", name: 'bookId', title: '作成証憑', width: '200px',
    func: getClasses
  }
]}></TableMaintenance>
  </div>
  {/if}
</div>
<div class="row">
  {#if ( status.user.administrable) }
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'証憑種別'}
      endpoint={'/api/voucher/classes'}
      bind:minimize={voucherMinimize}
      columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'name', title: "種別名", align: "left"},
  { type: "checkbox", name: 'send', title: "差出", width: "50px"},
  { type: "dropdown", name: 'form', title: "プログラム名", width: "150px",
  	source: [
      [ 'invoice', '請求書' ],
    	[ 'receipt', '領収書' ],
      [ 'estimate', '見積書']
    ]
  }
]}></TableMaintenance>
  </div>
  {/if}
  {#if ( status.user.administrable) }
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'品目種別'}
      endpoint={'/api/item/classes'}
      bind:minimize={itemMinimize}
      columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'name', title: "種別名", align: "left"},
  { type: "checkbox", name: 'product', title: "商品", width: "50px"},
  { type: "checkbox", name: 'inventoryManagement', title: "在庫管理", width: "100px"}
]}></TableMaintenance>
  </div>
  {/if}
</div>
<div class="row">
  {#if ( status.user.administrable) }
  <div class="col-6" style="padding:10px;">
    <TableMaintenance
      title={'消費税区分'}
      endpoint={'/api/tax-rule'}
      bind:minimize={taxRuleMinimize}
      columns={[
  { type: "id", name: 'id'},
  { type: "order", name: 'displayOrder'},
  { type: "text", name: 'label', title: "ラベル", align: "left"},
  { type: "dropdown", name: 'taxClass', title: "方式", width: "80px",
  	source: [
      [ 0, '非課税' ],
    	[ 1, '内税' ],
      [ 2, '外税'],
      [ 9, '別計算']
    ]
  },
  { type: "numeric", name: 'rate', title: "税率", width: "50px"},
  { type: "date", name: 'startDate', title: "開始日", width: "110px"},
  { type: "date", name: 'endDate', title: "終了日", width: "110px"}
]}></TableMaintenance>
  </div>
  {/if}
</div>
<script>
import { onMount, beforeUpdate } from "svelte";

import  FormPrint from './form-print.svelte';
import  SelectTerm from './term.svelte';
import Password from './password.svelte';
import Backup from './backup.svelte';
import Approve from './approve.svelte';
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';

export	let	status;
export  let toast;
export  let alert;
export  let alert_level;

let companyMinimize = true;
let transactionMinimize = true;
let voucherMinimize = true;
let itemMinimize = true;
let taxRuleMinimize = true;
let company;

const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
}

beforeUpdate(() => {
  if  (( !status.fy ) ||
       ( !status.fy.term )) {
    alert = '期を選択してください。';
    alert_level = 'danger';
  }
})

onMount(() => {
  console.log('home onMount');
  axios.get('/api/user').then((res) => {
    status.user = res.data.user;
  });
  axios.get('/api/company/?kind=1').then((res) => {
    const companies = res.data.companies;
    if  ( companies.length > 0 )  {
      company = companies[0];
    } else {
      alert = '自社の情報が登録されていません。登録してください。';
      alert_level = 'danger';
    }
    console.log({company});
  })
})

const getClasses = async () => {
  let result = await axios.get('/api/voucher/classes');
  let source = [];
  for ( let value of result.data.values )  {
    source.push([value.id, value.name]);
  }
  return  (source);
}

</script>
    