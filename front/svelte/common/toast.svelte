<ToastContainer let:data={data}>
  <FlatToast {data} /> <!-- Provider template for your toasts -->
</ToastContainer>
<script>
import { toasts, ToastContainer, FlatToast, BootstrapToast }  from "svelte-toasts";
let toast;
// svelte-toastsはuidにDate.now()を使うため、同一ミリ秒に2回showすると
// 重複キーでSvelteの更新全体が例外死する（スピナー固着等の原因）。
// ここでミリ秒をずらして衝突を防ぐ（全トーストの単一の funnel）。
let lastMs = 0;
export const show = (title, description, type='success') => {
  const now = Date.now();
  if ( now <= lastMs ) {
    setTimeout(() => show(title, description, type), lastMs - now + 1);
    return;
  }
  lastMs = now;
  toast = toasts.add({
    title: title,
    description: description,
    duration: 3000,
    placement: 'top-center',
    type: type,
    theme: 'dark',
    onClick: () => {},
    onRemove: () => {},
    component: BootstrapToast, 
  });
    // toast.remove()
}
export const remove = () => {
  toast.remove();
}
</script>