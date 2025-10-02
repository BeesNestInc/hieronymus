<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>役職員一覧</h1>
    <button type="button" class="btn btn-primary"
      on:click={() => {
        openMember(null);
      }}
      id="member-info">役職員入力&nbsp;<i class="bi bi-pencil-square"></i></button>
  </div> 
  <div class="full-height-1 fontsize-12pt">
    <table class="table table-bordered">
      <thead class="table-light">
        <tr>
          <th scope="col" style="width: 150px;">
            クラス
          </th>
          <th scope="col" style="width: 150px;">
            名前
          </th>
          <th scope="col" style="width: 100px;">
            入社年度
          </th>
          <th scope="col" style="width: 140px;">
            誕生日(年齢)
          </th>
          <th scope="col"></th>
        </tr>
        <tr>
          <th style="padding:5px;">
            <select class="form-select" id="memberClass"
              on:input={
                (event) => {
                  updateMember({
                    memberClassId: event.currentTarget.value
                  });
                }
              }
              bind:value={memberClassId}>
              <option value={-1}>未設定</option>
              {#each classes as line}
              <option value={line.id}>{line.title}</option>
              {/each}
            </select>
          </th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each members as line}
        <tr>
          <td>
            {line.memberClass.title}
          </td>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
                openMember(line.id);
              }}>
              {line.tradingName ? line.tradingName : line.legalName}
            </button>
          </td>
          <td>
            {#if line.joiningDate}
            {line.joiningDate.replaceAll('-', '/')}
            {/if}
          </td>
          <td>
            {#if line.birthDate}
            {line.birthDate.replaceAll('-', '/')}
            ({age(line.birthDate)})
            {/if}
          </td>
          <td></td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
</style>

<script>
import axios from 'axios';

import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {age} from '../../../libs/utils';
import {parseParams, buildParam} from '../../javascripts/params.js';
import { link, currentPage, getStore } from '../../javascripts/router.js';

export let status;
export	let	members;
export  let classes;

let memberClassId;

const updateMember = (_params) => {
  let param = buildParam(status, _params);
  axios.get(`/api/member?${param}`).then((result) => {
    members = result.data.members;
  });
  if	( _params )	{
    const page = getStore(currentPage);
    const basePath = page ? page.split('?')[0] : '/member/list';
    link(`${basePath}?${param}`);
  }
}

onMount(() => {
  status.params = parseParams();
  memberClassId = status.params.memberClassId || -1;
  updateMember();
})
beforeUpdate(() => {
  //console.log('item-list beforeUpdate');
});

const openMember = (id) => {
  let	member;
  if  ( id ) {
    for ( let i = 0; i < members.length; i ++ ) {
      if ( members[i].id == id ) {
        member = members[i];
        break;
      }
    }
  }
  dispatch('open', member);
}
</script>
