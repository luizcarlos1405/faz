<script lang="ts">
  import { getTaskPlanEditState, describeRecurrence } from '../../../cares-page-state.svelte';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';
  import type { Recurrence, OverdueBehavior } from '$lib/types';
  import { goto } from '$app/navigation';
  import { getConfirmState } from '$lib/components/confirm-state.svelte';
  import PlanEditForm from './plan-edit-form.svelte';

  const careId = page.params.id!;
  const planId = page.params.planId!;
  const ctrl = getTaskPlanEditState(careId, planId);

  onMount(() => ctrl.load());

  async function handlePlanSave(
    updates: { title: string; recurrence: Recurrence; overdueBehavior: OverdueBehavior },
    selectedCareId: string,
  ) {
    await ctrl.saveAndMove(updates, selectedCareId);
    goto(resolve(`/cares/${careId}`));
  }

  async function handleDelete() {
    if (await getConfirmState().confirm({ message: 'Remove this task plan?' })) {
      await ctrl.deletePlan();
      goto(resolve(`/cares/${careId}`));
    }
  }
</script>

<div class="p-4">
  <div class="flex justify-between mb-2">
    <a href={resolve(`/cares/${careId}`)} class="btn btn-ghost btn-sm">
      <ArrowLeft class="size-4" />
      Back
    </a>
    {#if ctrl.plan}
      <button class="btn btn-ghost btn-sm text-error" onclick={handleDelete}>
        <Trash2 class="size-4" />
        Delete
      </button>
    {/if}
  </div>

  {#if ctrl.loading}
    <div class="flex justify-center py-8">
      <LoaderCircle class="size-6 animate-spin text-base-content/40" />
    </div>
  {:else if ctrl.plan}
    <h1 class="text-2xl font-bold mb-4">{ctrl.plan.title}</h1>

    {#key ctrl.plan._id}
      <PlanEditForm
        plan={ctrl.plan}
        allCares={ctrl.allCares}
        defaultCareId={careId}
        onsave={handlePlanSave}
      />
    {/key}

    {#if ctrl.plan.recurrence}
      <div class="mt-4 text-xs text-base-content/40">
        Current schedule: {describeRecurrence(ctrl.plan.recurrence)}
      </div>
    {/if}
  {/if}
</div>
