{#if ( status.state === 'list' )}
<MemberList
  bind:members={members}
  classes={classes}
  bind:status={status}
  on:open={openEntry}
  ></MemberList>
{:else if ( (status.state === 'entry' && member && member.id) || (status.state === 'new' && member) )}
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

$: checkPage($currentPage);

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
  const action = args[2];

  status.state = action;
  switch  (action)  {
  case  'entry':
    const entryId = args[3];
    member = null;
    axios.get(`/api/member/${entryId}`).then((result) => {
      member = result.data.member;
      if (member && member.user) {
        let found = users.find(u => u.id === member.user.id);
        if (!found) {
          users = [...users, member.user];
        }
      }
      currentMember.set(member);
    });
    break;
  case  'new':
    member = getStore(currentMember) || {};
    currentMember.set(member);
    break;
  default:
    status.state = 'list';
    member = null;
    const params = new URLSearchParams(page.split('?')[1] || '');
    axios.get(`/api/member?${params.toString()}`).then(result => {
      members = result.data.members;
    });
    break;
  }
}

onMount(() => {
  axios.get('/api/users?nomember=true').then(result => {
    users = result.data.users;
  });
  axios.get('/api/member/classes').then((result) => {
    classes = result.data.values;
  });
  checkPage($currentPage);
})

afterUpdate(() => {
  //console.log('member afterUpdate');
})
</script>
