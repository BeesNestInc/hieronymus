import { create_ssr_component, each, add_attribute, escape, validate_component } from "svelte/internal";
import { B as BANK_ACCOUNT_TYPE } from "./assets/utils-TI298WRP.js";
import "@formkit/tempo";
const Details = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { transaction } = $$props;
  const formatNumber = (num) => {
    return num.toLocaleString();
  };
  if ($$props.transaction === void 0 && $$bindings.transaction && transaction !== void 0) $$bindings.transaction(transaction);
  return `<table class="table"><thead data-svelte-h="svelte-ccoqui"><tr><th style="width:250px;">品名・規格</th> <th style="width:100px;">単価</th> <th style="width:50px;">数量</th> <th style="width:50px;">単位</th> <th style="width:100px;">金額</th> <th>備考</th></tr></thead> <tbody>${each(transaction.lines, (line) => {
    return `<tr><td class="item"${add_attribute("colspan", line.itemId === 0 ? 4 : 1, 0)}>${line.itemId !== 0 ? `<!-- HTML_TAG_START -->${line.itemName || "&nbsp;"}<!-- HTML_TAG_END --><br> <!-- HTML_TAG_START -->${line.itemSpec || "&nbsp;"}<!-- HTML_TAG_END -->` : `※小計※`}</td> ${line.itemId !== 0 ? `<td class="number">@${escape(formatNumber(line.unitPrice))}</td> <td class="number">${escape(formatNumber(line.itemNumber))}</td> <td>${escape(line.unit || " ")}</td>` : ``} <td class="number">¥${escape(formatNumber(line.amount))}</td> <td class="description">${escape(line.description)}</td> </tr>`;
  })}</tbody> <tfoot><tr><td colspan="2"${add_attribute("rowspan", transaction.taxClass !== 0 ? 3 : 2, 0)}></td> <td colspan="2" class="sums" data-svelte-h="svelte-3q9m09">小   計</td> <td class="number">¥${escape(formatNumber(transaction.amount))}</td> <td${add_attribute("rowspan", transaction.taxClass !== 0 ? 3 : 2, 0)}></td></tr> ${transaction.taxClass !== 0 ? `<tr><td colspan="2" class="sums" data-svelte-h="svelte-x5jzy3">消費税</td> <td class="number">${transaction.taxClass === 2 || transaction.taxClass === 9 ? `¥${escape(formatNumber(transaction.tax))}` : `(¥${escape(formatNumber(transaction.tax))})`}</td></tr>` : ``} <tr><td colspan="2" class="sums" data-svelte-h="svelte-1norif9"><strong>合   計</strong></td> <td class="number"><strong>${transaction.taxClass === 2 || transaction.taxClass === 9 ? `¥${escape(formatNumber(parseInt(transaction.tax) + parseInt(transaction.amount)))}` : `¥${escape(formatNumber(transaction.amount))}`}</strong></td></tr></tfoot> </table>`;
});
const Invoice = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { transaction } = $$props;
  let { company } = $$props;
  console.log("invoice.svelte");
  let date = new Date(transaction.issueDate);
  if ($$props.transaction === void 0 && $$bindings.transaction && transaction !== void 0) $$bindings.transaction(transaction);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  return `${$$result.head += `<!-- HEAD_svelte-2d512j_START -->${$$result.title = `<title>請求書::Hieronymus</title>`, ""}<meta http-equiv="Content-Language" content="ja"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/public/bootstrap-icons/font/bootstrap-icons.css"><link rel="stylesheet" href="/style/transaction.css"><!-- HEAD_svelte-2d512j_END -->`, ""} <div class="transaction"><header class="transaction-header"><div class="window-recipient-info"><p>〒${escape(transaction.zip)}</p> <p>${escape(transaction.address1)}</p> <p>${escape(transaction.address2)}</p> <p>${escape(transaction.companyName)} 御中</p></div> <div class=""><div class="title-info"><div class="title-line"><h1 data-svelte-h="svelte-ao9q93">請 求 書</h1> <div style="margin-left:20px;margin-top:10px;font-size:14px;"><span>No. ${escape(transaction.no)}</span></div></div> <p>発行日: 
          ${escape(date.getFullYear())}年
          ${escape(date.getMonth() + 1)}月
          ${escape(date.getDate())}日</p></div> <div class="company-info">${company.logoURL ? `<div class="company-name-with-logo"><img${add_attribute("src", company.logoURL, 0)} style="max-height:50px;"> <p class="name">${escape(company.name)}</p></div>` : `<p class="name">${escape(company.name)}</p>`} <p class="zip">〒${escape(company.zip)}</p> <p class="address">${escape(company.address1)}</p> <p class="address">${escape(company.address2)}</p> <p class="tel">${company.tel ? `<span>TEL ${escape(company.tel)}</span>` : ``} ${company.fax ? `<span>FAX ${escape(company.fax)}</span>` : ``}</p> ${company.url ? `<p class="homepage">${escape(company.url)}</p>` : ``} <p class="handler">担当:  
          ${escape(transaction.handleUser.member.tradingName ? transaction.handleUser.member.tradingName : transaction.handleUser.member.legalName)}</p> <p class="account">[振込先]
          ${escape(company.bankName)} ${escape(company.bankBranchName)} ${escape(BANK_ACCOUNT_TYPE.find((bank) => bank[0] === company.accountType)[1])} ${escape(company.accountNo)}</p></div></div></header> <main><div class="salutation" data-svelte-h="svelte-1o6qz0f"><p>毎度ありがとうございます。</p> <p>下記のとおり御請求申し上げます。</p></div> <div class="total-amount"><div class="title" data-svelte-h="svelte-1j9zlkh">合計金額</div> <div class="amount">￥${escape((parseInt(transaction.tax) + parseInt(transaction.amount)).toLocaleString())}</div></div> ${validate_component(Details, "Details").$$render($$result, { transaction }, {}, {})}</main> </div>`;
});
export {
  Invoice as default
};
