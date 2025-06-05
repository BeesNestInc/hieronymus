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
import {onMount, beforeUpdate, afterUpdate, tick, createEventDispatcher} from 'svelte';
import MemberEntry from './member-entry.svelte';
import MemberList from './member-list.svelte';
import {currentMember, getStore} from '../../javascripts/current-record.js'

export let status;

let	member;
let members = [];
let users = [];
let classes = [];

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  member = event.detail;
  status.change = true;
  if ( !member || !member.id )	{
    status.state = 'new';
    member = null;
    window.history.pushState(
      status, "", `/member/new`);
  } else {
    status.state = 'entry';
    window.history.pushState(
      status, "", `/member/entry/${member.id}`);
  }
  console.log('member', member)
};

const closeEntry = (event) => {
  status.state = 'list';
}

const checkPage = async () => {
  let args = location.pathname.split('/');
  console.log({args});
  if  ( args[2] === 'home' )  {
    status.state = 'home';
  } else
  if  ( ( args[2] === 'entry' ) ||
			  ( args[2] === 'new'   )) {
    status.state = args[2];
    if  ( !member ) {
      member = {
        legalName: ''
      };
      let value = getStore(currentMember);
      if  ( value ) {
        member = value;
      } else {
        if  ( status.state === 'entry' ) {
          const result = await axios.get('/api/users?nomember=true');
          users = result.data.users;
          axios(`/api/member/${args[3]}`).then((result) => {
            member = result.data.member;
            console.log({member});
            if  ( member.user ) {
              users.push(member.user);
              users = users;
            }
            console.log('checkPage', {users});
            currentMember.set(member);
          });
        } else {
          currentMember.set(member);
        }
      }
    } else {
      let find = false;
      users.forEach((user) => {
        if  ( user.id === member.user ) {
          find = true;
        }
      })
      if  (( !find ) &&
           ( member.users ))  {
        users.push(member.user);
      }
    }
  } else {
    status.state = 'list';
  }
  console.log({status});
}

onMount(async () => {
  console.log('member onMount')
  const result = await axios.get('/api/users?nomember=true');
  users = result.data.users;
  axios.get('/api/member/classes').then((result) => {
    console.log(result);
    classes = result.data.classes;
  })
})

let _status;
beforeUpdate(async ()	=> {
  //console.log('member beforeUpdate', status.change);
  checkPage();
  if  (( status.change ) ||
       ( _status !== status ))  {
    status.change = false;
    _status = status;
  }
});
afterUpdate(() => {
  //console.log('member afterUpdate');
})
</script>
