import { create_ssr_component, escape } from "svelte/internal";
import { a as formatDate } from "./utils-TI298WRP.js";
const Front_cover = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { title } = $$props;
  let { company } = $$props;
  let { fy } = $$props;
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  return `${$$result.head += `<!-- HEAD_svelte-821l00_START -->${$$result.title = `<title>${escape(title)}::Hieronymus</title>`, ""}<meta http-equiv="Content-Language" content="ja"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/style/paperA4.css"><!-- HEAD_svelte-821l00_END -->`, ""} <div class="page"><div class="title-page"><div class="title">${escape(title)}</div> <div class="company-name">${escape(company.name)}</div> <div class="term">${escape(fy.year)}年度</div> <div class="month">${escape(formatDate(fy.startDate))}〜
      ${escape(formatDate(fy.endDate))}</div></div> </div>`;
});
const Page_header = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { company } = $$props;
  let { fy } = $$props;
  let { title } = $$props;
  let { right_item } = $$props;
  let { left_item } = $$props;
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.title === void 0 && $$bindings.title && title !== void 0) $$bindings.title(title);
  if ($$props.right_item === void 0 && $$bindings.right_item && right_item !== void 0) $$bindings.right_item(right_item);
  if ($$props.left_item === void 0 && $$bindings.left_item && left_item !== void 0) $$bindings.left_item(left_item);
  return `<div class="page-header"><div class="ledger-title">${escape(title)}</div> <div class="company-name">${escape(company.name)}</div> <div class="term">${escape(fy.year)}年度</div> <div class="date">${escape(formatDate(null))}</div> <div class="left-item">${escape(left_item || "")}</div> <div class="right-item">${escape(right_item || "")}</div> </div>`;
});
export {
  Front_cover as F,
  Page_header as P
};
