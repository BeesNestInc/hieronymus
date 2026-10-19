<div class="container-fluid crossslip">
  <div class="row mb-3">
    <div class="col-5">
      <div class="input-group">
        <input type="text" autocomplete="off" class="number" name="year"
          id="slip-year" size="2" maxlength="5" disabled="disabled"
          bind:value={slip.year}>
        <span class="input-group-text">年</span>
        <input type="text" autocomplete="off" class="number" name="month"
          id="slip-month" size="2" maxlength="3"
          bind:value={slip.month}>
        <span class="input-group-text">月</span>
        <input type="text" autocomplete="off" class="number" name="day" id="slip-day" size="2" maxlength="3"
            bind:value={slip.day}>
        <span class="input-group-text">日</span>
        {#if slip.no}
        <span class="input-group-text">No. {slip.no}</span>
        {/if}
      </div>
    </div>
    <div class="col">
      <div class="row">
        <div class="col-4 input-group-text">
          入力:
          {slip.createrName || ''}
        </div>
        <div class="col-8 input-group-text">
          承認:
          {slip.approverName || ''}
          {#if (slip.approvedAt)}
          ({slip.approvedAt.getFullYear()}年
          {slip.approvedAt.getMonth()+1}月
          {slip.approvedAt.getDate()}日)
          {/if}
        </div>
      </div>
    </div>
	</div>
  <div class="row">
    <div class="col-12">
    <div class="table-responsive">
    <table class="table table-striped table-bordered">
      <thead class="table-light">
        <tr>
        <th style="width:24px;">
        </th>
        <th>
          借方科目
        </th>
        <th style="width:120px;">
          金額
        </th>
        <th>
          適用
        </th>
        <th>
          貸方科目
        </th>
        <th style="width:120px;">
          金額
        </th>
        <th>
        </th>
        </tr>
      </thead>
      <tbody id="cross-slip">
        {#if slip}
        {#each slip.lines as line, i}
        <tr
          on:drop|preventDefault={onDrop}
          on:dragenter|preventDefault={onDragEnter}
          on:dragleave|preventDefault={onDragLeave}
          on:dragover|preventDefault
          data-index={i}
          data-id={line.id}>
          <td class="drag-cell">
            <button type="button" class="drag-handle" title="ドラッグで明細を並べ替えます"
              disabled={!reorderable} aria-label="明細の並べ替え">
              <i class="bi bi-grip-vertical"></i>
            </button>
          </td>
          <td class="input">
            <Account
              accounts={accounts}
              bind:code={line.debitAccount }
              bind:sub_code={line.debitSubAccount}></Account>
          </td>
          <td class="number input">
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              bind:value={line.debitAmount}
              on:focusout={() => {
                computeTax(i, 'd');
              }}>
            {#if (( !fy.taxIncluded ) &&
                  ( line.creditAccount !== '3080000' ) &&
                  ( findTaxClass(line.debitAccount, line.debitSubAccount) != 0 ))}
            <input type="text" class="number" size="12" maxlength="13"
              bind:value={line.debitTax}
              on:focusout={makeTaxLine}>
            {/if}
          </td>
          <td class="input">
            <div class="application d-flex">
              {#if showProject}
              <input type="text" size="44" maxlength="51"
                bind:value={line.application1}>
              <div class="project me-auto">
                <select class="form-control" style="line-height:1;padding:0.375rem" bind:value={line.projectId}>
                  <option value={null}>-- プロジェクト --</option>
                  {#each projects as project}
                  <option value={project.id}>{project.name}</option>
                  {/each}
                </select>
              </div>
              {:else}
              <input type="text" size="60" maxlength="61"
                bind:value={line.application1}>
              {/if}
            </div>
            {#if (!fy.taxIncluded)}
            <div class="application d-flex">
              <div class="tax">
                {#if (( line.creditAccount !== '3080000' ) &&
                      ( findTaxClass(line.debitAccount, line.debitSubAccount) > 0 ))}
                <select class="form-control" style="line-height:1;padding:0.375rem"
                  bind:value={line.debitTaxRuleId}
                  on:focusout={() => {
                    console.log('debit focusout');
                    computeTax(i, 'd');
                    makeTaxLine();
                  }}>
                  <option value={null}> -- 未選択 --</option>
                  {#each taxRules as ent}
                  <option value={ent.id}>{ent.label}</option>
                  {#if ent.taxClass === findTaxClass(line.debitAccount, line.debitSubAccount)}
                  {/if}
                  {/each}
                </select>
                {/if}
              </div>
              <input type="text" size="27" maxlength="51"
                bind:value={line.application2}>
              <div class="tax ms-auto">
                {#if (( !fy.taxIncluded ) &&
                      ( line.debitAccount !== '1140000' ) &&
                      ( findTaxClass(line.creditAccount, line.creditSubAccount) > 0 ))}
                <select class="form-control" style="line-height:1;padding:0.375rem"
                  bind:value={line.creditTaxRuleId}
                  on:focusout={() => {
                    computeTax(i, 'c');
                    makeTaxLine();
                  }}>
                  <option value={null}> -- 未選択 --</option>
                  {#each taxRules as ent}
                  <option value={ent.id}>{ent.label}</option>
                  {#if ent.taxClass === findTaxClass(line.creditAccount, line.creditSubAccount)}
                  {/if}
                  {/each}
                </select>
                {/if}
              </div>
            </div>
            {:else}
            <div class="application d-flex">
              <input type="text" size="40" maxlength="51"
                bind:value={line.application2}>
            </div>
            {/if}
          </td>
          <td class="input">
            <Account
              accounts={accounts}
              bind:code={line.creditAccount}
              bind:sub_code={line.creditSubAccount}></Account>
          </td>
          <td class="number input">
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              bind:value={line.creditAmount}
              on:focusout={() => {
                computeTax(i, 'c');
              }}>
            {#if (( line.debitAccount !== '1140000' ) &&
                  ( findTaxClass(line.creditAccount, line.creditSubAccount) != 0))}
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              bind:value={line.creditTax}
              on:focusout={makeTaxLine}>
            {/if}
          </td>
          <td style="width:130px;">
            {#each [ line.debitVoucher, line.creditVoucher ] as v}
            {#if ( v && v.files )}
            {#each v.files as file}
            {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
            <button type="button" class="thumb-button" title="クリックで拡大表示"
              on:click={() => { openPreview(file); }}>
              <img src="/voucher/file/{file.id}" class="thumb"/>
            </button>
            {:else}
            <a href="/voucher/file/{file.id}" target="_blank" title="クリックで別タブ表示">
              <img src="/public/icons/icon_pdf.png" class="thumb"/>
            </a>
            {/if}
             {/each}
             {/if}
             {/each}
             {#if ( !slip.approvedAt )}
             <button type="button" class="btn btn-primary btn-sm"
               on:click={() => {
                 computeSumAndNext(i);
               }}>
               <i class="fas fa-plus"></i>
             </button>
             {#if ( slip.lines.length > 1 )}
             <button type="button" class="btn btn-danger btn-sm"
               on:click={() => {
                 computeSumAndDelete(i);
               }}>
               <i class="fas fa-minus"></i>
             </button>
             {/if}
             {#if ( ( line.debitVoucherId ) || ( line.creditVoucherId ))}
             <button type="button" class="btn btn-warning btn-sm"
               on:click={() => {
                 unbindVoucher(i);
               }}>
               <i class="fas fa-link-slash"></i>
             </button>
             {/if}
             {/if}
           </td>
        </tr>
        {/each}
        {/if}
        <tr>
          <td>
          </td>
          <td class="number">
            { sums.debit_amount ? sums.debit_amount.toLocaleString() : ''}<br />
            { sums.debit_tax ? sums.debit_tax.toLocaleString() : ''}
          </td>
          <td>
            合計
          </td>
          <td>
          </td>
          <td class="number">
            { sums.credit_amount ? sums.credit_amount.toLocaleString() : ''}<br />
            { sums.credit_tax ? sums.credit_tax.toLocaleString() : ''}
          </td>
          <td>
          </td>
          <td>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
    </div>
  </div>
</div>

<style>
.drag-cell {
  padding: 4px 0 4px 2px;
  vertical-align: middle;
}
.drag-handle {
  padding: 0 2px;
  border: none;
  background: transparent;
  color: #999;
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
.drag-handle:disabled {
  cursor: default;
  color: #ddd;
}
.sortable-ghost {
  opacity: 0.4;
}
/* 明細は上揃え（行内の段数が違っても揃って見える） */
#cross-slip th, #cross-slip td {
  vertical-align: top;
}
.thumb-button {
  padding: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
}
.thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-box {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  max-width: 92vw;
}
.preview-img {
  max-width: 88vw;
  max-height: 80vh;
  object-fit: contain;
}
</style>

{#if ( preview )}
<div class="preview-overlay" on:click|self={() => { preview = null; }}>
  <div class="preview-box">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>{preview.title}</strong>
      <div>
        <a href={preview.src} target="_blank" class="btn btn-sm btn-outline-secondary me-2">別タブで開く</a>
        <button type="button" class="btn btn-sm btn-secondary" on:click={() => { preview = null; }}>閉じる</button>
      </div>
    </div>
    <img src={preview.src} class="preview-img" alt={preview.title}/>
  </div>
</div>
{/if}

<script>
import axios from 'axios';
import Sortable from 'sortablejs';

import {findTaxClass} from '../../javascripts/cross-slip';
import {numeric, getCompanyInfo} from '../../../libs/utils';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import Account from './account.svelte';
import {field} from '../../../libs/parse_account_code';
import {findTaxRule, computeTax as _computeTax} from '../../../libs/sales-tax.js';

export let accounts;
export let slip;
export let fy;
export let taxRules;
// 明細の並べ替え（ハンドルDnD。未確定伝票のみ。既定は無効）
export let reorderable = false;
let sums;
let projects = [];
let showProject = false;
let sortable = null;
// 証憑サムネイルの拡大プレビュー（モーダル）。PDFは別タブ表示のまま
let preview = null;
const openPreview = (file) => {
  preview = { src: `/voucher/file/${file.id}`, title: ( file && file.name ) || '証憑' };
};

$: slip.year = slip.month < ( fy.startDate.getMonth() + 1 ) ? fy.endDate.getFullYear() : fy.startDate.getFullYear();

onMount(async () => {
  // 明細行の並べ替え（ハンドル掴みのみ。行全体は証憑DnDのドロップ先のため）。
  // 並べ替え順は保存時にlineNoとして採番される
  const tbody = document.querySelector('#cross-slip');
  if ( tbody && reorderable ) {
    sortable = new Sortable(tbody, {
      animation: 150,
      handle: '.drag-handle',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if ( oldIndex !== newIndex ) {
          const moved = slip.lines.splice(oldIndex, 1)[0];
          slip.lines.splice(newIndex, 0, moved);
          slip.lines = [...slip.lines];
          computeSum();
        }
      }
    });
  }
  try {
    const companyInfo = await getCompanyInfo();
    if (companyInfo && companyInfo.useProjectAccounting) {
      showProject = true;
      const result = await axios.get('/api/projects');
      projects = result.data;
    } else {
      showProject = false;
    }
  } catch (err) {
    console.error("部門会計情報の取得または部門リストの取得に失敗しました:", err);
    showProject = false;
  }
});

const computeSum = () => {
  //console.log('computeSum');
  let debit_amount = 0;
  let	debit_tax = 0;
  let	credit_amount = 0;
  let	credit_tax = 0;

  for ( let i = 0; i < ( slip.lines || [] ).length ; i ++ ) {
    debit_amount += numeric(slip.lines[i].debitAmount);
    debit_tax += numeric(slip.lines[i].debitTax);
    credit_amount += numeric(slip.lines[i].creditAmount);
    credit_tax += numeric(slip.lines[i].creditTax);
  }
  return	({
    debit_amount: debit_amount,
    debit_tax: debit_tax,
    credit_amount: credit_amount,
    credit_tax: credit_tax
  });
}
const computeTax = (index, dc) => {
  if	( dc == 'd' )	{
    if	( ( slip.lines[index].creditAccount ) &&
          ( slip.lines[index].creditAccount.match(/^114|^308/) ) )	{
    } else {
      if  ( fy.taxIncluded )  {
        slip.lines[index].debitTax = 0;
      } else {
        const rule = findTaxRule(slip.lines[index].debitTaxRuleId, taxRules);
        if  (( rule ) &&
             (rule.taxClass != 9 ))  {
          slip.lines[index].debitTax = _computeTax(slip.lines[index].debitAmount, rule);
        }
      }
    }
  } else {
    if	( slip.lines[index].creditAmount == '=' )	{
      slip.lines[index].creditAmount = slip.lines[index].debitAmount;
    }
    if	( slip.lines[index].creditAmount == '-' )	{
      let sums = computeSum();
      slip.lines[index].creditAmount = sums.debit_amount - sums.credit_amount;
    }
    if	( ( slip.lines[index].debitAccount ) &&
          ( slip.lines[index].debitAccount.match(/^114|^308/) )	)	{
    } else {
      if  ( fy.taxIncluded )  {
        slip.lines[index].creditTax = 0;
      } else {
        const rule = findTaxRule(slip.lines[index].creditTaxRuleId, taxRules);
        if  (( rule ) &&
             (rule.taxClass != 9 ))  {
          slip.lines[index].creditTax = _computeTax(slip.lines[index].creditAmount, rule);
        }
      }
    }
  }
  slip = slip;
}
const makeTaxLine = () => {
  if	( !fy.taxIncluded )	{
    //  1140000 仮払消費税
    //  3080000 仮受消費税
    for ( let i = 0; i < slip.lines.length ; i ++ ) {
      if	( ( ( slip.lines[i].creditAccount ) &&
            ( slip.lines[i].creditAccount.match(/^114|^308/) ) ) ||
          ( ( slip.lines[i].debitAccount ) &&
            ( slip.lines[i].debitAccount.match(/^114|^308/) ) ) )	{
        slip.lines[i].creditAmount = 0;
        slip.lines[i].debitAmount = 0;
        slip.lines[i].creditTax = 0;
        slip.lines[i].debitTax = 0;
      }
    }
    for ( let i = 0; i < slip.lines.length ; i ++ ) {
      if	( slip.lines[i].debitTax > 0 )	{
        let debit = ( field(slip.lines[i].debitAccount) == '6' ) ? '3080000' : (
               ( field(slip.lines[i].debitAccount) == '7' ) ? '1140000' : undefined );
        let gap;
        for	( let j = i + 1;  j < slip.lines.length ; j += 1 )	{
          let line = slip.lines[j];
          if	( ( line.debitAccount == debit ) &&
                ( line.creditAccount == slip.lines[i].debitAccount ) &&
                ( line.creditSubAccount == slip.lines[i].debitSubAccount ) )	{
            gap = j;
          }
        }
        if	( !gap )	{
          gap = slip.lines.length;
          slip.lines.push({
            debitAmount: 0,
            debitTax: 0,
            creditAmount: 0,
            creditTax: 0
          });
        }
        slip.lines[gap].debitAccount = debit;
        slip.lines[gap].debitAmount += numeric(slip.lines[i].debitTax);
        const rule = findTaxRule(slip.lines[i].debitTaxRuleId, taxRules);
        if	( rule && rule.taxClass !== 2 ) {
          slip.lines[gap].creditAccount = slip.lines[i].debitAccount;
          slip.lines[gap].creditSubAccount = slip.lines[i].debitSubAccount;
          slip.lines[gap].creditAmount += numeric(slip.lines[i].debitTax);
        }
      }
      if	( slip.lines[i].creditTax > 0 )	{
        let credit = ( field(slip.lines[i].creditAccount) == '6' ) ? '3080000' : (
               ( field(slip.lines[i].creditAccount) == '7' ) ? '1140000' : undefined );
        let gap;
        for	( let j = i + 1; j < slip.lines.length ; j += 1 )	{
          let line = slip.lines[j];
          if	( ( line.creditAccount == credit ) &&
                ( line.debitAccount == slip.lines[i].creditAccount ) &&
                ( line.debitSubAccount == slip.lines[i].creditSubAccount ) )	{
            gap = j;
          }
        }
        if	( !gap )	{
          gap = slip.lines.length;
          slip.lines.push({
            debitAmount: 0,
            debitTax: 0,
            creditAmount: 0,
            creditTax: 0
          });
        }
        slip.lines[gap].creditAccount = credit;
        slip.lines[gap].creditAmount += numeric(slip.lines[i].creditTax);
        const rule = findTaxRule(slip.lines[i].creditTaxRuleId, taxRules);
        if	( rule && rule.taxClass !== 2 ) {
          slip.lines[gap].debitAccount = slip.lines[i].creditAccount;
          slip.lines[gap].debitSubAccount = slip.lines[i].creditSubAccount;
          slip.lines[gap].debitAmount += numeric(slip.lines[i].creditTax);
        }
      }
    }
  }
}
const computeSumAndNext = (index) => {
  //console.log('computeSumAndNext');
  computeSum();
  //console.log(index, slip.lines.length);
  slip.lines.splice(index + 1, 0, {});
  slip = slip;
}

const computeSumAndDelete = (index) => {
  //console.log('computeSumAndDelete');

  //console.log(index, slip.lines.length);
  slip.lines.splice(index, 1);
  computeSum();
  slip = slip;
}

const unbindVoucher = (i) => {
  slip.lines[i].debitVoucherId = undefined;
  slip.lines[i].creditVoucherId = undefined;
  slip = slip;
}
const bindVoucher = (i, voucher_id) => {
  axios.get(`/api/voucher/${voucher_id}`).then((result) => {
    return(result.data.voucher);
  }).then((voucher) => {
    console.log('voucher', voucher);
    let detail = slip.lines[i];
    if  ( voucher.voucherClass.send ) {
      detail.creditVoucherId = voucher.id;
      detail.creditTax = voucher.tax;
      detail.creditTaxRuleId = voucher.taxRuleId;
    } else {
      detail.debitVoucherId = voucher.id;
      detail.debitTax = voucher.tax;
      detail.debitTaxRuleId = voucher.taxRuleId;
    }
    // 証憑金額が 0 / undefined 等のときは明細金額を上書きしない
    if ( voucher.amount != null && numeric(voucher.amount) !== 0 ) {
      detail.creditAmount = voucher.amount;
      detail.debitAmount = voucher.amount;
      detail.debitAmount = detail.debitAmount != null ? numeric(detail.debitAmount).toLocaleString() : '';
      detail.creditAmount = detail.creditAmount != null ? numeric(detail.creditAmount).toLocaleString() : '';
    }
    detail.application2 = voucher.company.name;
    detail.debitTax = detail.debitTax != null ? numeric(detail.debitTax).toLocaleString() : '';
    detail.creditTax =  detail.creditTax != null ? numeric(detail.creditTax).toLocaleString() : '';
    slip = slip;
  })
}

let dragCounter = [];
const onDrop = (event) => {
  let index = event.currentTarget.dataset.index;
  let voucher_id = event.dataTransfer.getData('id');
  console.log('onDrop', voucher_id);
  if  ( voucher_id )  {
    bindVoucher(index, voucher_id);
  }
  dragCounter[index] = 0;
  event.currentTarget.classList.remove('over');
  event.stopPropagation();
}

const onDragEnter = (event) => {
	console.log('enter');
  let index = event.currentTarget.dataset.index;
  dragCounter[index] ||= 0;
  dragCounter[index] += 1;
  if  ( dragCounter[index] === 1 ) {
    event.currentTarget.classList.add('over');
  }
  event.stopPropagation();
}
const onDragLeave = (event) => {
  console.log('leave');
  let index = event.currentTarget.dataset.index;
  dragCounter[index] ||= 0;
  dragCounter[index] -= 1;
  if  ( dragCounter[index] === 0 ) {
    event.currentTarget.classList.remove('over');
  }
  event.stopPropagation();
}
beforeUpdate(() => {
  //console.log('cross-slip beforeUpdate');
  sums = computeSum();
  //console.log('sums', sums);
});
afterUpdate(() => {
})

</script>