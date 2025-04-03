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
  <div class="col-6" style="padding:10px;">
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
      endpoint={'/api/customer/kinds'}
      bind:minimize={customerMinimize}
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
  { type: "dropdown", name: 'form', title: "プログラム名", width: "200px",
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

let customerMinimize = true;
let transactionMinimize = true;
let voucherMinimize = true;
let itemMinimize = true;

beforeUpdate(() => {
})

onMount(() => {
  console.log('home onMount');
  axios.get('/api/user').then((res) => {
    status.user = res.data.user;
  });
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
    