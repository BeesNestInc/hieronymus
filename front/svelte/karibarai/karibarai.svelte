<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>精算</h1>
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
  <div class="full-height-2 fontsize-12pt scroll-table">
    <div class="container-fluid">
      <h2 class="fs-5">立替者別の精算残高（承認待ち含む）</h2>
      <div class="col-9">
      <table class="table table-bordered">
        <thead class="table-light">
          <tr>
            <th scope="col">
              立替者
            </th>
            <th scope="col" style="width: 320px;">
              精算額
            </th>
          </tr>
        </thead>
        <tbody>
          {#each subs as sub}
          <tr>
            <td>
              <!-- svelte-ignore a11y-missing-attribute -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <a style="cursor:pointer;" on:click|preventDefault={() => link(`/ledger/${settleAccount.code}/${sub.code}`)}>{sub.name}</a>
            </td>
            <td class="number">
              {#if sub.net > 0}
              返す（会社 → 立替者） {sub.net.toLocaleString()}
              {:else if sub.net < 0}
              もらう（立替者 → 会社） {(-sub.net).toLocaleString()}
              {/if}
            </td>
          </tr>
          {/each}
          <tr>
            <td>
              合計
            </td>
            <td class="number">
              {#if total.repay > 0}
              返す（会社 → 立替者） {total.repay.toLocaleString()}
              {/if}
              {#if total.repay > 0 && total.receive > 0}
              ／
              {/if}
              {#if total.receive > 0}
              もらう（立替者 → 会社） {total.receive.toLocaleString()}
              {/if}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <div class="container-fluid mt-4">
      <h2 class="fs-5">精算履歴（全期間・直近{history.length}件）</h2>
      {#if history.length === 0}
      <div class="text-muted">精算の記録はありません。</div>
      {:else}
      <div class="col-10">
      <table class="table table-striped table-bordered">
        <thead class="table-light">
          <tr>
            <th scope="col" style="width: 110px;">日付</th>
            <th scope="col">立替者</th>
            <th scope="col" style="width: 130px;">種別</th>
            <th scope="col" style="width: 110px;" class="number">金額</th>
            <th scope="col">相手科目</th>
            <th scope="col" style="width: 100px;">状態</th>
            <th scope="col" style="width: 90px;"></th>
          </tr>
        </thead>
        <tbody>
          {#each history as h}
          <tr>
            <td>{h.year}/{h.month}/{h.day}</td>
            <td>{h.subName}</td>
            <td>{h.kind}</td>
            <td class="number">{h.amount.toLocaleString()}</td>
            <td>{h.counterName}{h.counterSubName ? `/${h.counterSubName}` : ''}</td>
            <td>{h.approved ? '確定' : '承認待ち'}</td>
            <td style="text-align:center;">
              <!-- svelte-ignore a11y-missing-attribute -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <a style="cursor:pointer;" on:click|preventDefault={() => link(`/slip/${h.year}/${h.month}/${h.no}`)}>伝票</a>
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
      </div>
      {/if}
    </div>
    <div class="container-fluid mt-4">
      <h2 class="fs-5">精算</h2>
      <div class="row mb-3">
        <div class="col-4 input-group">
          <input type="text" autocomplete="off" class="number" size="4" maxlength="5"
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
              出金元
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
                <option value={sub.code}>{sub.name}</option>
                {/each}
              </select>
            </td>
            <td class="input">
              <div class="d-flex align-items-center">
                <div class="form-check me-4">
                  <input type="radio" class="form-check-input" name="direction-{i}"
                    id="repay-{i}" value="repay" bind:group={row.direction}>
                  <label class="form-check-label" for="repay-{i}">返す（会社 → 立替者）</label>
                </div>
                <div class="form-check">
                  <input type="radio" class="form-check-input" name="direction-{i}"
                    id="receive-{i}" value="receive" bind:group={row.direction}>
                  <label class="form-check-label" for="receive-{i}">もらう（立替者 → 会社）</label>
                </div>
              </div>
            </td>
            <td class="input">
              {#key rows.length}
              <select class="form-select form-select-sm"
                bind:value={row.paymentSource}>
                <option value=""></option>
                {#each cashSources as src}
                <option value={src.value}>{src.label}</option>
                {/each}
              </select>
              {/key}
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
        主体は「会社」です。立替者は精算を受ける側・返納する側です。<br/>
        「返す（会社 → 立替者）」= 会社が立替者に支払って精算する。<br/>
        「もらう（立替者 → 会社）」= 立替者から受け取る（返納）。
      </div>
    </div>
  </div>
  <div class="d-flex justify-content-end mt-3 mb-5">
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
import {setAccounts} from '../../javascripts/cross-slip';
import {numeric} from '../../../libs/utils';
import {onMount} from 'svelte';
import {link} from '../../javascripts/router.js';

export let status;

// 精算対象科目はサーバから受け取る（module-list.js のkaribarai設定に由来。
// 既定は仮払金1130000。立替金(負債)を導入する場合は設定側を変更する）
let settleAccount = { code: '', name: '', major: '' };

let subs = [];
let total = { repay: 0, receive: 0 };
let history = [];
let rows = [];
let accounts = [];
let ok = true;
let errorMessages = [];
let settlementYear;
let settlementMonth;
let settlementDay;

// 出金元は「現金」と「普通預金（各口座の補助科目）」に限定する。
// 検索ではなく決定的なリスト。精算対象科目自身は除外。
// 現金・預金に対象がほぼ確定している（例外科目は将来の拡張）。
let assetAccountIds = null;
// 選択値(paymentSource)から accountCode/subCode を復号する
const decodePaymentSource = (currentRows) => {
  for ( const row of currentRows ) {
    const [code, sub] = ( row.paymentSource || '' ).split(':');
    row.accountCode = code || null;
    row.subCode = sub || null;
  }
};
$: rows = rows;
$: decodePaymentSource(rows);

$: cashSources = ( accounts || [] )
  .filter((a) => ( a.major_name === '資産' &&
                   ( a.minor_name === '現金' ||
                     ( a.minor_name === '預金' && a.name === '普通預金' ) ) &&
                   a.accountCode !== settleAccount.code ))
  .flatMap((a) => {
    if ( a.subAccounts && a.subAccounts.length > 0 ) {
      return a.subAccounts.map((s) => ({
        value: `${a.code}:${s.code}`,
        label: `${a.name}/${s.name}`
      }));
    }
    return [{
      value: `${a.code}:`,
      label: a.name
    }];
  });

const blankRow = () => {
  return {
    subAccountCode: '',
    direction: 'repay',
    paymentSource: '',
    accountCode: null,
    subCode: null,
    paymentMappingId: null,
    amount: ''
  };
};

const loadBalances = async () => {
  const result = await axios.get(`/api/karibarai/${status.fy.term}`);
  settleAccount = result.data.account || { code: '', name: '', major: '' };
  subs = result.data.values || [];
  history = result.data.history || [];
  // 合計は返す側ともらう側を別々に積む（方向が混在する場合も両方見えるように）
  let repay = 0;
  let receive = 0;
  for ( const sub of subs ) {
    if ( sub.net > 0 ) {
      repay += sub.net;
    } else if ( sub.net < 0 ) {
      receive += -sub.net;
    }
  }
  total = { repay: repay, receive: receive };
};

const validateForm = () => {
  ok = true;
  errorMessages = [];
  if (( !settlementYear ) || ( !settlementMonth ) || ( !settlementDay ) ||
      ( settlementDay < 1 ) || ( settlementDay > 31 )) {
    ok = false;
    errorMessages.push('精算日が正しくありません。');
  }
  // 精算はこの画面が表示している期の中で行う（年度外に起票させない）。
  // 日付は日単位で比較（タイムゾーンずれの影響を避ける）
  if ( ok && status.fy && status.fy.startDate && status.fy.endDate ) {
    const dayOf = ( d ) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
    const settlement = dayOf(new Date(settlementYear, settlementMonth - 1, settlementDay));
    if ( settlement < dayOf(status.fy.startDate) || settlement > dayOf(status.fy.endDate) ) {
      ok = false;
      errorMessages.push(`精算日が第${status.fy.term}期の期間外です。年度外の精算はできません。`);
    }
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
    if ( !row.accountCode ) {
      ok = false;
      errorMessages.push(`${i + 1}行目 : 出金元が未選択です。`);
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
    if ( !row.accountCode ) {
      ok = false;
      errorMessages.push(`${rows.indexOf(row) + 1}行目 : 出金元（口座・現金）が入力されていません。`);
      continue;
    }
    // 「返す（会社 → 立替者）」: 借方=精算科目/立替者、貸方=出金元の口座
    // 「もらう（立替者 → 会社）」: 借方=出金元の口座、貸方=精算科目/立替者
    const settleSide = {
      account: settleAccount.code,
      subAccount: parseInt(row.subAccountCode),
      amount: amount
    };
    const oppositeSide = {
      account: row.accountCode,
      subAccount: ( row.subCode != null && row.subCode !== '' ) ? parseInt(row.subCode) : undefined,
      amount: amount
    };
    lines.push({
      ...( row.direction === 'repay' ) ? {
        debitAccount: settleSide.account,
        debitSubAccount: settleSide.subAccount,
        debitAmount: settleSide.amount,
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
        creditAccount: settleSide.account,
        creditSubAccount: settleSide.subAccount,
        creditAmount: settleSide.amount,
        creditTax: 0
      },
      application1: `精算（${row.direction === 'repay' ? '返す' : 'もらう'}）`
    });
  }
  if ( !ok ) {
    errorMessages = errorMessages;
    return;
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
  await loadBalances();
  // 出金元候補は勘定科目そのもの（資産科目のみ。マッピングは経由しない）。
  // Accountコンポーネントの検索は setAccounts に投入済みの科目から引く
  try {
    // major/middle名付き（all(): パターンはmajor名が無い）
    const res = await axios.get(`/api/accounts2/${status.fy.term}`);
    accounts = res.data || [];
    setAccounts(accounts);
  } catch (e) {
    accounts = [];
  }
  rows = [blankRow()];
  // 精算日の既定値は当日。ただし表示中の期の範囲外（年度外）なら、
  // その期の末日（未来なら）または期首日（過去なら）に合わせる
  let d = new Date();
  if ( status.fy && status.fy.startDate && status.fy.endDate ) {
    if ( d < status.fy.startDate ) {
      d = status.fy.startDate;
    } else if ( d > status.fy.endDate ) {
      d = status.fy.endDate;
    }
  }
  settlementYear = d.getFullYear();
  settlementMonth = d.getMonth() + 1;
  settlementDay = d.getDate();
})
</script>
