{#if ( status.state === 'list' )}
<CompanyList
	bind:status={status}
  bind:companies={companies}
  on:open={openEntry}></CompanyList>
{:else if ( status.state === 'home')}
<CompanyHome
  bind:status={status}
></CompanyHome>
{:else}
  {#if (status.state === 'entry' && company && company.id) || (status.state === 'new' && company)}
  <CompanyEntry
	  bind:status={status}
	  bind:company={company}
    on:close={closeEntry}></CompanyEntry>
  {/if}
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import CompanyEntry from './company-entry.svelte';
import CompanyList from './company-list.svelte';
import {currentCompany, getStore} from '../../javascripts/current-record.js'
import CompanyHome from './company-home.svelte';
import { link, currentPage } from '../../javascripts/router.js';

export let status;

let	company;
let companies = [];

$: checkPage($currentPage);

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  status.state = args[2] || 'list';

  switch  (status.state) {
  case  'home':
    break;
  case  'entry':
  case  'new':
    if	( !company )	{
      company = {};
      let value = getStore(currentCompany);
      if	( value )	{
        company = value;
      } else {
        if	( status.state === 'entry' )	{
          axios.get(`/api/company/${args[3]}`).then((result) => {
            company = result.data.company;
            currentCompany.set(company)
          });
        } else {
          let params = new URLSearchParams(location.search);
          company.companyClassId = params.get('kind') ? parseInt(params.get('kind')) : undefined;
          currentCompany.set(company);
        }
      }
    }
    break;
  default:
    break;
  }
  console.log('company', status);
}

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  const company_data = event.detail;
  if ( !company_data || !company_data.id )	{
    link('/company/new');
  } else {
    link(`/company/entry/${company_data.id}`);
  }
};

const closeEntry = (event) => {
  // This event is handled by the child component's history.back()
  // or by the parent component in inline mode.
  // No navigation logic is needed here.
}

onMount(() => {
  console.log('company onMount');
  checkPage($currentPage);
})

afterUpdate(() => {
})

</script>
