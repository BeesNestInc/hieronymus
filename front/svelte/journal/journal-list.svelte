<div class="full-height-3">
  <table class="table table-bordered journal">
    <thead class="table-light">
      <tr>
        <th scope="col" colspan="2">
          日付 / 伝番
        </th>
        <th scope="col" style="width: 100px;">
          借方金額
        </th>
        <th scope="col" style="width: 150px;">
          借方科目<br/>補助科目
        </th>
        <th scope="col">
          適用
        </th>
        <th scope="col" style="width: 150px;">
          貸方科目<br/>補助科目
        </th>
        <th scope="col" style="width: 100px;">
          貸方金額
        </th>
      </tr>
    </thead>
    <tbody>
      {#each lines as line}
      <tr>
        <td style="width:50px;text-align:center;">
          {line.month}/{line.day}
        </td>
        <td style="width:50px;" class={'number ' + ( line.approvedAt ? 'bg-body' : 'bg-warning' )}>
          <button type="button" class="btn btn-link"
            on:click={() => {
              openSlip(line.no)}
            }>
            {line.no}
          </button>
        </td>
        <td class="number">
          {#if ( line.debitAccount !== '')}
          {line.debitAmount}
          {#if ( !fy.taxIncluded )}
          <br/>
          {line.debitTax}
          {/if}
          {/if}
        </td>
        <td>
          {line.debitAccount}<br/>
          {line.debitSubAccount}
        </td>
        <td>
          <div class="application">
            {line.application1}
            {#if line.application2}
            {#if line.application1}
            /
            {/if}
            {line.application2}
            {/if}
          </div>
          <div class="application d-flex">
            {#if ( !fy.taxIncluded )}
            <div class="tax">
              {line.debitTaxRule}
            </div>
            {/if}
            <div class="">
              {#if (line.debitVoucher )}
              {#each line.debitVoucher.files as file}
              <a href="/voucher/file/{file.id}" target="_blank">
                <i class="fas fa-file"></i>
              </a>
              {/each}
              {/if}
              {#if (line.creditVoucher )}
              {#each line.creditVoucher.files as file}
              <a href="/voucher/file/{file.id}" target="_blank">
                <i class="fas fa-file"></i>
              </a>
              {/each}
              {/if}
            </div>
            {#if !fy.taxIncluded}
            <div class="ms-auto tax">
              {line.creditTaxRule}
            </div>
            {/if}
          </div>
        </td>
        <td>
          {line.creditAccount}<br/>
          {line.creditSubAccount}
        </td>
        <td class="number">
          {#if ( line.creditAccount !== '')}
          {line.creditAmount}
          {#if ( !fy.taxIncluded )}
          <br/>
          {line.creditTax}
          {/if}
          {/if}
        </td>
      </tr>
      {/each}
      {#if sums }
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td class="number">
          {sums.debitAmount.toLocaleString()}
          {#if ( !fy.taxIncluded )}
          <br/>
          {sums.debitTax.toLocaleString()}
          {/if}
        </td>
        <td>
        </td>
        <td>
          合計
        </td>
        <td>
        </td>
        <td class="number">
          {sums.creditAmount.toLocaleString()}
          {#if ( !fy.taxIncluded )}
          <br/>
          {sums.creditTax.toLocaleString()}
          {/if}
        </td>
      </tr>
      {/if}
    </tbody>
  </table>
</div>

<style>
.file-item {
  height:20px;
  padding:0 5px;
}
.rect-image {
  width:20px;
  clip:rect(0,20px,20px,0);
}
</style>

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export	let	lines;
export	let sums;
export	let	slips;
export  let fy;

let slip;

const openSlip = (no) => {
  console.log('openSlip', no, slips);
  for ( let i = 0; i < slips.length; i ++ ) {
    if ( slips[i].no == no ) {
      slip = slips[i];
      break;
    }
  }

  console.log('slip', slip);
  dispatch('open', slip);
}
</script>
