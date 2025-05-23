import { create_ssr_component, each, validate_component, escape } from "svelte/internal";
import { P as Page_header } from "./page-header-BV7Q2j9C.js";
import { f as formatMoney } from "./utils-TI298WRP.js";
const Ledger_page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { company } = $$props;
  let { fy } = $$props;
  let { title } = $$props;
  let { ledgerPage } = $$props;
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.ledgerPage === void 0 && $$bindings.ledgerPage && ledgerPage !== void 0) $$bindings.ledgerPage(ledgerPage);
  return `${each(ledgerPage.pages, (page, pc) => {
    return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render(
      $$result,
      {
        company,
        fy,
        title: ledgerPage.name,
        right_item: title
      },
      {},
      {}
    )} <div class="page-body"><table class="table"><thead data-svelte-h="svelte-mpeerj"><tr><th colspan="2">日付 / 伝番</th> <th style="width: 100px;">相手勘定科目<br>相手補助科目</th> <th>適用<br>補助科目</th> <th style="width: 100px;">借方金額</th> <th style="width: 100px;">貸方金額</th> <th style="width: 100px;">残高</th> </tr></thead> <tbody>${pc === 0 ? `<tr style="height:12px;"><td colspan="3" data-svelte-h="svelte-1fjppnk"></td> <td data-svelte-h="svelte-10ofrai">繰越金額</td> <td class="number" data-svelte-h="svelte-15brwo8"></td> <td class="number" data-svelte-h="svelte-15brwo8"></td> <td class="number">${escape(formatMoney(ledgerPage.pickup))}</td> </tr>` : ``} ${each(page.lines, (line) => {
      return `<tr style="height:36px;"><td style="width:40px;text-align:center;">${escape(line.month)}/${escape(line.day)}</td> <td class="number" style="width:25px;">${escape(line.no)}</td> <td>${escape(line.otherAccount)}<br> ${escape(line.otherSubAccount)}</td> <td><div class="appication">${escape(line.application1 || "")}</div> <div class="appication">${escape(line.application2 || "")}</div> <div class="application" data-svelte-h="svelte-1gbfxo7"></div> ${line.subAccount ? `<div class="application">${escape(line.subAccount)} </div>` : ``}</td> <td class="number">${escape(line.thisTaxClass)}<br> ${line.showDebit ? `<span>${escape(formatMoney(line.pureDebitAmount))}<br> ${escape(formatMoney(line.pureDeitTax))} </span>` : ``}</td> <td class="number">${escape(line.otherTaxClass)}<br> ${line.showCredit ? `<span>${escape(formatMoney(line.pureCreditAmount))}<br> ${escape(formatMoney(line.pureCreditTax))} </span>` : ``}</td> <td class="number"><br><br> ${escape(formatMoney(line.pureBalance))}</td> </tr>`;
    })} ${pc + 1 === ledgerPage.pages.length ? `<tr class="total" style="height:36px;"><td colspan="3" data-svelte-h="svelte-1fjppnk"></td> <td data-svelte-h="svelte-wi3gtm">合計</td> <td class="number">${escape(formatMoney(ledgerPage.sums.debitAmount))}<br> ${escape(formatMoney(ledgerPage.sums.debitTax))}</td> <td class="number">${escape(formatMoney(ledgerPage.sums.creditAmount))}<br> ${escape(formatMoney(ledgerPage.sums.creditTax))}</td> <td class="number">${escape(formatMoney(ledgerPage.sums.balance))}</td> </tr>` : ``} </tbody></table> </div></div> </div>`;
  })}`;
});
export {
  Ledger_page as L
};
