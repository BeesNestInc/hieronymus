<svelte:head>
  <title>見積書::Hieronymus</title>
  <meta http-equiv="Content-Language" content="ja" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/public/bootstrap-icons/font/bootstrap-icons.css">
  <link rel="stylesheet" href="/style/transaction.css">
</svelte:head>
  
<div class="transaction">
  <header class="estimate-header">
    <div class="info">
      <p class="strong">{transaction.companyName || ''} 御中</p>
      <p class="strong"><span>件名</span>&nbsp;{transaction.subject || ''}</p>
      <div class="salutation">
        <p>下記の通り御見積申し上げます。</p>
      </div>
      <div class="condition">
        <p class="title">納入場所</p>
        <p class="item">お打ち合わせ通り</p>
      </div>
      <div class="condition">
        <p class="title">支払条件</p>
        <p class="item">{transaction.paymentMethod || ''}</p>
      </div>
      <div class="condition">
        <p class="title">納期</p>
        <p class="item">{formatDate(transaction.deliveryLimit, 'お打ち合わせ通り')}</p>
      </div>
      <div class="condition">
        <p class="title">有効期限</p>
        <p class="item">{formatDate(transaction.expiringDate, '御見積後１ヶ月以内')}</p>
      </div>
    </div>
    <div class="">
      <div class="title-info">
        <div class="title-line">
          <h1>御見積書</h1>
          <div style="margin-left:20px;margin-top:10px;font-size:14px;">
            <span>No. {transaction.no}</span>
          </div>
        </div>
        <p>発行日:&nbsp;{formatDate(transaction.issueDate)}</p>
      </div>
      <div class="company-info">
        {#if company.logo}
        <div class="company-name-with-logo">
          <img src={company.logo} style="max-height:50px;">
          <p class="name">{company.name}</p>
        </div>
        {:else}
        <p class="name">{company.name || ''}</p>
        {/if}
        <p class="zip">〒{company.zip || ''}</p>
        <p class="address">{company.address1 || ''}</p>
        <p class="address">{company.address2 || ''}</p>
        <p class="tel">
          {#if company.tel}<span>TEL {company.tel}</span>{/if}
          {#if company.fax}<span>FAX {company.fax}</span>{/if}
        </p>
        {#if company.homepage}
        <p class="homepage">{company.homepage}</p>
        {/if}
        <p class="handler">
          担当:&nbsp;
          {#if transaction.handleUser.member.tradingName}
          {transaction.handleUser.member.tradingName}
          {:else}
          {transaction.handleUser.member.officialName}
          {/if}
        </p>
      </div>
    </div>
  </header>
  <main>
    <div class="total-amount">
      <div class="title">合計金額</div>
      <div class="amount">{formatMoney(transaction.amount)}</div>
    </div>
    <Details
      {transaction}></Details>
    </main>
  </div>
<script>
import Details from '../components/details.svelte';
import {formatMoney} from '../../../../libs/utils.js';

export let transaction;
export let company;
   
console.log('estimate.svelte');
    
const formatDate = (dateStr, fallback) => {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};
      
</script>
      
    