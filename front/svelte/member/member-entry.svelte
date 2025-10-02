<div class="entry">
  <div class="page-title d-flex justify-content-between">
    <h1>役職員情報</h1>
  </div> 
  <div class="full-height fontsize-12pt">
    <div class="content">
      <div class="body">
        <FormError
        	messages={errorMessages}></FormError>
        <MemberInfo
          classes={classes}
          users={users}
          bind:member={member} />
      </div>
      <div class="footer">
        <button type="button" class="btn btn-secondary" disabled={disabled}
          on:click={back}>もどる</button>
        {#if ( member && member.id && member.id > 0 )}
        <button type="button" class="btn btn-danger" disabled={disabled}
          on:click={deleteMember}
          id="delete-button">削除</button>
        {/if}
        <button type="button" class="btn btn-primary" disabled={disabled}
          on:click={save}
          id="save-button">保存</button>
      </div>
    </div>
  </div>
</div>
<OkModal
  bind:this={modal}
  title={title}
  description={description}
  on:answer={doDelete}
  ></OkModal>
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {numeric, formatDate} from '../../../libs/utils.js';
import MemberInfo from './member-info.svelte';
import FormError from '../common/form-error.svelte';
import OkModal from '../common/ok-modal.svelte';
import {currentMember, getStore} from '../../javascripts/current-record.js';
import { link } from '../../javascripts/router.js';

export  let member;
export  let classes;
export  let users;
export let status;

let disabled = false;
let errorMessages = [];
let modal;
let title;
let description;

const deleteMember = (event) => {
  console.log('deleteMember', member);
  title = '役職員の削除';
  description = `
<table style="font-size:12px;">
  <tbody>
    <tr>
			<td>名前</td><td>${member.tradingName}</td>
		</tr>
    <tr>
			<td>戸籍名</td><td>${member.legalName}</td>
		</tr>
    <tr>
			<td>役職</td><td>${member.memberClass.title}</td>
		</tr>
    <tr>
			<td>誕生日</td><td>${member.birthDate ? formatDate(member.birthDate) : ''}</td>
    </tr>
  </tbody>
`;
  modal.show();
}

const doDelete = async (event) => {
  if	( event.detail )	{
  	try {
  		let result = await axios.delete(`/api/member/${member.id}`);
  		console.log(result);
    	back();
  	} catch (e) {
	    console.log(e);
  	}
  }
}

const create_member = async (_member) => {
  let result = await axios.post('/api/member', _member);
  console.log('create', result);
  return	(result);
}
const update_member = async (_member) => {
  console.log('save_member', _member);
  let result = await axios.put('/api/member', _member);
     
  console.log(result);
  return	(result);
}
const delete_member = async (member) => {
  console.log('delete_member', member);
  let result = await axios.delete('/api/member', {
    data: {
      id: member.id
    }
  });
  console.log(result);
}

const save = () => {
  errorMessages = [];
  console.log('member', member);
  if	( member.memberClassId )	{
    member.memberClassId = parseInt(member.memberClassId);
  } else {
    member.memberClassId = 0;
  }
  if  ( !member.memberClassId || member.memberClassId < 1 )  {
    errorMessages.push('種別を入力してください');
  }
  console.log('input', member);
  if  ( errorMessages.length === 0 )  {
    let	it;
    let create = false;
    if ( member.id  ) {
      member.id = parseInt(member.id);
      it = update_member(member);
    } else {
      it = create_member(member);
      create = true;
    }
    it.then((result) => {
      //console.log('result', result);
      member = result.data.member;
      if  ( member )  {
        if  ( create )  {
          link(`/member/entry/${member.id}`);
        }
      } else {
        errorMessages.push('保存できませんでした。');
      }
    }).catch((e) => {
      console.log(e);
      errorMessages.push('保存できませんでした。');
      // can't save
      //	TODO alert
    });
  }
  errorMessages = errorMessages;
};

const	back = (event) => {
  dispatch('close');
  currentMember.set(null);
}

beforeUpdate(() => {
  //console.log('member-entry beforeUpdate', member);
});


onMount(() => {
  console.log('member-entry onMount', member);
})
</script>
