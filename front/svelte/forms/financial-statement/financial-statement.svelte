<FrontCover
	title="決算報告書"
  {fy}
  {company}
  ></FrontCover>
<BalanceSheet
  {fy}
  {company}
  {bsLines}
  {asset}
  {liabilities}
  {networth}
  ></BalanceSheet>
<PL
  {fy}
  {company}
  {plOut}
  ></PL>
<SGA
  {fy}
  {company}
  {sgaPage}
  {sgaSum}
  ></SGA>
<script>
import FrontCover from '../components/front-cover.svelte';
import BalanceSheet from './balance-sheet.svelte';
import PL from './pl.svelte';
import SGA from './SGA.svelte';

export let fy;
export let company;
export let bsLines;
export let plOut;
export let sgaPage;
export let asset;
export let liabilities;
export let networth;
export let sgaSum;

</script>