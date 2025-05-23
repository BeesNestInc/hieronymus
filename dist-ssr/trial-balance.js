import { create_ssr_component, each, validate_component, add_attribute, escape } from "svelte/internal";
import { P as Page_header, F as Front_cover } from "./assets/page-header-BV7Q2j9C.js";
import { f as formatMoney } from "./assets/utils-TI298WRP.js";
import "@formkit/tempo";
const Print = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { company } = $$props;
  let { fy } = $$props;
  let { pages } = $$props;
  let { title } = $$props;
  let { sub_title } = $$props;
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.pages === void 0 && $$bindings.pages && pages !== void 0) $$bindings.pages(pages);
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.sub_title === void 0 && $$bindings.sub_title && sub_title !== void 0) $$bindings.sub_title(sub_title);
  return `${each(pages, (page) => {
    return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render($$result, { company, fy, title, left_item: sub_title }, {}, {})} <div class="page-body"><table class="table"><thead data-svelte-h="svelte-6xj6l3"><tr><th style="width: 100px;">勘定科目</th> <th style="width: 120px;">繰越金額</th> <th style="width: 120px;">借方金額</th> <th style="width: 120px;">貸方金額</th> <th style="width: 120px;">残高</th> </tr></thead> <tbody>${each(page, (line) => {
      return `<tr${add_attribute("class", line.total ? "total" : "", 0)}><td><!-- HTML_TAG_START -->${line.name}<!-- HTML_TAG_END --></td> <td class="number">${escape(formatMoney(line.pickup))}</td> <td class="number">${escape(formatMoney(line.debit))}</td> <td class="number">${escape(formatMoney(line.credit))}</td> <td class="number">${escape(formatMoney(line.balance))}</td> </tr>`;
    })} </tbody></table> </div></div> </div>`;
  })}`;
});
const Trial_balance = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { company } = $$props;
  let { fy } = $$props;
  let { assetPages } = $$props;
  let { liabilitiesAndCapicalPages } = $$props;
  let { incomeStatementPages } = $$props;
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.assetPages === void 0 && $$bindings.assetPages && assetPages !== void 0) $$bindings.assetPages(assetPages);
  if ($$props.liabilitiesAndCapicalPages === void 0 && $$bindings.liabilitiesAndCapicalPages && liabilitiesAndCapicalPages !== void 0) $$bindings.liabilitiesAndCapicalPages(liabilitiesAndCapicalPages);
  if ($$props.incomeStatementPages === void 0 && $$bindings.incomeStatementPages && incomeStatementPages !== void 0) $$bindings.incomeStatementPages(incomeStatementPages);
  return `${validate_component(Front_cover, "FrontCover").$$render($$result, { title: "残高試算表", company, fy }, {}, {})} ${assetPages ? `${validate_component(Print, "Print").$$render(
    $$result,
    {
      company,
      fy,
      title: "残高試算表",
      sub_title: "貸借対照表 資産の部",
      pages: assetPages
    },
    {},
    {}
  )}` : ``} ${liabilitiesAndCapicalPages ? `${validate_component(Print, "Print").$$render(
    $$result,
    {
      company,
      fy,
      title: "残高試算表",
      sub_title: "貸借対照表 負債・資本の部",
      pages: liabilitiesAndCapicalPages
    },
    {},
    {}
  )}` : ``} ${incomeStatementPages ? `${validate_component(Print, "Print").$$render(
    $$result,
    {
      company,
      fy,
      title: "残高試算表",
      sub_title: "損益計算書",
      pages: incomeStatementPages
    },
    {},
    {}
  )}` : ``}`;
});
export {
  Trial_balance as default
};
