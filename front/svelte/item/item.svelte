{#if ( status.state === 'list' )}
<ItemList
  bind:items={items}
  bind:status={status}
  on:open={openEntry}
  ></ItemList>
{:else if ( status.state === 'home')}
<ItemHome
  bind:status={status}></ItemHome>
{:else if ( status.state === 'entry' || status.state === 'new' )}
<ItemEntry
  bind:status={status}
  bind:item={item}
  on:close={closeEntry}>
</ItemEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import ItemEntry from './item-entry.svelte';
import ItemList from './item-list.svelte';
import ItemHome from './item-home.svelte';
import {currentItem, getStore} from '../../javascripts/current-record.js'

export let status;

let item;
let items = [];

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  item = event.detail;
  if ( !item || !item.id )	{
    item = null;
    status.state = 'new';
    window.history.pushState(
      status, "", `/item/new`);
  } else {
    status.state = 'entry';
    axios.get(`/api/item/${item.id}`).then((result) => {
      item = result.data.item;
      window.history.pushState(
        status, "", `/item/entry/${item.id}`);
    });
  }
  console.log({status})
};

const closeEntry = (event) => {
  status.state = 'list';
}

const checkPage = () => {
  let args = location.pathname.split('/');
  if	( args[2] === 'home' )	{
		status.state = 'home';
  } else
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
    if  ( !item )  {
      item = {}
      let value = getStore(currentItem);
      console.log({value});
      if  ( value ) {
        item = value;
      } else {
        if  ( args[2] === 'entry' ) {
          status.state = 'entry';
          axios(`/api/item/${args[3]}`).then((result) => {
            item = result.data.item;
            console.log({item});
            currentItem.set(item);
          });
        } else {
          currentItem.set(item);
        }
      }
    }
  } else {
    status.state = 'list';
  }
}

onMount(() => {
  console.log('item onMount')
  axios.get('/api/users/member').then((result) => {
    status.users = result.data;
  })
})

beforeUpdate(()	=> {
  checkPage();
});
afterUpdate(() => {
  //console.log('item afterUpdate');
})
</script>
