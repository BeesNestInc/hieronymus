import { create_ssr_component, each, validate_component, escape } from "svelte/internal";
import { P as Page_header, F as Front_cover } from "./assets/page-header-BV7Q2j9C.js";
import { t as taxClass, f as formatMoney } from "./assets/utils-TI298WRP.js";
import { L as Ledger_page } from "./assets/ledger-page-bw9g7RlE.js";
import "@formkit/tempo";
const Account_page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { company } = $$props;
  let { fy } = $$props;
  let { title } = $$props;
  let { accountPages } = $$props;
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.accountPages === void 0 && $$bindings.accountPages && accountPages !== void 0) $$bindings.accountPages(accountPages);
  return `${each(accountPages, (page) => {
    return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render($$result, { company, fy, title, left_item: "科目一覧" }, {}, {})} <div class="page-body"><table class="table"><thead data-svelte-h="svelte-38vvxo"><tr><th style="width: 70px;">科目コード</th> <th>勘定科目</th> <th style="width: 40px;">税区分</th> <th style="width: 120px;">借方</th> <th style="width: 120px;">貸方</th> <th style="width: 120px;">残高</th> </tr></thead> <tbody>${each(page, (line) => {
      return `<tr><td class="number">${escape(line.code)}</td> <td>${escape(line.name)}</td> <td>${escape(taxClass(line.taxClass))}</td> <td class="number">${escape(formatMoney(line.debit))}</td> <td class="number">${escape(formatMoney(line.credit))}</td> <td class="number">${escape(formatMoney(line.balance))}</td> </tr>`;
    })} </tbody></table> </div></div> </div>`;
  })}`;
});
const General_ledger = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { accountPages } = $$props;
  let { ledgerPages } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.accountPages === void 0 && $$bindings.accountPages && accountPages !== void 0) $$bindings.accountPages(accountPages);
  if ($$props.ledgerPages === void 0 && $$bindings.ledgerPages && ledgerPages !== void 0) $$bindings.ledgerPages(ledgerPages);
  return `${validate_component(Front_cover, "FrontCover").$$render($$result, { title: "総勘定元帳", fy, company }, {}, {})} ${accountPages ? `${validate_component(Account_page, "AccountPage").$$render(
    $$result,
    {
      title: "総勘定元帳",
      fy,
      company,
      accountPages
    },
    {},
    {}
  )} ${each(ledgerPages, (ledgerPage) => {
    return `${validate_component(Ledger_page, "LedgerPage").$$render($$result, { fy, company, title: "総勘定元帳", ledgerPage }, {}, {})}`;
  })}` : ``}`;
});
export {
  General_ledger as default
};
