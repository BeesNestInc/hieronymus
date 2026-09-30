<div class="slip-page">
  <div class="page-title d-flex justify-content-between align-items-center">
    <h1>仕訳明細入力</h1>
    <div>
      <button type="button" class="btn btn-secondary me-2" id="back-button"
        on:click={back}>もどる</button>
      {#if !slipLocked}
      {#if (( !slip ) || ( !slip.no ) ||
          (( !slip.approvedAt ) &&
           (( status.user.accounting ) ||
            ( slip.createdBy == status.user.id ))))}
        <button type="button" class="btn btn-primary" id="save-button"
          on:click={save}>保存</button>
      {/if}
      {/if}
    </div>
  </div>
  {#if !ok }
  <div class="border rounded border-danger mb-2 p-3">
    <h5 class="fs-5 text-danger"><i class="bi bi-exclamation-triangle-fill"></i>&nbsp;エラー</h5>
    <ul>
      {#each errorMessages as errorMessage}
        <li class="text-danger">{errorMessage}</li>
      {/each}
    </ul>
  </div>
  {/if}
  {#if loading}
  <p>読み込み中...</p>
  {:else if slip}
  <div class="row">
    <div class={vouchers ? "col-12 col-xl-8" : "col-12"}>
      <CrossSlip
        bind:slip={slip}
        fy={fy}
        accounts={accounts}
        {taxRules}
        ></CrossSlip>
    </div>
    {#if vouchers}
    <div class="col-12 col-xl-4">
      <h2 class="fs-5">証憑候補（{slip.year}年{slip.month}月{slip.day}日）</h2>
      <div class="voucher-pane" style="overflow-y:auto;max-height:70vh;">
        <table class="table table-striped table-bordered">
          <thead class="table-light">
            <th style="width:20px;">
            </th>
            <th style="width:100px;">
              種別
            </th>
            <th style="width:200px;">
              相手先
            </th>
            <th style="width:100px;">
              金額
            </th>
            <th>
              説明
            </th>
          </thead>
          <tbody>
            {#each vouchers as line}
            <tr
              on:dragstart={onDragStart}
              on:dragend={onDragEnd}
              draggable={ line.details.length > 0  ? "false" : "true" }
              data-id={line.id}>
              <td>
                {#if (line.details.length > 0 )}
                <i class="fas fa-link"></i>
                {/if}
              </td>
              <td>
                {line.voucherClass ? line.voucherClass.name : '__'}
              </td>
              <td>
                {line.company.name}
              </td>
              <td class="number">
                {numeric(line.amount).toLocaleString()}
              </td>
              <td>
                {line.description || ''}
              </td>
            </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {/if}
  </div>
  <div class="d-flex justify-content-between mt-3 mb-5">
    <div>
      {#if slipLocked}
      <span class="text-muted">この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。</span>
      {:else}
      {#if (( !slip ) || ( !slip.no ) ||
          (( !slip.approvedAt ) &&
           (( status.user.accounting ) ||
            ( slip.createdBy == status.user.id )))) }
        <button type="button" class="btn btn-secondary"
          on:click={openVouchers}>証票</button>
      {/if}
      {/if}
    </div>
    <div>
      {#if !slipLocked}
      {#if ( slip && slip.no > 0) }
      {#if ( status.user.approvable )}
        {#if ( slip.approvedAt )}
        <button type="button" class="btn btn-warning me-2" id="disapprove-button"
          on:click={disapprove}>不承認</button>
        {:else}
        <button type="button" class="btn btn-warning me-2" id="approve-button"
          on:click={approve}>承認</button>
        {/if}
      {/if}
      {#if (( status.user.approvable ) || ( slip.createdBy == status.user.id ))}
        {#if ( !slip.approvedAt )}
        <button type="button" class="btn btn-danger me-2" id="delete-button"
          on:click={delete_}>削除</button>
        {/if}
      {/if}
      {/if}
      {#if (( !slip ) || ( !slip.no ) ||
          (( !slip.approvedAt ) &&
           (( status.user.accounting ) ||
            ( slip.createdBy == status.user.id ))))}
        <button type="button" class="btn btn-primary" id="save-button-bottom"
          on:click={save}>保存</button>
      {/if}
      {/if}
    </div>
  </div>
  {/if}
</div>
<style>
.slip-page {
  width: 100%;
}
.slip-page :global(.crossslip table) {
  width: 100%;
}
</style>

<script>
import {numeric, dateStr, DateString} from '../../../libs/utils';
import axios from 'axios';
import {onMount} from 'svelte';
import CrossSlip from './cross-slip.svelte';
import {setAccounts} from '../../javascripts/cross-slip';
import {currentPage, link} from '../../javascripts/router.js';

export let status;

let slip = null;
let accounts = [];
let fy = { taxIncluded: true };
let taxRules = [];
let vouchers;
let ok = true;
let errorMessages = [];
let slipLocked = false;
let loading = true;
let returnTo = null;
let isNew = false;

$: checkPage($currentPage);

const defaultReturnTo = () => {
  if ( slip && slip.year && slip.month ) {
    return `/journal/${slip.year}/${slip.month}`;
  }
  return '/home';
};

const back = () => {
  link(returnTo || defaultReturnTo());
};

const onDragStart = (event) => {
  event.dataTransfer.dropEffect = 'link';
  event.dataTransfer.setData("id", event.currentTarget.dataset.id);
};
const onDragEnd = (event) => {
};

const parsePage = (pageUrl) => {
  const url = new URL(pageUrl || location.href, window.location.origin);
  const args = url.pathname.split('/');
  returnTo = url.searchParams.get('returnTo');
  if ( args[2] === 'new' ) {
    isNew = true;
    return {
      year: parseInt(url.searchParams.get('year')),
      month: parseInt(url.searchParams.get('month')),
      day: parseInt(url.searchParams.get('day'))
    };
  }
  isNew = false;
  return {
    year: parseInt(args[2]),
    month: parseInt(args[3]),
    no: parseInt(args[4])
  };
};

const blankSlip = (year, month, day) => {
  return {
    year: year,
    month: month,
    day: day,
    lines: [{
      debitAccount: "",
      debitSubAccount: 0,
      debitAmount: "",
      debitTax: "",
      creditAccount: "",
      creditSubAccount: 0,
      creditAmount: "",
      creditTax: "",
    }]
  };
};

const loadFyAndTax = async (year, month) => {
  let date;
  if ( year && month ) {
    date = dateStr(year, month);
  } else if ( status.fy && status.fy.startDate ) {
    date = DateString(new Date(status.fy.startDate));
  } else {
    date = DateString(new Date());
  }
  const result = await axios.get(`/api/tax-rule?type=active&date=${date}`);
  taxRules = result.data.values;
  try {
    if ( status.fy && status.fy.term ) {
      fy = {
        ...status.fy,
        startDate: new Date(status.fy.startDate),
        endDate: new Date(status.fy.endDate)
      };
    }
    if ( year && month ) {
      const fyRes = await axios.get(`/api/term/${year}/${month}`);
      if ( fyRes.data ) {
        fy = {
          ...fyRes.data,
          startDate: new Date(fyRes.data.startDate),
          endDate: new Date(fyRes.data.endDate)
        };
        slipLocked = !!( fyRes.data.lockedAt );
      } else {
        slipLocked = !!( status.fy && status.fy.lockedAt );
      }
    } else {
      slipLocked = !!( status.fy && status.fy.lockedAt );
    }
  } catch (e) {
    console.log('fiscal lock check failed', e);
    slipLocked = false;
  }
};

const loadSlip = async (params) => {
  loading = true;
  vouchers = undefined;
  errorMessages = [];
  ok = true;
  if ( params.no ) {
    const result = await axios.get(`/api/cross_slip/${params.year}/${params.month}/${params.no}`);
    const data = result.data;
    slip = {
      year: data.year,
      month: data.month,
      day: data.day,
      no: data.no,
      createdBy: data.createdBy,
      approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
      createrName: data.creater ? data.creater.name : '',
      approverName: data.approver ? data.approver.name : '',
      lines: data.lines
    };
    await loadFyAndTax(slip.year, slip.month);
  } else {
    let year = params.year || status.fy.startDate.getFullYear();
    let month = params.month || (status.fy.startDate.getMonth() + 1);
    let day = params.day || undefined;
    await loadFyAndTax(year, month);
    slip = blankSlip(year, month, day);
    slip.year = year < 100 ? slip.year : year;
  }
  loading = false;
};

const checkPage = (page) => {
  if ( !page ) return;
  if ( !page.match(/^\/slip/) ) return;
  const params = parsePage(page);
  loadSlip(params);
};

onMount(async () => {
  const res = await axios.get(`/api/accounts`);
  accounts = res.data;
  setAccounts(accounts);
  const params = parsePage($currentPage || (location.pathname + location.search));
  await loadSlip(params);
});

const save = (event) => {
  errorMessages = [];
  ok = true;
  let tempDay = slip.day;
  slip.day = parseInt(slip.day);
  if ( ( slip.day )
    && ( slip.day > 0 )
    && ( slip.day <= 31 ) ) {
    slip.term = status.fy.term;
    let sums = {
      debit: 0,
      credit: 0
    };
    for ( let i = 0 ; i < slip.lines.length; i ++ ) {
      if (slip.lines[i].debitAccount === 'sundries') {
        slip.lines[i].debitAccount = null;
      }
      if (slip.lines[i].creditAccount === 'sundries') {
        slip.lines[i].creditAccount = null;
      }
      slip.lines[i].creditAmount = numeric(slip.lines[i].creditAmount);
      slip.lines[i].debitAmount = numeric(slip.lines[i].debitAmount);
      slip.lines[i].creditTax = numeric(slip.lines[i].creditTax);
      slip.lines[i].debitTax = numeric(slip.lines[i].debitTax);
      slip.lines[i].description1 = slip.lines[i].description1 || '';
      slip.lines[i].description2 = slip.lines[i].description2 || '';
      slip.lines[i].debitVoucher = undefined;
      slip.lines[i].creditVoucher = undefined;
      sums.debit += slip.lines[i].debitAmount;
      sums.credit += slip.lines[i].creditAmount;
      if (( !slip.lines[i].debitAccount ) &&
          ( slip.lines[i].debitAmount != 0 ) ) {
        ok = false;
        errorMessages.push(`${i+1}行目 : 借方科目に未登録の勘定科目が入力されています。`);
      }
      if  (( !slip.lines[i].debitAccount ) &&
           ( slip.lines[i].debitAmount != 0 ))  {
        ok = false;
        errorMessages.push(`${i+1}行目 : 借方科目が未入力です。`);
      }
      if  (( !slip.lines[i].creditAccount ) &&
           ( slip.lines[i].creditAmount != 0 )) {
        ok = false;
        errorMessages.push(`${i+1}行目 : 貸方科目が未入力です。`);
      }
    }
    if ( sums.debit != sums.credit ) {
      ok = false;
      errorMessages.push("借方の金額と貸方の合計金額が不一致です。");
    }
  } else {
    ok = false;
    slip.day = tempDay;
    errorMessages.push("日付が正しくありません。");
  }
  if ( ok ) {
    try {
      let pr;
      if ( slip.no  ) {
        pr = axios.put('/api/cross_slip', slip);
      } else {
        pr = axios.post('/api/cross_slip', slip);
      }
      pr.then(() => {
        back();
      }).catch((e) => {
        alert(writeErrorMessage(e));
      });
    } catch(e) {
      console.log(e);
    }
  } else {
    errorMessages = errorMessages;
  }
};

const writeErrorMessage = (e) => {
  if ( e && e.response && e.response.status === 423 ) {
    return 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。';
  }
  if ( e && e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  return '保存に失敗しました。';
};

const delete_ = (event) => {
  try {
    axios.delete('/api/cross_slip', {
      data: {
        year: slip.year,
        month: slip.month,
        day: slip.day,
        no: slip.no
      }
    }).then((result) => {
      back();
    }).catch((e) => {
      alert(writeErrorMessage(e));
    });
  } catch(e) {
    console.log(e);
  }
};

const disapprove = (event) => {
  const prevApprovedAt = slip.approvedAt;
  const prevApproverName = slip.approverName;
  slip.approvedAt = null;
  axios.put('/api/cross_slip/approve', {
    year: slip.year,
    month: slip.month,
    no: slip.no,
    approvedAt: slip.approvedAt
  }).then(() => {
    slip.approverName = undefined;
  }).catch((e) => {
    slip.approvedAt = prevApprovedAt;
    slip.approverName = prevApproverName;
    alert(writeErrorMessage(e));
  })
};
const approve = (event) => {
  const prevApprovedAt = slip.approvedAt;
  slip.approvedAt = new Date();
  axios.put('/api/cross_slip/approve', {
    year: slip.year,
    month: slip.month,
    no: slip.no,
    approvedAt: slip.approvedAt
  }).then(() => {
    slip.approverName = status.user.name;
    back();
  }).catch((e) => {
    slip.approvedAt = prevApprovedAt;
    alert(writeErrorMessage(e));
  })
};

const openVouchers = (event) => {
  if ( vouchers ) {
    vouchers = undefined;
  } else {
    vouchers = [];
    axios.get(`/api/voucher`, {
      params: {
        date: dateStr(slip.year, slip.month, slip.day)
      }
    }).then((result) => {
      vouchers = result.data.vouchers;
    })
  }
};
</script>
