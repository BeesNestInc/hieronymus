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
  if ( !page ) {
    return;
  }
  const args = page.split('/');
  const page_state = args[2];

  if (page_state === 'home') {
		status.state = 'home';
    item = null;
  } else if (page_state === 'entry') {
    status.state = 'entry';
    const entry_id = args[3];
    item = null;
    axios.get(`/api/item/${entry_id}`).then((result) => {
      item = result.data.item;
      currentItem.set(item);
    });
  } else if (page_state === 'new') {
    status.state = 'new';
    item = getStore(currentItem) || {};
    currentItem.set(item);
  } else {
    status.state = 'list';
    item = null;
  }
}

onMount(() => {
  axios.get('/api/users/member').then((result) => {
    status.users = result.data;
  });
  checkPage($currentPage);
})

$: checkPage($currentPage);

afterUpdate(() => {
  //console.log('item afterUpdate');
})
</script>
