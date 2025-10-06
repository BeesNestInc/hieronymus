{#if ( status.state === 'list' )}
<ItemList
  bind:items={items}
  bind:status={status}
  on:open={openEntry}
  ></ItemList>
{:else if ( status.state === 'home')}
<ItemHome
  bind:status={status}></ItemHome>
{:else if ( (status.state === 'entry' || status.state === 'new') && item )}
<ItemEntry
  bind:status={status}
  bind:item={item}
  on:close={closeEntry}>
</ItemEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';
import ItemEntry from './item-entry.svelte';
import ItemList from './item-list.svelte';
import ItemHome from './item-home.svelte';
import {currentItem, getStore} from '../../javascripts/current-record.js';
import { currentPage, link } from '../../javascripts/router.js';

export let status;

let item;
let items = [];

$: checkPage($currentPage);

const	openEntry = (event)	=> {
  const detail = event.detail;
  if ( !detail || !detail.id )	{
    link(`/item/new`);
  } else {
    link(`/item/entry/${detail.id}`);
  }
};

const closeEntry = (event) => {
  link('/item/list');
}

const checkPage = (page) => {
  page = page || location.pathname;
  const args = page.split('/');
  const action = args[2] || 'list';
	status.state = action;
  switch  (action)  {
  case  'home':
    item = null;
    break;
  case  'entry':
    const entryId = args[3];
    item = null;
    axios.get(`/api/item/${entryId}`).then((result) => {
      item = result.data.item;
      currentItem.set(item);
    });
    break;
  case  'new':
    item = getStore(currentItem) || {};
    currentItem.set(item);
    break;
  case  'list':
    item = null;
    break;
  }
}

onMount(() => {
  axios.get('/api/users/member').then((result) => {
    status.users = result.data;
  });
  checkPage($currentPage);
})

afterUpdate(() => {
  //console.log('item afterUpdate');
})
</script>
