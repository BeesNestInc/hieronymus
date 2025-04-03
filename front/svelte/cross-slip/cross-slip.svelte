<div class="container-fluid">
  <div class="row mb-3">
    <div class="col-5">
      <div class="input-group">
        <span class="input-group-text">{slip.year}年{slip.month}月</span>
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
    <table class="table table-striped table-bordered">
      <thead>
        <th scope="col">
          借方科目
        </th>
        <th scope="col">
          金額
        </th>
        <th scope="col">
          適用
        </th>
        <th scope="col">
          貸方科目
        </th>
        <th scope="col">
          金額
        </th>
        <th scope="col">
        </th>
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
          <td>
            <Account accounts={accounts}
                bind:code={ line.debitAccount }
                bind:sub_code={ line.debitSubAccount }></Account>
          </td>
          <td class="number">
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              data-index={i}
              data-dc="d"
              bind:value={line.debitAmount}
              on:focusout={computeTax}>
            {#if findTaxClass(line.debitAccount, line.debitSubAccount) != 0}
            <input type="text" class="number" size="12" maxlength="13"
              bind:value={line.debitTax}
              on:focusout={makeTaxLine}>
            {/if}
          </td>
          <td>
            <input type="text" size="50" maxlength="51"
              bind:value={line.application1}>
            <input type="text" size="50" maxlength="51"
              bind:value={line.application2}>
          </td>
          <td>
            <Account accounts={accounts}
                bind:code={line.creditAccount}
                bind:sub_code={line.creditSubAccount}></Account>
          </td>
          <td class="number">
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              data-index={i}
              data-dc="c"
              bind:value={line.creditAmount}
              on:focusout={computeTax}>
            {#if findTaxClass(line.creditAccount, line.creditSubAccount) != 0}
            <input type="text" class="number" autocomplete="off" size="12" maxlength="13"
              bind:value={line.creditTax}
              on:focusout={makeTaxLine}>
            {/if}
          </td>
          <td style="width:125px;">
            {#if (!slip.approvedAt) }
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
        </tr>
      </tbody>
    </table>
  </div>
</div>

<style>
</style>

<script>
import axios from 'axios';
import {salesTax, findTaxClass} from '../../javascripts/cross-slip';
import {numeric} from '../../../libs/utils';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import Account from './account.svelte';
import {field} from '../../../libs/parse_account_code';

export let accounts;
export let slip;
export let fy;

let	sums;

const computeSum = () => {
  //console.log('computeSum');
  let debit_amount = 0;
  let	debit_tax = 0;
  let	credit_amount = 0;
  let	credit_tax = 0;

  for ( let i = 0; i < slip.lines.length ; i ++ ) {
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
const updateAccount = (slip) => {
}

const computeTax = (event) => {
  let index = event.currentTarget.dataset.index;
  let dc = event.currentTarget.dataset.dc;
  //console.log('index', index, dc);
  if	( dc == 'd' )	{
    if	( ( slip.lines[index].creditAccount ) &&
          ( slip.lines[index].creditAccount.match(/^114|^308/) ) )	{
    } else {
      let tax_class = findTaxClass(slip.lines[index].debitAccount, slip.lines[index].debitSubAccount);
      if  ( fy.taxIncluded )  {
        slip.lines[index].debitTax = 0;
      } else {
        slip.lines[index].debitTax = salesTax(tax_class, slip.lines[index].debitAmount);
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
      let tax_class = findTaxClass(slip.lines[index].creditAccount, slip.lines[index].creditSubAccount);
      if  ( fy.taxIncluded )  {
        slip.lines[index].creditTax = 0;
      } else {
        slip.lines[index].creditTax = salesTax(tax_class, slip.lines[index].creditAmount);
      }
    }
  }
  slip = slip;
}
const makeTaxLine = (event) => {
  if	( !fy.taxIncluded )	{
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
        let tax_class = findTaxClass(slip.lines[i].debitAccount,
                                       slip.lines[i].debitSubAccount);
        if	( tax_class !== 2 ) {
          slip.lines[gap].creditAccount = slip.lines[i].debitAccount;
          slip.lines[gap].creditSubAccount = slip.lines[i].debitSubAccount;
          slip.lines[gap].creditAmount += numeric(slip.lines[i].debitTax);
        }
        updateAccount(slip);
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
        let tax_class = findTaxClass(slip.lines[i].creditAccount,
                                       slip.lines[i].creditSubAccount);
        if	( tax_class !== 2 ) {
          slip.lines[gap].debitAccount = slip.lines[i].creditAccount;
          slip.lines[gap].debitSubAccount = slip.lines[i].creditSubAccount;
          slip.lines[gap].debitAmount += numeric(slip.lines[i].creditTax);
        }
        updateAccount(slip);
      }
    }
  }
}
const computeSumAndNext = (index) => {
  //console.log('computeSumAndNext');
  computeSum();
  //console.log(index, slip.lines.length);
  slip.lines.splice(index + 1, 0, {});
  updateAccount(slip);
  slip = slip;
}

const computeSumAndDelete = (index) => {
  //console.log('computeSumAndDelete');

  //console.log(index, slip.lines.length);
  slip.lines.splice(index, 1);
  computeSum();
  updateAccount(slip);
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
      detail.creditAmount = voucher.amount;
      detail.creditTax = voucher.tax;
    } else {
      detail.debitVoucherId = voucher.id;
      detail.debitAmount = voucher.amount;
      detail.debitTax = voucher.tax;
    }
    detail.application2 = voucher.customer.name;
    detail.debitAmount = detail.debitAmount != null ? numeric(detail.debitAmount).toLocaleString() : '';
    detail.debitTax = detail.debitTax != null ? numeric(detail.debitTax).toLocaleString() : '';
    detail.creditAmount = detail.creditAmount != null ? numeric(detail.creditAmount).toLocaleString() : '';
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
