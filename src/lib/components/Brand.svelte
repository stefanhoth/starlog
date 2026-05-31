<script lang="ts">
  export let size: 'sm' | 'lg' = 'sm';
</script>

<div class="flex items-center {size === 'sm' ? 'gap-2' : 'gap-1'}">
  <img
    src="{import.meta.env.BASE_URL}icons/icon-192.png"
    alt="StarLog"
    class={size === 'sm' ? 'w-8 h-8' : 'w-12 h-12'}
  />
  <span class="font-bold tracking-tight {size === 'sm' ? 'text-sm text-base-content' : 'text-4xl'}">
    Star<span style="color: #8f74db">Log</span>
  </span>
</div>
