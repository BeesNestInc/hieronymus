import { create_ssr_component, each, add_attribute, escape, validate_component } from "svelte/internal";
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
const Estimate = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { transaction } = $$props;
  let { company } = $$props;
  console.log("estimate.svelte");
  const formatDate = (dateStr, fallback) => {
    if (!dateStr) return fallback;
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };
  const formatNumber = (num) => {
    return num.toLocaleString();
  };
  if ($$props.transaction === void 0 && $$bindings.transaction && transaction !== void 0) $$bindings.transaction(transaction);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  return `${$$result.head += `<!-- HEAD_svelte-o8bx9w_START -->${$$result.title = `<title>見積書::Hieronymus</title>`, ""}<meta http-equiv="Content-Language" content="ja"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/public/bootstrap-icons/font/bootstrap-icons.css"><link rel="stylesheet" href="/style/transaction.css"><!-- HEAD_svelte-o8bx9w_END -->`, ""} <div class="transaction"><header class="estimate-header"><div class="info"><p class="strong">${escape(transaction.customerName)} 御中</p> <p class="strong"><span data-svelte-h="svelte-i9zerr">件名</span> ${escape(transaction.subject)}</p> <div class="salutation" data-svelte-h="svelte-16p9b6p"><p>下記の通り御見積申し上げます。</p></div> <div class="condition" data-svelte-h="svelte-kjt7kp"><p class="title">納入場所</p> <p class="item">お打ち合わせ通り</p></div> <div class="condition"><p class="title" data-svelte-h="svelte-dxgehe">支払条件</p> <p class="item">${escape(transaction.paymentMethod || "")}</p></div> <div class="condition"><p class="title" data-svelte-h="svelte-wt64gz">納期</p> <p class="item">${escape(formatDate(transaction.deliveryLimit, "お打ち合わせ通り"))}</p></div> <div class="condition"><p class="title" data-svelte-h="svelte-10f6jdg">有効期限</p> <p class="item">${escape(formatDate(transaction.expiringDate, "御見積後１ヶ月以内"))}</p></div></div> <div class=""><div class="title-info"><div class="title-line"><h1 data-svelte-h="svelte-1fxlgph">御見積書</h1> <div style="margin-left:20px;margin-top:10px;font-size:14px;"><span>No. ${escape(transaction.no)}</span></div></div> <p>発行日: ${escape(formatDate(transaction.issueDate))}</p></div> <div class="company-info">${company.logo ? `<div class="company-name-with-logo"><img${add_attribute("src", company.logo, 0)} style="max-height:50px;"> <p class="name">${escape(company.name)}</p></div>` : `<p class="name">${escape(company.name)}</p>`} <p class="zip">〒${escape(company.zip)}</p> ${each(company.address, (address) => {
    return `<p class="address">${escape(address)}</p>`;
  })} <p class="tel">${company.tel ? `<span>TEL ${escape(company.tel)}</span>` : ``} ${company.fax ? `<span>FAX ${escape(company.fax)}</span>` : ``}</p> ${company.homepage ? `<p class="homepage">${escape(company.homepage)}</p>` : ``} <p class="handler">担当: 
          ${transaction.handleUser.member.tradingName ? `${escape(transaction.handleUser.member.tradingName)}` : `${escape(transaction.handleUser.member.officialName)}`}</p></div></div></header> <main><div class="total-amount"><div class="title" data-svelte-h="svelte-a27zxh">合計金額</div> <div class="amount">￥${escape(formatNumber(parseInt(transaction.tax) + parseInt(transaction.amount)))}</div></div> ${validate_component(Details, "Details").$$render($$result, { transaction }, {}, {})}</main> </div>`;
});
export {
  Estimate as default
};
