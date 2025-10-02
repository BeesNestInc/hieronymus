{#if ( status.state === 'list' )}
<MemberList
  bind:members={members}
  classes={classes}
  bind:status={status}
  on:open={openEntry}
  ></MemberList>
{:else if ( status.state === 'entry' || status.state === 'new' )}
  <MemberEntry
    classes={classes}
    users={users}
    bind:status={status}
    bind:member={member}
    on:close={closeEntry}>
  </MemberEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, afterUpdate} from 'svelte';
import MemberEntry from './member-entry.svelte';
import MemberList from './member-list.svelte';
import {currentMember, getStore} from '../../javascripts/current-record.js';
import { currentPage, link } from '../../javascripts/router.js';

export let status;

let member;
let members = [];
let users = [];
let classes = [];

const	openEntry = (event)	=> {
  const detail = event.detail;
  if ( !detail || !detail.id )	{
    link(`/member/new`);
  } else {
    link(`/member/entry/${detail.id}`);
  }
};

const closeEntry = (event) => {
  link('/member/list');
}

const checkPage = (page) => {
  if (!page) return;
  const args = page.split('/');
  const page_state = args[2];

  if (page_state === 'entry') {
    status.state = 'entry';
    const entry_id = args[3];
    axios.get(`/api/member/${entry_id}`).then((result) => {
      member = result.data.member;
      if (member && member.user) {
        let found = users.find(u => u.id === member.user.id);
        if (!found) {
          users = [...users, member.user];
        }
      }
      currentMember.set(member);
    });
  } else if (page_state === 'new') {
    status.state = 'new';
    member = getStore(currentMember) || {};
    currentMember.set(member);
  } else {
    status.state = 'list';
    member = null;
  }
}

onMount(() => {
  axios.get('/api/users?nomember=true').then(result => {
    users = result.data.users;
  });
  axios.get('/api/member/classes').then((result) => {
    classes = result.data.classes;
  });
  checkPage($currentPage);
})

$: checkPage($currentPage);

afterUpdate(() => {
  //console.log('member afterUpdate');
})
</script>
