import { create_ssr_component, validate_component, each, escape } from "svelte/internal";
import { P as Page_header, F as Front_cover } from "./assets/page-header-BV7Q2j9C.js";
import { f as formatMoney } from "./assets/utils-TI298WRP.js";
import "@formkit/tempo";
const Balance_sheet = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { bsLines } = $$props;
  let { asset } = $$props;
  let { liabilities } = $$props;
  let { networth } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.bsLines === void 0 && $$bindings.bsLines && bsLines !== void 0) $$bindings.bsLines(bsLines);
  if ($$props.asset === void 0 && $$bindings.asset && asset !== void 0) $$bindings.asset(asset);
  if ($$props.liabilities === void 0 && $$bindings.liabilities && liabilities !== void 0) $$bindings.liabilities(liabilities);
  if ($$props.networth === void 0 && $$bindings.networth && networth !== void 0) $$bindings.networth(networth);
  return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render($$result, { company, fy, title: "貸借対照表" }, {}, {})} <div class="page-body"><table class="table-report"><thead data-svelte-h="svelte-1bgohg9"><tr><th colspan="2">資産の部</th> <th colspan="2">負債の部</th></tr> <tr><th>科目</th> <th>金額</th> <th>科目</th> <th>金額</th></tr></thead> <tbody>${each(bsLines, (line) => {
    return `<tr><!-- HTML_TAG_START -->${line}<!-- HTML_TAG_END --> </tr>`;
  })} <tr class="total"><td data-svelte-h="svelte-f3h06k">資産合計</td> <td class="number">${escape(formatMoney(asset))}</td> <td data-svelte-h="svelte-dnqvec">負債・純資産合計</td> <td class="number">${escape(formatMoney(liabilities + networth))}</td></tr></tbody></table></div></div> </div>`;
});
const Pl = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { plOut } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.plOut === void 0 && $$bindings.plOut && plOut !== void 0) $$bindings.plOut(plOut);
  return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render($$result, { company, fy, title: "損益計算書" }, {}, {})} <div class="page-body"><table class="table-report"><thead data-svelte-h="svelte-11lahh4"><tr><th colspan="2">科目</th> <th colspan="2">金額</th></tr></thead> <tbody>${each(plOut, (line) => {
    return `<tr><td class="no-border">${escape(line.left_title || "")}</td> <td class="no-border">${escape(line.right_title || "")}</td> <td class="${"number" + escape(line.left_line ? " pl-line" : " left-border", true)}">${escape(formatMoney(line.left_value))}</td> <td class="${"number" + escape(line.right_line ? " pl-line" : " left-border", true)}">${escape(formatMoney(line.right_value))}</td> </tr>`;
  })}</tbody></table></div></div> </div>`;
});
const SGA = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { sgaPage } = $$props;
  let { sgaSum } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.sgaPage === void 0 && $$bindings.sgaPage && sgaPage !== void 0) $$bindings.sgaPage(sgaPage);
  if ($$props.sgaSum === void 0 && $$bindings.sgaSum && sgaSum !== void 0) $$bindings.sgaSum(sgaSum);
  return `<div class="page"><div class="detail-page">${validate_component(Page_header, "PageHeader").$$render($$result, { company, fy, title: "販売費及び一般管理費内訳書" }, {}, {})} <div class="page-body"><table class="table-narrow"><thead data-svelte-h="svelte-r517ck"><tr><th>科目</th> <th>金額</th></tr></thead> <tbody>${each(sgaPage, (line) => {
    return `<tr><td class="no-border">${escape(line.name)}</td> <td class="number left-border">${escape(formatMoney(line.amount))}</td> </tr>`;
  })} <tr class="total"><td data-svelte-h="svelte-xi0vge">合計</td> <td class="number">${escape(formatMoney(sgaSum))}</td></tr></tbody></table></div></div> </div>`;
});
const Financial_statement = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { bsLines } = $$props;
  let { plOut } = $$props;
  let { sgaPage } = $$props;
  let { asset } = $$props;
  let { liabilities } = $$props;
  let { networth } = $$props;
  let { sgaSum } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.bsLines === void 0 && $$bindings.bsLines && bsLines !== void 0) $$bindings.bsLines(bsLines);
  if ($$props.plOut === void 0 && $$bindings.plOut && plOut !== void 0) $$bindings.plOut(plOut);
  if ($$props.sgaPage === void 0 && $$bindings.sgaPage && sgaPage !== void 0) $$bindings.sgaPage(sgaPage);
  if ($$props.asset === void 0 && $$bindings.asset && asset !== void 0) $$bindings.asset(asset);
  if ($$props.liabilities === void 0 && $$bindings.liabilities && liabilities !== void 0) $$bindings.liabilities(liabilities);
  if ($$props.networth === void 0 && $$bindings.networth && networth !== void 0) $$bindings.networth(networth);
  if ($$props.sgaSum === void 0 && $$bindings.sgaSum && sgaSum !== void 0) $$bindings.sgaSum(sgaSum);
  return `${validate_component(Front_cover, "FrontCover").$$render($$result, { title: "決算報告書", fy, company }, {}, {})} ${validate_component(Balance_sheet, "BalanceSheet").$$render(
    $$result,
    {
      fy,
      company,
      bsLines,
      asset,
      liabilities,
      networth
    },
    {},
    {}
  )} ${validate_component(Pl, "PL").$$render($$result, { fy, company, plOut }, {}, {})} ${validate_component(SGA, "SGA").$$render($$result, { fy, company, sgaPage, sgaSum }, {}, {})}`;
});
export {
  Financial_statement as default
};
