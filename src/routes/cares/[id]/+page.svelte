<script lang="ts">
  import { getCareDetailState, describeRecurrence } from '../cares-page-state.svelte';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import Plus from 'lucide-svelte/icons/plus';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';
  import GripVertical from 'lucide-svelte/icons/grip-vertical';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Check from 'lucide-svelte/icons/check';
  import { tick } from 'svelte';
  import type { Recurrence, OverdueBehavior } from '$lib/types';
  import {
    PLAN_TYPE,
    RECURRENCE_TYPE,
    INTERVAL_SUBTYPE,
    FIXED_DAYS_SUBTYPE,
    ISO_WEEKDAYS,
    MONTH_SHORT_NAMES,
    OVERDUE_BEHAVIOR,
  } from '$lib/types';
  import type { PlanType, FixedDaysSubtype } from '$lib/types';
  import { goto } from '$app/navigation';
  import { getConfirmState } from '$lib/components/confirm-state.svelte';
  import { Temporal } from '@js-temporal/polyfill';
  import { orderableChildren } from '$lib/attachments/orderableChildren';
  import IntervalPicker from '$lib/components/interval-picker.svelte';
  import MonthDayPicker from '$lib/components/month-day-picker.svelte';
  import { flip } from 'svelte/animate';

  const careId = page.params.id!;
  const ctrl = getCareDetailState(careId);
  let isDragging = $state(false);
  let editingTitle = $state(false);
  let draftTitle = $state('');
  let titleInput: HTMLInputElement | undefined = $state();

  async function startEditTitle() {
    if (!ctrl.care) return;
    draftTitle = ctrl.care.title;
    editingTitle = true;
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function saveTitle() {
    if (!ctrl.care) return;
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== ctrl.care.title) {
      ctrl.renameCare(trimmed);
    }
    editingTitle = false;
  }

  function cancelTitle() {
    editingTitle = false;
  }

  onMount(() => ctrl.load());

  async function handleDelete() {
    if (await getConfirmState().confirm({ message: 'Remove this care and all its task plans?' })) {
      await ctrl.deleteCare();
      goto(resolve('/cares'));
    }
  }

  let newPlanTitle: string = $state('');
  let planStep: number = $state(0);
  let planType: PlanType = $state(PLAN_TYPE.INTERVAL_FIXED.value);
  let planInterval: { years: number; months: number; weeks: number; days: number } = $state({
    years: 0,
    months: 0,
    weeks: 0,
    days: 0,
  });
  let planDaysSubtype: FixedDaysSubtype = $state(FIXED_DAYS_SUBTYPE.WEEKDAYS.value);
  let planDaysOfWeek: number[] = $state([]);
  let planDaysOfMonth: number[] = $state([]);
  let planYearDates: { month: number; day: number }[] = $state([]);
  let intervalPickerOpen = $state(false);
  let wheelOpen = $state(false);
  let editIdx = $state(-1);
  let wheelMonth: string | number = $state(1);
  let wheelDay: string | number = $state(1);
  let planStartDate: string = $state(Temporal.Now.plainDateISO().toString());
  let planOverdueBehavior: OverdueBehavior = $state(OVERDUE_BEHAVIOR.KEEP.value);

  function openWheelNew() {
    editIdx = -1;
    wheelMonth = 1;
    wheelDay = 1;
    wheelOpen = true;
  }

  function openWheelEdit(idx: number) {
    editIdx = idx;
    wheelMonth = planYearDates[idx].month;
    wheelDay = planYearDates[idx].day;
    wheelOpen = true;
  }

  function confirmWheel() {
    const date = { month: Number(wheelMonth), day: Number(wheelDay) };
    if (editIdx >= 0) {
      planYearDates = planYearDates.map((d, i) => (i === editIdx ? date : d));
    } else {
      planYearDates = [...planYearDates, date];
    }
    wheelOpen = false;
  }

  function removeDate() {
    if (editIdx >= 0) {
      planYearDates = planYearDates.filter((_, i) => i !== editIdx);
    }
    wheelOpen = false;
  }

  function resetWizard() {
    newPlanTitle = '';
    planStep = 0;
    planType = PLAN_TYPE.INTERVAL_FIXED.value;
    planInterval = { years: 0, months: 0, weeks: 0, days: 0 };
    planDaysSubtype = FIXED_DAYS_SUBTYPE.WEEKDAYS.value;
    planDaysOfWeek = [];
    planDaysOfMonth = [];
    planYearDates = [];
    planStartDate = Temporal.Now.plainDateISO().toString();
    planOverdueBehavior = OVERDUE_BEHAVIOR.KEEP.value;
    intervalPickerOpen = false;
    wheelOpen = false;
  }

  function toDurationLike() {
    return {
      years: planInterval.years || undefined,
      months: planInterval.months || undefined,
      weeks: planInterval.weeks || undefined,
      days: planInterval.days || undefined,
    };
  }

  function buildRecurrence(): Recurrence {
    if (planType === PLAN_TYPE.INTERVAL_FIXED.value) {
      return {
        type: RECURRENCE_TYPE.INTERVAL.value,
        subtype: INTERVAL_SUBTYPE.FIXED.value,
        interval: toDurationLike(),
        startDate: planStartDate,
      };
    }
    if (planType === PLAN_TYPE.INTERVAL_AFTER_DONE.value) {
      return {
        type: RECURRENCE_TYPE.INTERVAL.value,
        subtype: INTERVAL_SUBTYPE.AFTER_DONE.value,
        interval: toDurationLike(),
        startDate: planStartDate,
      };
    }
    if (planDaysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) {
      return {
        type: RECURRENCE_TYPE.FIXED_DAYS.value,
        subtype: FIXED_DAYS_SUBTYPE.WEEKDAYS.value,
        daysOfWeek: planDaysOfWeek,
        startDate: planStartDate,
      };
    }
    if (planDaysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) {
      return {
        type: RECURRENCE_TYPE.FIXED_DAYS.value,
        subtype: FIXED_DAYS_SUBTYPE.MONTHDAYS.value,
        daysOfMonth: planDaysOfMonth,
        startDate: planStartDate,
      };
    }
    return {
      type: RECURRENCE_TYPE.FIXED_DAYS.value,
      subtype: FIXED_DAYS_SUBTYPE.YEARDAYS.value,
      dates: planYearDates,
      startDate: planStartDate,
    };
  }

  function canCreate(): boolean {
    if (!newPlanTitle.trim()) return false;
    if (planType.startsWith('INTERVAL')) {
      const { years, months, weeks, days } = planInterval;
      return years + months + weeks + days > 0;
    }
    if (planDaysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) return planDaysOfWeek.length > 0;
    if (planDaysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) return planDaysOfMonth.length > 0;
    return planYearDates.length > 0;
  }

  async function handleCreate() {
    await ctrl.addTaskPlan({
      title: newPlanTitle.trim(),
      recurrence: buildRecurrence(),
      overdueBehavior: planOverdueBehavior,
    });
    resetWizard();
  }
