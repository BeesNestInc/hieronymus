<table class="table">
  <thead>
    <tr>
      <th style="width:250px;">品名・規格</th>
      <th style="width:100px;">単価</th>
      <th style="width:50px;">数量</th>
      <th style="width:50px;">単位</th>
      <th style="width:100px;">
        金額<br/>
        消費税
      </th>
      <th>備考</th>
    </tr>
  </thead>
  <tbody>
    {#each transaction.lines as line}
    <tr>
      <td class="item" colspan={line.itemId === 0 ? 4 : 1}>
        {#if line.itemId !== 0}
        {@html line.itemName || '&nbsp;'}<br/>
        {@html line.itemSpec || '&nbsp;'}
        {:else}
        ※小計※
        {/if}
      </td>
      {#if line.itemId !== 0}
      <td class="number">@{formatNumber(line.unitPrice)}</td>
      <td class="number">{formatNumber(line.itemNumber)}</td>
      <td>{line.unit || ' '}</td>
      {/if}
      <td class="number">
        {formatMoney(line.amount)}
        {#if line.taxRule?.taxClass === 1 }
        ({formatMoney(line.tax)})
        {:else}
        {formatMoney(line.tax)}
        {/if}
      </td>
      <td class="description">{line.description}</td>
    </tr>
    {/each}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2" rowspan={transaction.taxClass !== 0 ? 3 : 2}></td>
      <td colspan="2" class="sums">小&nbsp;&nbsp;&nbsp;計</td>
      <td class="number">{formatMoney(transaction.amount)}</td>
      <td rowspan={transaction.taxClass !== 0 ? 3 : 2}></td>
    </tr>
    {#if transaction.taxClass !== 0}
    <tr>
      <td colspan="2" class="sums">消費税</td>
      <td class="number">
        {formatMoney(transaction.tax)}
      </td>
    </tr>
    {/if}
    <tr>
      <td colspan="2" class="sums"><strong>合&nbsp;&nbsp;&nbsp;計</strong></td>
      <td class="number">
        <strong>
          {formatMoney(transaction.amount)}
        </strong>
      </td>
    </tr>
  </tfoot>
</table>
<script>
import {BANK_ACCOUNT_TYPE, formatMoney} from '../../../../libs/utils.js';

export let transaction;

const formatNumber = (num) => {
  return num.toLocaleString();
};
</script>