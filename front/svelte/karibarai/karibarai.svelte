<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>仮払金精算</h1>
  </div>
  {#if !ok }
  <div class="border rounded border-danger mb-3 ms-2 me-2 p-3">
    <h5 class="fs-5 text-danger"><i class="bi bi-exclamation-triangle-fill"></i>&nbsp;エラー</h5>
    <ul>
      {#each errorMessages as errorMessage}
        <li class="text-danger">{errorMessage}</li>
      {/each}
    </ul>
  </div>
  {/if}
  <div class="full-height-2 fontsize-12pt">
    <div class="container-fluid">
      <h2 class="fs-5">仮払金の残高（立替者別）</h2>
      <div class="col-8">
      <table class="table table-bordered">
        <thead class="table-light">
          <tr>
            <th scope="col">
              立替者
            </th>
            <th scope="col" style="width: 120px;">
              借方
            </th>
            <th scope="col" style="width: 120px;">
              貸方
            </th>
            <th scope="col" style="width: 120px;">
              残高
            </th>
          </tr>
        </thead>
        <tbody>
          {#each subs as sub, i}
          <tr>
            <td>
              {sub.name}
            </td>
            <td class="number">
              {sub.debit ? sub.debit.toLocaleString() : ''}
            </td>
            <td class="number">
              {sub.credit ? sub.credit.toLocaleString() : ''}
            </td>
            <td class="number">
              {sub.balance ? sub.balance.toLocaleString() : ''}
            </td>
          </tr>
          {/each}
          <tr>
            <td>
              合計
            </td>
            <td class="number">
              {total.debit ? total.debit.toLocaleString() : ''}
            </td>
            <td class="number">
              {total.credit ? total.credit.toLocaleString() : ''}
            </td>
            <td class="number">
              {total.balance ? total.balance.toLocaleString() : ''}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <div class="container-fluid mt-4">
      <h2 class="fs-5">精算</h2>
      <div class="row mb-3">
        <div class="col-3 input-group">
          <input type="text" autocomplete="off" class="number" size="2" maxlength="5"
            bind:value={settlementYear}>
          <span class="input-group-text">年</span>
          <input type="text" autocomplete="off" class="number" size="2" maxlength="3"
            bind:value={settlementMonth}>
          <span class="input-group-text">月</span>
          <input type="text" autocomplete="off" class="number" size="2" maxlength="3"
            bind:value={settlementDay}>
          <span class="input-group-text">日</span>
        </div>
      </div>
      <table class="table table-striped table-bordered">
        <thead class="table-light">
          <tr>
            <th scope="col" style="width: 200px;">
              立替者
            </th>
            <th scope="col" style="width: 220px;">
              方向
            </th>
            <th scope="col">
              相手科目
            </th>
            <th scope="col" style="width: 120px;">
              金額
            </th>
            <th scope="col" style="width: 74px;"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i}
          <tr>
            <td class="input">
              <select class="form-select form-select-sm"
                bind:value={row.subAccountCode}>
                <option value=""></option>
                {#each subs as sub}
                {#if ( sub.code )}
                <option value={sub.code}>{sub.name}</option>
                {/if}
                {/each}
              </select>
            </td>
            <td class="input">
              <div class="d-flex align-items-center">
                <div class="form-check me-4">
                  <input type="radio" class="form-check-input" name="direction-{i}"
                    id="repay-{i}" value="repay" bind:group={row.direction}>
                  <label class="form-check-label" for="repay-{i}">返す</label>
                </div>
                <div class="form-check">
                  <input type="radio" class="form-check-input" name="direction-{i}"
                    id="receive-{i}" value="receive" bind:group={row.direction}>
                  <label class="form-check-label" for="receive-{i}">もらう</label>
                </div>
              </div>
            </td>
            <td class="input">
              <Account
                accounts={accounts}
                bind:code={row.account}
                bind:sub_code={row.subAccount}></Account>
            </td>
            <td class="number input">
              <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
                bind:value={row.amount}>
            </td>
            <td style="text-align:center;">
              <button type="button" class="btn btn-primary btn-sm"
                on:click={() => { rows.splice(i + 1, 0, blankRow()); rows = rows; }}>
                <i class="bi bi-plus"></i>
              </button>
              {#if ( rows.length > 1 )}
              <button type="button" class="btn btn-danger btn-sm"
                on:click={() => { rows.splice(i, 1); rows = rows; }}>
                <i class="bi bi-dash"></i>
              </button>
              {/if}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
      <div class="text-muted" style="font-size:0.875rem;">
        「返す」= 会社から立替者へ精算する（仮払金 → 出金元）。<br/>
        「もらう」= 立替者から会社へ返納する（入金先 → 仮払金）。
      </div>
    </div>
  </div>
  <div class="d-flex justify-content-between mt-3 mb-5">
    <div>
    </div>
    <div>
      <button type="button" class="btn btn-primary"
        on:click={book} id="book-button">起票</button>
    </div>
  </div>
</div>

<style>
</style>

<script>
import axios from 'axios';
import {numeric} from '../../../libs/utils';
import {onMount, createEventDispatcher} from 'svelte';
import Account from '../cross-slip/account.svelte';
import {link} from '../../javascripts/router.js';
import {setAccounts} from '../../javascripts/cross-slip';

export let status;

// 仮払金の科目コード（仕訳パターン・accounts.csv の既定）
const KARIBARAI_CODE = '1130000';

let accounts = [];
let karibaraiSubs = [];
let subs = [];
let total = { debit: 0, credit: 0, balance: 0 };
let rows = [];
let ok = true;
let errorMessages = [];
let settlementYear;
let settlementMonth;
let settlementDay;

const blankRow = () => {
  return {
    subAccountCode: '',
    direction: 'repay',
    account: '',
    subAccount: 0,
    amount: ''
  };
};

const loadBalances = async () => {
  const balances = await Promise.all(
    karibaraiSubs.map((sub) => {
      return axios.get(`/api/remaining/${status.fy.term}/${KARIBARAI_CODE}/${sub.code}`)
        .then((result) => {
          return {
            name: sub.name,
            code: sub.code,
            debit: result.data ? Number(result.data.debit) : 0,
            credit: result.data ? Number(result.data.credit) : 0,
            balance: result.data ? Number(result.data.balance) : 0
          };
        })
        .catch(() => {
          return {
            name: sub.name,
            code: sub.code,
            debit: 0,
            credit: 0,
            balance: 0
          };
        });
    })
  );
  subs = balances;
  let debit = 0;
  let credit = 0;
  for ( const sub of subs ) {
    debit += sub.debit;
    credit += sub.credit;
  }
  total = { debit: debit, credit: credit, balance: debit - credit };
};

const validateForm = () => {
  ok = true;
  errorMessages = [];
  if (( !settlementYear ) || ( !settlementMonth ) || ( !settlementDay ) ||
      ( settlementDay < 1 ) || ( settlementDay > 31 )) {
    ok = false;
    errorMessages.push('精算日が正しくありません。');
  }
  let sum = 0;
  for ( let i = 0; i < rows.length; i ++ ) {
    const row = rows[i];
    if ( !row.amount ) {
      continue;
    }
    sum += numeric(row.amount);
    if ( !row.subAccountCode ) {
      ok = false;
      errorMessages.push(`${i + 1}行目 : 立替者が未選択です。`);
    }
    if ( !row.account ) {
      ok = false;
      errorMessages.push(`${i + 1}行目 : 相手科目が未入力です。`);
    }
  }
  if ( sum === 0 ) {
    ok = false;
    errorMessages.push('金額の入力された精算行がありません。');
  }
  return ok;
};

const book = async (event) => {
  if ( !validateForm() ) {
    errorMessages = errorMessages;
    return;
  }
  const lines = [];
  for ( const row of rows ) {
    if ( !row.amount ) {
      continue;
    }
    const amount = numeric(row.amount);
    // 「返す」: 借方=仮払金/立替者、貸方=相手科目（出金元）
    // 「もらう」: 借方=相手科目（入金先）、貸方=仮払金/立替者
    const karibaraiSide = {
      account: KARIBARAI_CODE,
      subAccount: parseInt(row.subAccountCode),
      amount: amount,
      tax: 0
    };
    const oppositeSide = {
      account: row.account,
      subAccount: row.subAccount || undefined,
      amount: amount,
      tax: 0
    };
    lines.push({
      ...( row.direction === 'repay' ) ? {
        debitAccount: karibaraiSide.account,
        debitSubAccount: karibaraiSide.subAccount,
        debitAmount: karibaraiSide.amount,
        debitTax: 0,
        creditAccount: oppositeSide.account,
        creditSubAccount: oppositeSide.subAccount,
        creditAmount: oppositeSide.amount,
        creditTax: 0
      } : {
        debitAccount: oppositeSide.account,
        debitSubAccount: oppositeSide.subAccount,
        debitAmount: oppositeSide.amount,
        debitTax: 0,
        creditAccount: karibaraiSide.account,
        creditSubAccount: karibaraiSide.subAccount,
        creditAmount: karibaraiSide.amount,
        creditTax: 0
      },
      application1: `仮払精算（${row.direction === 'repay' ? '返す' : 'もらう'}）`
    });
  }
  try {
    await axios.post('/api/cross_slip', {
      year: parseInt(settlementYear),
      month: parseInt(settlementMonth),
      day: parseInt(settlementDay),
      lines: lines
    });
    ok = true;
    errorMessages = [];
    await loadBalances();
    link(`/journal/${settlementYear}/${settlementMonth}`);
  } catch (e) {
    ok = false;
    errorMessages = [errMsg(e)];
  }
};

const errMsg = (e) => {
  if ( e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  if ( e.response && e.response.status === 423 ) {
    return 'この年度は確定済みのため変更できません。変更するには管理権限で確定を取り消してください。';
  }
  return e.message || '起票に失敗しました。';
};

onMount(async () => {
  const res = await axios.get('/api/accounts');
  accounts = res.data || [];
  setAccounts(accounts);
  const karibarai = accounts.find((a) => ( a.code === KARIBARAI_CODE ));
  karibaraiSubs = ( karibarai && karibarai.subAccounts ) ? karibarai.subAccounts : [];
  await loadBalances();
  rows = [blankRow()];
  const today = new Date();
  settlementYear = today.getFullYear();
  settlementMonth = today.getMonth() + 1;
  settlementDay = today.getDate();
})
</script>
