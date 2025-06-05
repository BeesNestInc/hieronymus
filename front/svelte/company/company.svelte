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
<CompanyEntry
	bind:status={status}
	bind:company={company}
  on:close={closeEntry}></CompanyEntry>
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

export let status;

let	company;
let companies = [];

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  company = event.detail;
  if ( !company || !company.id )	{
    status.state = 'new';
    window.history.pushState(
      status, "", `/company/new`);
  } else {
    status.state = 'entry';
    axios(`/api/company/${company.id}`).then((result) => {
      company = result.data.company;
      window.history.pushState(
        status, "", `/company/entry/${company.id}`);
    });
  }
  //console.log('invoice', invoice)
};

const closeEntry = (event) => {
  //console.log('close');
  status.state = 'list';
}

const checkPage = () => {
  let args = location.pathname.split('/');
  // /company/26
  // /company/
  //console.log('checkPage', {args});
  if	( args[2] === 'home' )	{
		status.state = 'home';
  } else
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
		if	( !company )	{
      company = {};
      let value = getStore(currentCompany);
      //console.log({value});
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
          console.log(params);
          company.companyClassId = params.get('kind') ? parseInt(params.get('kind')) : undefined;
          currentCompany.set(company);
        }
      }
    }
  } else {
    status.state = 'list';
  }
  //console.log('company', status);
}

onMount(() => {
  console.log('company onMount');
})

beforeUpdate(()	=> {
  //console.log('company.svelte', {company});
  checkPage();
});
afterUpdate(() => {
})

</script>
