<table class="table table-striped table-bordered details">
  <thead>
    <tr>
      <th scope="col" style="width:200px;">
        商品名<br/>
        規格
      </th>
      <th scope="col" style="width:120px;">
        単価
      </th>
      <th scope="col" style="width: 100px;">
        数量<br/>
        単位
      </th>
      <th scope="col" style="width: 120px;">
        消費税
      </th>
      <th scope="col" style="width: 110px;">
        金額<br/>
        消費税
      </th>
      <th scope="col">
        説明
      </th>
      <th scope="col" style="width:90px;">
      </th>
      <th scope="col" style="width: 20px;">
        小計
      </th>
    </tr>
  </thead>
  <tbody>
    {#each details as line, i}
    <tr>
      <td class="input">
        {#if ( details[i].itemId === 0 )}
        <span style="font-size:12pt;">※&nbsp;小計&nbsp;※</span>
        {:else}
        <ItemSelect
          product={true}
          bind:itemId={details[i].itemId}
          bind:itemName={details[i].itemName}
          bind:itemSpec={details[i].itemSpec}
          bind:unitPrice={details[i].unitPrice}
          bind:unit={details[i].unit}
        />
        <input type="text" size="25" maxlength="26" class="form-control"
          bind:value={details[i].itemSpec}>
        {/if}
      </td>
      <td class="input number">
        {#if ( details[i].itemId !== 0 )}
        <input type="text" class="number form-control" size="10" maxlength="11"
          bind:value={details[i].unitPrice}>
        {/if}
      </td>
      <td class="input">
        {#if ( details[i].itemId !== 0 )}
        <input type="text" class="number form-control" size="5" maxlength="6"
          bind:value={details[i].itemNumber}>
        <input type="text" class="form-control" size="4" maxlength="5"
          bind:value={details[i].unit}>
        {/if}
      </td>
      <td class="input">
        {#if ( details[i].itemId !== 0 )}
        <select class="form-control" style="line-height:1;padding:0.375rem"
          bind:value={details[i].taxRuleId}
          on:focusout={() => {
            console.log('tax focusout');
            const rule = findTaxRule(details[i].taxRuleId, taxRules);
            details[i].tax = computeTax(details[i].amount, rule);
        }}>
          <option value={null}> -- 未選択 --</option>
            {#each taxRules as ent}
            <option value={ent.id}>{ent.label}</option>
            {/each}
          </select>
        {/if}
      </td>
      <td class="input">
        <input type="text" class="number form-control" size="10" maxlength="11" disabled="true"
          value={numeric(details[i].amount).toLocaleString()}>
        <input type="text" class="number form-control" size="10" maxlength="11" disabled="true"
          value={numeric(details[i].tax).toLocaleString()}>
      </td>
      <td class="input">
        <textarea class="form-control" id="description" style="height:76px;"
          bind:value={details[i].description} />
      </td>
      <td>
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            details.splice(i+1, 0, {
              itemName: '',
              itemSpec: '',
              unitPrice: 0,
              itemNumber: 0,
              description: '',
              amount: 0
            });
            details = details;
          }}>
          <i class="fas fa-plus"></i>
        </button>
        {#if ( details.length > 1 )}
        <button type="button" class="btn btn-danger btn-sm"
          on:click={() => {
            details.splice(i,1);
            details = details;
          }}>
          <i class="fas fa-minus"></i>
        </button>
        {/if}
      </td>
      <td>
        <input type="checkbox"
          on:change={(event) => {
            const checked = event.target.checked;
            details[i].ssum = checked;
            if  ( !checked )  {
              details[i].itemId = undefined;
              details[i].unitPrice = 0;
              details[i].itemNumber = 0;
              details[i].unit = '';
              details[i].amount = 0;
            }
          }}
          bind:checked={details[i].ssum}>
      </td>
    </tr>
    {/each}
    <tr>
      <td colspan="4" style="vertical-align:middle;">
        合計
      </td>
      <td class="input number">
        <input type="text" class="number form-control" size="10" maxlength="11" disabled="true"
          value={sum.toLocaleString()}>
        <input type="text" class="number form-control" size="10" maxlength="11" disabled="true"
        value={tax.toLocaleString()}>
      </td>
      <td></td>
      <td>
        {#if ( details.length === 0 )}
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            details = [{
              itemName: '',
              itemSpec: '',
              unitPrice: 0,
              itemNumber: 0,
              description: '',
              amount: 0
            }];
          }}>
          <i class="fas fa-plus"></i>
        </button>
        {/if}
      </td>
      <td></td>
    </tr>
  </tbody>
</table>

<script>
import ItemSelect from '../components/item-select.svelte';
import {numeric, round} from '../../../libs/utils.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {findTaxRule, computeTax} from '../../../libs/sales-tax.js';

export  let details;
export  let sum;
export  let tax;
export  let total;
export let taxRules;

$: {
  console.log('computeSum');
  sum = 0;
  tax = 0;
  total = 0;
  for ( let i = 0 ; i < details.length ; i += 1 ) {
    //console.log(details[i]);
    if  ( details[i].ssum ) {
      details[i].itemId = 0;
    }
    details[i].ssum = false;
    if  ( details[i].itemId === 0 ) {
      details[i].amount = sum;
      details[i].tax = tax;
      details[i].ssum = true;
    } else
    if  ( details[i].itemId ) {
      details[i].amount = round(details[i].unitPrice) * parseFloat(details[i].itemNumber);
      const rule = findTaxRule(details[i].taxRuleId, taxRules);
      details[i].tax = computeTax(details[i].amount, rule);
      sum += details[i].amount;
      tax += details[i].tax;
      if  ( rule?.taxClass === 1 ) {
        total += details[i].amount;
      } else {
        total += ( details[i].amount + details[i].tax);
      }
    } else {
      const rule = findTaxRule(details[i].taxRuleId, taxRules);
      sum += numeric(details[i].amount);
      tax += numeric(details[i].tax);
      if  ( rule?.taxClass === 1 ) {
        total += details[i].amount;
      } else {
        total += ( details[i].amount + details[i].tax);
      }
    }
  }
  dispatch('sum')
}
onMount(async () => {
});

beforeUpdate(() => {
  //console.log('transaction-details beforeUpdate', {details});
})
</script>
