<script lang="ts">
  import MonitoringMap from '../../components/map/MonitoringMap.svelte';

  interface Props {
    onNavigate: (route: string) => void;
  }

  let { onNavigate }: Props = $props();
</script>

<div class="w-full h-full relative overflow-hidden">
  <MonitoringMap {onNavigate} />
</div>
