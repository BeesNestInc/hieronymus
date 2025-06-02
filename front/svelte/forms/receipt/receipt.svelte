<svelte:head>
  <title>領収書::Hieronymus</title>
  <meta http-equiv="Content-Language" content="ja" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/public/bootstrap-icons/font/bootstrap-icons.css">
  <link rel="stylesheet" href="/style/paperA4.css">
  <link rel="stylesheet" href="/style/transaction.css">
</svelte:head>

<div class="transaction">
  <header class="transaction-header">
    <div class="window-recipient-info">
      <p>〒{transaction.zip}</p>
      <p>{transaction.address1}</p>
      <p>{transaction.address2}</p>
      <p>{transaction.companyName} 御中</p>
    </div>
    <div class="">
      <div class="title-info">
        <div class="title-line">
          <h1>領 収 書</h1>
          <div style="margin-left:20px;margin-top:10px;font-size:14px;">
            <span>No. {transaction.no}</span>
          </div>
        </div>
        <p>
          発行日:&nbsp;
          {date.getFullYear()}年
          {date.getMonth() + 1}月
          {date.getDate()}日
        </p>
      </div>
      <div class="company-info">
        {#if ( company.logoURL )}
        <div class="company-name-with-logo">
          <img src="{company.logoURL}" style="max-height:50px;">
          <p class="name">{company.name}</p>
        </div>
        {:else}
        <p class="name">{company.name || ''}</p>
        {/if}
        <p class="zip">〒{company.zip || ''}</p>
        <p class="address">{company.address1 || ''}</p>
        <p class="address">{company.address2 || '' }</p>
        <p class="tel">
        {#if ( company.tel ) }
        <span>TEL {company.tel}</span>
        {/if}
        {#if ( company.fax ) }
        <span>FAX {company.fax}</span>
        {/if}
        </p>
        {#if ( company.url ) }
        <p class="homepage">{company.url}</p>
        {/if}
        <p class="handler">
          担当: &nbsp;
          {#if transaction.handleUser.member.tradingName}
          {transaction.handleUser.member.tradingName}
          {:else}
          {transaction.handleUser.member.officialName}
          {/if}
        </p>
        <p class="account">
          [振込先]
          {company.bankName}
          {company.bankBranchName}
          {BANK_ACCOUNT_TYPE.find((bank) => bank[0] === company.accountType)}
          {company.accountNo}
        </p>
      </div>
    </div>
  </header>
	<main>
  	<div class="salutation">
    	<p>毎度ありがとうございます。</p>
    	<p>下記のとおり領収いたしました。</p>
  	</div>
  	<div class="total-amount">
	    <div class="title">
  	    合計金額
    	</div>
	    <div class="amount">
        {formatMoney(transaction.amount)}
	    </div>
	  </div>
		<Details
  	  {transaction}></Details>
	</main>
</div>
<script>
import Details from '../components/details.svelte';
import {BANK_ACCOUNT_TYPE, formatMoney} from '../../../../libs/utils.js';

export let transaction;
export let company;
   
console.log('receipt.svelte');

let date = new Date(transaction.issueDate);

</script>
      
    