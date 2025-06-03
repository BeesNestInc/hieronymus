{#if ( status.state === 'list' )}
<MemberList
  members={members}
  classes={classes}
  bind:status={status}
  on:selectClass={selectClass}
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
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import MemberEntry from './member-entry.svelte';
import MemberList from './member-list.svelte';
import {currentMember, getStore} from '../../javascripts/current-record.js'
import {parseParams, buildParam} from '../../javascripts/params.js';

export let status;

let	member;
let members = [];
let users = [];
let classes = [];

const selectClass = (event) => {
  updateMember({
    memberClassId: event.detail
  });
}

const updateMember = (_params) => {
  let param = buildParam(status, _params);
  console.log('param', param);
  axios.get(`/api/member?${param}`).then((result) => {
    members = result.data.members;
    console.log('members', members);
  });
  if	( _params )	{
    window.history.pushState(
      status, "", `${location.pathname}?${param}`);
  }
}

const	openEntry = (event)	=> {
  console.log('open', event.detail);
  member = event.detail;
  if ( !member || !member.id )	{
    status.state = 'new';
    member = null;
    window.history.pushState(
      status, "", `/member/new`);
  } else {
    status.state = 'entry';
    axios.get(`/api/member/${member.id}`).then((result) => {
      member = result.data.member;
      window.history.pushState(
        status, "", `/member/entry/${member.id}`);
    });
  }
  console.log('member', member)
};

const closeEntry = (event) => {
  status.state = 'list';
  updateMember();
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
  status.params = parseParams();
  updateMember();
  axios.get('/api/member/classes').then((result) => {
    console.log(result);
    classes = result.data.classes;
  })
})

beforeUpdate(()	=> {
  checkPage();
});
afterUpdate(() => {
  //console.log('member afterUpdate');
})
</script>
