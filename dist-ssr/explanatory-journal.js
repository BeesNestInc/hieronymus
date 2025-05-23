import { create_ssr_component, validate_component, each, escape } from "svelte/internal";
import { F as Front_cover, P as Page_header } from "./assets/page-header-BV7Q2j9C.js";
import { f as formatMoney } from "./assets/utils-TI298WRP.js";
import "@formkit/tempo";
const Explanatory_journal = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { dates } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.dates === void 0 && $$bindings.dates && dates !== void 0) $$bindings.dates(dates);
  return `${validate_component(Front_cover, "FrontCover").$$render($$result, { title: "仕訳日記帳", company, fy }, {}, {})} ${each(dates, (date) => {
    return `${each(date.pages, (page, pc) => {
      return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render(
        $$result,
        {
          company,
          fy,
          title: "仕訳日記帳",
          left_item: `${date.month}月度`
        },
        {},
        {}
      )} <div class="page-body"><table class="table table-bordered"><thead data-svelte-h="svelte-mlny2y"><tr><th scope="col" colspan="2">日付 / 伝番</th> <th scope="col" style="width: 120px;">借方金額</th> <th scope="col" style="width: 100px;">借方科目<br>補助科目</th> <th scope="col">適用</th> <th scope="col" style="width: 120px;">貸方科目<br>補助科目</th> <th scope="col" style="width: 100px;">貸方金額</th> </tr></thead> <tbody>${each(page, (line) => {
        return `<tr style="height:38px;vertical-align:top;"><td style="width:40px;text-align:center;">${escape(line.month)}/${escape(line.day)}</td> <td style="width:25px;" class="number">${escape(line.no)}</td> <td class="number">${line.debitAccount !== "" ? `${escape(formatMoney(line.debitAmount))}<br> ${escape(formatMoney(line.debitTax))}` : ``}</td> <td>${escape(line.debitAccount)}<br> ${escape(line.debitSubAccount)}</td> <td><div class="appication">${escape(line.application1)}</div> <div class="appication">${escape(line.application2)} </div></td> <td>${escape(line.creditAccount)}<br> ${escape(line.creditSubAccount)}</td> <td class="number">${line.creditAccount !== "" ? `${escape(formatMoney(line.creditAmount))}<br> ${escape(formatMoney(line.creditTax))}` : ``}</td> </tr>`;
      })} ${pc + 1 === date.pages.length ? `<tr class="total"><td colspan="2" data-svelte-h="svelte-3j9027"></td> <td class="number">${escape(formatMoney(date.sums.debitAmount))}<br> ${escape(formatMoney(date.sums.debitTax))}</td> <td data-svelte-h="svelte-1h3pnm4"></td> <td data-svelte-h="svelte-wi3gtm">合計</td> <td data-svelte-h="svelte-1h3pnm4"></td> <td class="number">${escape(formatMoney(date.sums.creditAmount))}<br> ${escape(formatMoney(date.sums.creditTax))}</td> </tr>` : ``} </tbody></table> </div></div> </div>`;
    })}`;
  })}`;
});
export {
  Explanatory_journal as default
};
