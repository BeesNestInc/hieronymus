import { create_ssr_component, validate_component, each } from "svelte/internal";
import { F as Front_cover } from "./assets/page-header-BV7Q2j9C.js";
import { L as Ledger_page } from "./assets/ledger-page-bw9g7RlE.js";
import "./assets/utils-TI298WRP.js";
import "@formkit/tempo";
const Subsidiary_ledger = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { fy } = $$props;
  let { company } = $$props;
  let { ledgerPages } = $$props;
  if ($$props.fy === void 0 && $$bindings.fy && fy !== void 0) $$bindings.fy(fy);
  if ($$props.company === void 0 && $$bindings.company && company !== void 0) $$bindings.company(company);
  if ($$props.ledgerPages === void 0 && $$bindings.ledgerPages && ledgerPages !== void 0) $$bindings.ledgerPages(ledgerPages);
  return `${validate_component(Front_cover, "FrontCover").$$render($$result, { title: "補助元帳", fy, company }, {}, {})} ${each(ledgerPages, (ledgerPage) => {
    return `${validate_component(Ledger_page, "LedgerPage").$$render($$result, { fy, company, title: "補助元帳", ledgerPage }, {}, {})}`;
  })}`;
});
export {
  Subsidiary_ledger as default
};
