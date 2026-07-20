<script lang="ts">
  import { route } from './lib/router'
  import Home from './Home.svelte'
  import Room from './Room.svelte'
  import Diag from './Diag.svelte'
</script>

{#if $route.name === 'home'}
  <Home />
{:else if $route.name === 'room'}
  {#key `${$route.slug}:${$route.deck}`}
    <Room slug={$route.slug} deck={$route.deck} />
  {/key}
{:else if $route.name === 'diag'}
  <Diag />
{/if}