</script>

<div class="p-4">
  <div class="flex justify-between mb-2">
    <a href={resolve('/cares')} class="btn btn-ghost btn-sm">
      <ArrowLeft class="size-4" />
      Back
    </a>
    {#if ctrl.care}
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
  {:else if ctrl.care}
    <div class="flex items-center gap-2 mb-4">
      {#if editingTitle}
        <input
          bind:this={titleInput}
          type="text"
          class="input input-sm text-2xl font-bold flex-1"
          bind:value={draftTitle}
          onkeydown={(e) => {
            if (e.key === 'Enter') saveTitle();
            if (e.key === 'Escape') cancelTitle();
          }}
          onblur={() => setTimeout(cancelTitle, 0)}
        />
        <button class="btn btn-ghost btn-sm" onmousedown={saveTitle}>
          <Check class="size-4" />
        </button>
      {:else}
        <h1 class="text-2xl font-bold flex-1">{ctrl.care.title}</h1>
        <button class="btn btn-ghost btn-sm" onclick={startEditTitle}>
          <Pencil class="size-4" />
        </button>
      {/if}
    </div>

    {#if ctrl.care.taskPlans.length > 0}
      <h2 class="text-sm font-semibold text-base-content/60 uppercase mb-2">Task plans</h2>
      <ul
        class="list mb-6"
        {@attach orderableChildren({
          startEvents: ['mousedown', 'touchstart'],
          handleSelector: '.drag-handle',
          onStart: () => {
            isDragging = true;
          },
          onEnd: () => {
            isDragging = false;
            ctrl.persistPlansOrder();
          },
          onMove: ({ fromIndex, toIndex }) => {
            ctrl.reorderPlans(fromIndex, toIndex);
          },
        })}
      >
        {#each ctrl.care.taskPlans as plan (plan._id)}
          <li class="list-row bg-base-100 w-full" animate:flip={{ duration: 200 }}>
            <a href={resolve(`/cares/${careId}/plans/${plan._id}`)} class="list-col-grow">
              <div class="font-medium">{plan.title}</div>
              <div class="text-xs text-base-content/50">{describeRecurrence(plan.recurrence)}</div>
              {#if plan.lastDoAtDate}
                <div class="text-xs text-base-content/40">Last generated: {plan.lastDoAtDate}</div>
              {/if}
            </a>
            <div
              class:cursor-grab={!isDragging}
              class:cursor-grabbing={isDragging}
              class="drag-handle flex pr-2 ml-auto items-center"
            >
              <GripVertical class="size-6 text-base-content/30" />
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-base-content/50 text-center py-4 mb-4">
        No task plans yet. Add one to get started.
      </p>
    {/if}

    {#if !ctrl.showWizard}
      <button
        class="btn btn-primary btn-sm"
        onclick={() => {
          resetWizard();
          ctrl.showWizard = true;
        }}
      >
        <Plus class="size-4" />
        Add task plan
      </button>
    {:else}
      <div class="card card-border bg-base-200 mt-4">
        <div class="card-body p-4 gap-3">
          <h3 class="font-semibold">New task plan</h3>

          {#if planStep >= 0}
            <label class="label" for="plan-title">
              <span class="label-text">Task title</span>
            </label>
            <input
              id="plan-title"
              type="text"
              class="input input-sm"
              placeholder="e.g. Water plants"
              bind:value={newPlanTitle}
            />
          {/if}

          {#if planStep >= 1}
            <label class="label" for="plan-schedule-type">
              <span class="label-text">Schedule type</span>
            </label>
            <select
              id="plan-schedule-type"
              class="select select-sm"
              bind:value={planType}
              onchange={() => {
                planStep = Math.max(planStep, 2);
                if (planType.startsWith('INTERVAL')) intervalPickerOpen = true;
              }}
            >
              <option value={PLAN_TYPE.INTERVAL_FIXED.value}
                >Fixed interval (e.g. every 2 weeks)</option
              >
              <option value={PLAN_TYPE.INTERVAL_AFTER_DONE.value}
                >After completion (e.g. 3 days after done)</option
              >
              <option value={PLAN_TYPE.FIXED_DAYS.value}
                >Specific days (e.g. every wednesday)</option
              >
            </select>
          {/if}

          {#if planStep >= 2}
            {#if planType.startsWith('INTERVAL')}
              <label class="label" for="plan-interval">
                <span class="label-text">Interval</span>
              </label>
              <IntervalPicker bind:interval={planInterval} bind:open={intervalPickerOpen} />
            {:else}
              <label class="label" for="plan-day-type">
                <span class="label-text">Day type</span>
              </label>
              <select
                id="plan-day-type"
                class="select select-sm"
                bind:value={planDaysSubtype}
                onchange={() => {
                  planStep = Math.max(planStep, 3);
                  if (planDaysSubtype === FIXED_DAYS_SUBTYPE.YEARDAYS.value) openWheelNew();
                }}
              >
                <option value={FIXED_DAYS_SUBTYPE.WEEKDAYS.value}>Days of the week</option>
                <option value={FIXED_DAYS_SUBTYPE.MONTHDAYS.value}>Days of the month</option>
                <option value={FIXED_DAYS_SUBTYPE.YEARDAYS.value}>Dates of the year</option>
              </select>
            {/if}
          {/if}

          {#if planStep >= 3 && planType === PLAN_TYPE.FIXED_DAYS.value}
            {#if planDaysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value}
              <div class="flex flex-wrap gap-1">
                {#each ISO_WEEKDAYS as entry (entry.iso)}
                  <button
                    class="btn btn-sm {planDaysOfWeek.includes(entry.iso)
                      ? 'btn-primary'
                      : 'btn-ghost'}"
                    onclick={() => {
                      if (planDaysOfWeek.includes(entry.iso)) {
                        planDaysOfWeek = planDaysOfWeek.filter((d) => d !== entry.iso);
                      } else {
                        planDaysOfWeek = [...planDaysOfWeek, entry.iso];
                      }
                    }}
                  >
                    {entry.name}
                  </button>
                {/each}
              </div>
            {:else if planDaysSubtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value}
              <input
                type="text"
                class="input input-sm"
                placeholder="Days: 1, 15, 31"
                value={planDaysOfMonth.join(', ')}
                oninput={(e) => {
                  planDaysOfMonth = (e.target as HTMLInputElement).value
                    .split(',')
                    .map((s) => parseInt(s.trim()))
                    .filter((n) => n >= 1 && n <= 31);
                }}
              />
            {:else}
              <div class="flex flex-wrap gap-2 items-center">
                {#each planYearDates as d, i (i)}
                  <button class="btn btn-sm btn-outline" onclick={() => openWheelEdit(i)}>
                    {MONTH_SHORT_NAMES[d.month]}
                    {d.day}
                  </button>
                {/each}
                <button class="btn btn-sm btn-ghost" onclick={openWheelNew}>
                  <Plus class="size-4" />
                </button>
              </div>
            {/if}
          {/if}

          {#if planStep >= 4}
            <label class="label" for="plan-start-date">
              <span class="label-text">Start date</span>
            </label>
            <input
              id="plan-start-date"
              type="date"
              class="input input-sm"
              bind:value={planStartDate}
            />
          {/if}

          {#if planStep >= 5}
            <label class="label" for="plan-overdue">
              <span class="label-text">If the date passes</span>
            </label>
            <select id="plan-overdue" class="select select-sm" bind:value={planOverdueBehavior}>
              <option value={OVERDUE_BEHAVIOR.KEEP.value}>Keep it</option>
              <option value={OVERDUE_BEHAVIOR.MISSED.value}>Mark missed</option>
              <option value={OVERDUE_BEHAVIOR.DISCARD.value}>Discard</option>
            </select>
          {/if}

          <div class="flex gap-2 mt-2">
            <button
              class="btn btn-ghost btn-sm"
              onclick={() => {
                ctrl.showWizard = false;
                resetWizard();
              }}>Cancel</button
            >
            <div class="flex-1"></div>
            {#if planStep > 0}
              <button class="btn btn-ghost btn-sm" onclick={() => planStep--}>Back</button>
            {/if}
            {#if planStep < 5}
              <button
                class="btn btn-sm"
                onclick={() => {
                  planStep++;
                  if (planStep === 2 && planType.startsWith('INTERVAL')) intervalPickerOpen = true;
                }}>Next</button
              >
            {/if}
            {#if planStep === 5}
              <button class="btn btn-primary btn-sm" disabled={!canCreate()} onclick={handleCreate}>
                Add
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <MonthDayPicker
    bind:open={wheelOpen}
    bind:month={wheelMonth}
    bind:day={wheelDay}
    editing={editIdx >= 0}
    onconfirm={confirmWheel}
    onremove={removeDate}
  />
</div>
