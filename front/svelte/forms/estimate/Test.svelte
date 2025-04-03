<script>
    export let params;
    console.log('🔥 Test.svelte loaded!');
    console.log('🧪 params:', params);
  </script>
  
  <h1 style="color: white; background: red; font-size: 48px;">
    ✅ Test.svelte 表示中！
  </h1>
  
  <p style="font-size: 24px;">params.id = {params?.id}</p>
  