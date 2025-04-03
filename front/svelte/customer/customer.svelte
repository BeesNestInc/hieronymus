{#if ( status.state === 'list' )}
<CustomerList
	bind:status={status}
  customers={customers}
  on:selectKind={selectKind}
  on:open={openEntry}></CustomerList>
{:else if ( status.state === 'home')}
<CustomerHome
  bind:status={status}
></CustomerHome>
{:else}
<CustomerEntry
	bind:status={status}
	bind:customer={customer}
  on:close={closeEntry}></CustomerEntry>
{/if}

<style>
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import CustomerEntry from './customer-entry.svelte';
import CustomerList from './customer-list.svelte';
import {currentCustomer, getStore} from '../../javascripts/current-record.js'
import { buildParam, parseParams } from '../../javascripts/params';
import CustomerHome from './customer-home.svelte';

export let status;

let	customer;
let customers = [];

const selectKind = (event) => {
  updateCustomers({});
}

const updateCustomers = (_params) => {
  let param = buildParam(status, _params);
  //console.log('param', param);
  axios.get(`/api/customer?${param}`).then((result) => {
    customers = result.data.customers;
    console.log({customers});
  });
  if	( _params )	{
    window.history.pushState(
        status, "", `${location.pathname}?${param}`);
  }
};

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  customer = event.detail;
  if ( !customer || !customer.id )	{
    status.state = 'new';
    window.history.pushState(
      status, "", `/customer/new`);
  } else {
    status.state = 'entry';
    axios(`/api/customer/${customer.id}`).then((result) => {
      customer = result.data.customer;
      window.history.pushState(
        status, "", `/customer/entry/${customer.id}`);
    });
  }
  //console.log('invoice', invoice)
};

const closeEntry = (event) => {
  console.log('close');
  status.state = 'list';
  updateCustomers();
}

const checkPage = () => {
  let args = location.pathname.split('/');
  // /customer/26
  // /customer/
  console.log('checkPage', {args});
  if	( args[2] === 'home' )	{
		status.state = 'home';
  } else
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
		if	( !customer )	{
      customer = {};
      let value = getStore(currentCustomer);
      //console.log({value});
		  if	( value )	{
        customer = value;
      } else {
        if	( status.state === 'entry' )	{
          axios.get(`/api/customer/${args[3]}`).then((result) => {
            customer = result.data.customer;
            currentCustomer.set(customer)
          });
        } else {
          currentCustomer.set(customer);
        }
      }
    }
  } else {
    status.state = 'list';
  }
}

onMount(() => {
  console.log('customer onMount');
  status.params = parseParams();
  axios.get(`/api/customer/kinds`).then((result) => {
    status.customerClasses = result.data.values;
  });
  updateCustomers();
})

beforeUpdate(()	=> {
  //console.log('customer.svelte', {customer});
  checkPage();
});
afterUpdate(() => {
})

</script>
