<script lang="ts">
  import {
    LOGO_F_PATH,
    LOGO_F_WIDTH,
    LOGO_GAP_WIDTH,
    LOGO_TICK_PATH,
    LOGO_TICK_WIDTH,
    LOGO_VIEWBOX,
  } from '$lib/utils/faz-logo';

  let { class: className = '', draw = 0 }: { class?: string; draw?: number } = $props();

  const uid = $props.id();
  const maskId = `faz-logo-gap-${uid}`;
</script>

<svg viewBox={LOGO_VIEWBOX} class={className} aria-hidden="true">
  {#key draw}
    <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff" />
      <path
        class:tick={draw > 0}
        d={LOGO_TICK_PATH}
        pathLength="1"
        fill="none"
        stroke="#000"
        stroke-width={LOGO_GAP_WIDTH}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </mask>
    <path
      d={LOGO_F_PATH}
      fill="none"
      stroke="currentColor"
      stroke-width={LOGO_F_WIDTH}
      stroke-linecap="round"
      mask="url(#{maskId})"
    />
    <path
      class="stroke-primary"
      class:tick={draw > 0}
      d={LOGO_TICK_PATH}
      pathLength="1"
      fill="none"
      stroke-width={LOGO_TICK_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/key}
</svg>

<style>
  .tick {
    stroke-dasharray: 1 1.2;
    animation: draw-tick 420ms cubic-bezier(0.3, 0.7, 0.4, 1) 120ms both;
  }

  @keyframes draw-tick {
    from {
      stroke-dashoffset: 1.05;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tick {
      animation: none;
    }
  }
</style>
