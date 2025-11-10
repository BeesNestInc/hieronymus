<label for="format" class="col-1 col-form-label">形式</label>
<div class="col-2" id="format">
  <select class="form-control w-100"
    bind:value={type} disabled={disabled}>
    {#each DOC_FORMAT as opt}
    <option value={opt[0]}>{opt[1]}</option>
    {/each}
  </select>
</div>

<script>
const DOC_FORMAT = [
  ["file",      ""],
  ["text",      "Text"],
  ["markdown",  "Markdown"],
  ["html",      "HTML"]
];

export let type;
export let disabled;
</script>