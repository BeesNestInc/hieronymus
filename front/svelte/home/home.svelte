<div class="row">
  {#if ( status.user.accounting && aiAvailable === false )}
  <div class="col-12" style="padding:10px;">
    <MessagePanel level="info"
      messages={["AIの設定がありません。証憑のOCRや明細画像の取り込み、ルール候補のAI提案を使うには、AI管理権限を持つユーザーが「管理」>「設定」の「AI設定」パネルから設定してください。"]}></MessagePanel>
  </div>
  {/if}
</div>
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
  <div class="col-8" style="padding:10px;">
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
  {#if ( status.user.accounting )}
  <div class="col-7" style="padding:10px;">
    <BankPending
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
    <div class="col-6" style="padding:10px;">
      <Backup bind:toast={toast} bind:status={status}/>
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
import BankPending from './bank-pending.svelte';
import MessagePanel from '../components/message-panel.svelte';
import axios from 'axios';
import {link as routerLink} from '../../javascripts/router.js';

export	let	status;
export  let toast;
export  let alert;
export  let alert_level;

let company;
// AIの設定有無（サーバの /api/user が返す。設定が無ければ案内を出す）
let aiAvailable;

const link = (href) => {
  // ページ遷移は router の link（currentPage を更新する）へ委譲する。
  // pushState だけだとURLだけ変わって画面が変わらない
  routerLink(href);
}

beforeUpdate(() => {
  console.log(status);
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
    aiAvailable = res.data.aiAvailable;
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
    if  (( !status.fy ) ||
         ( !status.fy.term )) {
      alert = '期を選択してください。';
      alert_level = 'danger';
    }
  })
})


</script>
    