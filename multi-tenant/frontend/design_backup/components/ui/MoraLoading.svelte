<script lang="ts">
  import MovaLoading from './MovaLoading.svelte';

  interface Props {
    duration?: number;
    finalDuration?: number;
    onComplete?: () => void;
    className?: string;
    word?: string;
    subtitle?: string;
  }

  let {
    duration = 500,
    finalDuration = 700,
    onComplete,
    className = '',
    word = 'MOVA',
    subtitle = 'Menyiapkan sesi onboarding...',
  }: Props = $props();
</script>

<MovaLoading
  {duration}
  {finalDuration}
  {onComplete}
  {className}
  {word}
  {subtitle}
/>
