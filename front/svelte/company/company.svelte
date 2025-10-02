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

const checkPage = () => {
  const args = location.pathname.split('/');
  const page_state = args[2];

  if (page_state === 'home') {
    status.state = 'home';
  } else if (page_state === 'entry' || page_state === 'new') {
    status.state = page_state;
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
  } else {
    status.state = 'list';
  }
  console.log('company', status);
}

onMount(() => {
  console.log('company onMount');
  checkPage();
})

$: $currentPage, checkPage();

afterUpdate(() => {
})

</script>
