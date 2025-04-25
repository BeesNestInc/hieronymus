{#each ledgerPage.pages as page, pc}
<div class="page">
  <div class="detail-page">
    <PageHeader
      {company}
      {fy}
      title={ledgerPage.name}
      right_item={title}
      ></PageHeader>
    <div class="page-body">
      <table class="table">
        <thead>
          <tr>
            <th colspan="2">
              日付 / 伝番
            </th>
            <th style="width: 100px;">
              相手勘定科目<br/>相手補助科目
            </th>
            <th>
              適用<br/>補助科目
            </th>
            <th style="width: 100px;">
              借方金額
            </th>
            <th style="width: 100px;">
              貸方金額
            </th>
            <th style="width: 100px;">
              残高
            </th>
          </tr>
        </thead>
        <tbody>
          {#if ( pc === 0 )}
          <tr style="height:12px;">
            <td colspan="3">
            </td>
            <td>
              繰越金額
            </td>
            <td class="number">
            </td>
            <td class="number">
            </td>
            <td class="number">
              {formatMoney(ledgerPage.pickup)}
            </td>
          </tr>
          {/if}
          {#each page.lines as line}
          <tr style="height:36px;">
            <td style="width:40px;text-align:center;">
              {line.month}/{line.day}
            </td>
            <td class="number" style="width:25px;">
              {line.no}
            </td>
            <td>
              {line.otherAccount}<br/>
              {line.otherSubAccount}
            </td>
            <td>
              <div class="appication">
                {line.application1 || ''}
              </div>
              <div class="appication">
                {line.application2 || ''}
              </div>
              <div class="application">
              </div>
              {#if (line.subAccount)}
              <div class="application">
                {line.subAccount}
              </div>
              {/if}
            </td>
            <td class="number">
              {line.thisTaxClass}<br/>
              {#if (line.showDebit)}
              <span>
                {formatMoney(line.pureDebitAmount)}<br/>
                {formatMoney(line.pureDeitTax)}
              </span>
              {/if}
            </td>
            <td class="number">
              {line.otherTaxClass}<br/>
              {#if (line.showCredit)}
              <span>
                {formatMoney(line.pureCreditAmount)}<br/>
                {formatMoney(line.pureCreditTax)}
              </span>
              {/if}
            </td>
            <td class="number">
              <br/><br/>
              {formatMoney(line.pureBalance)}
            </td>
          </tr>
          {/each}
          {#if ( pc + 1 === ledgerPage.pages.length)}
          <tr class="total" style="height:36px;">
            <td colspan="3">
            </td>
            <td>
              合計
            </td>
            <td class="number">
              {formatMoney(ledgerPage.sums.debitAmount)}<br/>
              {formatMoney(ledgerPage.sums.debitTax)}
            </td>
            <td class="number">
              {formatMoney(ledgerPage.sums.creditAmount)}<br/>
              {formatMoney(ledgerPage.sums.creditTax)}
            </td>
            <td class="number">
              {formatMoney(ledgerPage.sums.balance)}
            </td>
          </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
{/each}
<script>
import PageHeader from '../components/page-header.svelte';
import {formatMoney, taxClass} from '../../../../libs/utils.js';

export let company;
export let fy;
export let title;
export let ledgerPage;
</script>