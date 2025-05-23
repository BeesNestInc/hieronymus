<div class="full-height fontsize-12pt">
  <div class="col-9">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th scope="col">
            名前
          </th>
          <th scope="col">
            管理者
          </th>
          <th scope="col">
            会計
          </th>
          <th scope="col">
            会計(閲覧)
          </th>
          <th scope="col">
            承認可能
          </th>
          <th scope="col">
            顧客管理
          </th>
          <th scope="col">
            在庫管理
          </th>
          <th scope="col">
            人事管理
          </th>
          <th scope="col">
            停止
          </th>
          <th scope="col">
            削除
          </th>
        </tr>
      </thead>
      <tbody>
        {#each data as line}
        <tr class="fontsize-12pt">
          <td>
            {line.name}
          </td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.administrable}
            	on:change={() => {
              	change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.accounting}
            	on:change={() => {
              	change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.fiscalBrowsing}
            	on:change={() => {
              change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.approvable}
            on:change={() => {
              change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.companyManagement}
            on:change={() => {
              change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.inventoryManagement}
            on:change={() => {
              change(line);
            }}>
        	</td>
          <td class="checkbox">
            <input type="checkbox" class="w-100" bind:checked={line.personnelManagement}
              on:change={() => {
                change(line);
              }}>
          </td>
          <td class="checkbox">
            {#if ( line.id != 1) }
            {#if (( line.deauthorizedAt === null ) || line.deauthorizedAt < new Date ())}
            <button type="button" class="btn btn-danger btn-sm"
            on:click={() => {
              deauthorize(line);
            }}>
            	停止
            </button>
            {:else}
            <button type="button" class="btn btn-primary btn-sm"
              on:click={() => {
                deauthorize(line);
              }}>
              再開
            </button>
            {/if}
            {/if}
          </td>
          <td class="checkbox">
            {#if ( line.id != 1) }
            <button type="button" class="btn btn-danger btn-sm"
              on:click={() => {
                remove(line);
              }}>
              <i class="fas fa-times"></i>
            </button>
            {/if}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
th {
  text-align: center;
}
td {
  padding: 10px 5px 5px 5px;
}
td.checkbox {
  width: 100px;
  text-align: center;
}
input[type="checkbox"] {
  height:30px;
  margin:0px;
  font-size:12pt;
}
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';

let	data = [];

const change = (line) => {
  //console.log('value', line);
  axios.put(`/api/user/${line.id}`, line).then((result) => {
    console.log('status', result.data.status);
    if	( result.data.code == 0 ) {
      axios.get(`/api/users/`).then((result) => {
        data = result.data.users;
      });
    } else {

    }
  })
}

const remove = (line) => {
  //console.log('value', line);
  axios.delete(`/api/user/${line.id}`).then((result) => {
    console.log('status', result.data.status);
    if	( result.data.code == 0 ) {
      axios.get(`/api/users/`).then((result) => {
        data = result.data.users;
      });
    } else {

    }
  })
}

const deauthorize = (line) => {
  console.log('deauthorize');
  let at = ( line.deauthorizedAt === null ) ? new Date() : null;
  //console.log('value', line);
  axios.put(`/api/user/${line.id}`, {
    deauthorizedAt: at
  }).then((result) => {
    console.log('status', result.data.code);
    if	( result.data.code == 0 ) {
      axios.get(`/api/users/`).then((result) => {
        data = result.data.users;
      });
    } else {

    }
  })
}

onMount(() => {
  axios.get(`/api/users/`).then((result) => {
    data = result.data.users;
  });
});
beforeUpdate(() => {
});
</script>
