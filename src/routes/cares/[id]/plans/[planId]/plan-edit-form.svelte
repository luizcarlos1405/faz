<script lang="ts">
  import type { Recurrence, OverdueBehavior } from '$lib/types';
  import type { TaskPlan, CareDoc, PlanType, FixedDaysSubtype } from '$lib/types';
  import {
    PLAN_TYPE,
    RECURRENCE_TYPE,
    INTERVAL_SUBTYPE,
    FIXED_DAYS_SUBTYPE,
    ISO_WEEKDAYS,
    MONTH_SHORT_NAMES,
    OVERDUE_BEHAVIOR,
  } from '$lib/types';
  import {
    buildRecurrence,
    isValidRecurrence,
    isIntervalPlanType,
  } from '$lib/engines/recurrence-wizard';
  import IntervalPicker from '$lib/components/interval-picker.svelte';
  import MonthDayPicker from '$lib/components/month-day-picker.svelte';
  import Save from 'lucide-svelte/icons/save';
  import Plus from 'lucide-svelte/icons/plus';

  let {
    plan,
    allCares,
    defaultCareId,
    onsave,
  }: {
    plan: TaskPlan;
    allCares: CareDoc[];
    defaultCareId: string;
    onsave: (
      updates: { title: string; recurrence: Recurrence; overdueBehavior: OverdueBehavior },
      selectedCareId: string,
    ) => Promise<void>;
  } = $props();

  function seedPlanForm(plan: TaskPlan) {
    let planType: PlanType = PLAN_TYPE.INTERVAL_FIXED.value;
    let planInterval: { years: number; months: number; weeks: number; days: number } = {
      years: 0,
      months: 0,
      weeks: 0,
      days: 0,
    };
    let planDaysSubtype: FixedDaysSubtype = FIXED_DAYS_SUBTYPE.WEEKDAYS.value;
    let planDaysOfWeek: number[] = [];
    let planDaysOfMonth: number[] = [];
    let planYearDates: { month: number; day: number }[] = [];
    let planOverdueBehavior: OverdueBehavior = plan.overdueBehavior ?? OVERDUE_BEHAVIOR.KEEP.value;

    if (
      plan.recurrence.type === RECURRENCE_TYPE.INTERVAL.value &&
      plan.recurrence.subtype === INTERVAL_SUBTYPE.FIXED.value
    ) {
      planType = PLAN_TYPE.INTERVAL_FIXED.value;
      planInterval = {
        years: plan.recurrence.interval.years ?? 0,
        months: plan.recurrence.interval.months ?? 0,
        weeks: plan.recurrence.interval.weeks ?? 0,
        days: plan.recurrence.interval.days ?? 0,
      };
    } else if (
      plan.recurrence.type === RECURRENCE_TYPE.INTERVAL.value &&
      plan.recurrence.subtype === INTERVAL_SUBTYPE.AFTER_DONE.value
    ) {
      planType = PLAN_TYPE.INTERVAL_AFTER_DONE.value;
      planInterval = {
        years: plan.recurrence.interval.years ?? 0,
        months: plan.recurrence.interval.months ?? 0,
        weeks: plan.recurrence.interval.weeks ?? 0,
        days: plan.recurrence.interval.days ?? 0,
      };
    } else if (plan.recurrence.type === RECURRENCE_TYPE.FIXED_DAYS.value) {
      planType = PLAN_TYPE.FIXED_DAYS.value;
      planDaysSubtype = plan.recurrence.subtype;
      if (plan.recurrence.subtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value) {
        planDaysOfWeek = [...plan.recurrence.daysOfWeek];
      } else if (plan.recurrence.subtype === FIXED_DAYS_SUBTYPE.MONTHDAYS.value) {
        planDaysOfMonth = [...plan.recurrence.daysOfMonth];
      } else {
        planYearDates = plan.recurrence.dates.map((d: { month: number; day: number }) => ({
          ...d,
        }));
      }
    }

    if (planType === PLAN_TYPE.INTERVAL_AFTER_DONE.value) {
      planOverdueBehavior = OVERDUE_BEHAVIOR.KEEP.value;
    }

    return {
      title: plan.title,
      planType,
      planInterval,
      planDaysSubtype,
      planDaysOfWeek,
      planDaysOfMonth,
      planYearDates,
      planStartDate: plan.recurrence.startDate,
      planOverdueBehavior,
    };
  }

  // svelte-ignore state_referenced_locally
  const seed = seedPlanForm(plan);

  let title: string = $state(seed.title);
  // svelte-ignore state_referenced_locally
  let selectedCareId: string = $state(defaultCareId);
  let planType: PlanType = $state(seed.planType);
  let planInterval: { years: number; months: number; weeks: number; days: number } = $state(
    seed.planInterval,
  );
  let planDaysSubtype: FixedDaysSubtype = $state(seed.planDaysSubtype);
  let planDaysOfWeek: number[] = $state(seed.planDaysOfWeek);
  let planDaysOfMonth: number[] = $state(seed.planDaysOfMonth);
  let planYearDates: { month: number; day: number }[] = $state(seed.planYearDates);
  let intervalPickerOpen = $state(false);
  let wheelOpen = $state(false);
  let editIdx = $state(-1);
  let wheelMonth: string | number = $state(1);
  let wheelDay: string | number = $state(1);
  let planStartDate: string = $state(seed.planStartDate);
  let planOverdueBehavior: OverdueBehavior = $state(seed.planOverdueBehavior);

  function wizardInput() {
    return {
      scheduleType: planType,
      interval: planInterval,
      daysSubtype: planDaysSubtype,
      daysOfWeek: planDaysOfWeek,
      daysOfMonth: planDaysOfMonth,
      yearDates: planYearDates,
      startDate: planStartDate,
    };
  }

  function buildCurrentRecurrence(): Recurrence {
    return buildRecurrence(wizardInput());
  }

  function canSave(): boolean {
    if (!title.trim()) return false;
    return isValidRecurrence(wizardInput());
  }

  async function handleSave() {
    await onsave(
      {
        title: title.trim(),
        recurrence: buildCurrentRecurrence(),
        overdueBehavior: planOverdueBehavior,
      },
      selectedCareId,
    );
  }

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
</script>

<div class="card card-border bg-base-200">
  <div class="card-body p-4 gap-3">
    <label class="label" for="plan-title">
      <span class="label-text">Task title</span>
    </label>
    <input
      id="plan-title"
      type="text"
      class="input input-sm"
      placeholder="e.g. Water plants"
      bind:value={title}
    />

    <label class="label" for="plan-care">
      <span class="label-text">Care</span>
    </label>
    <select id="plan-care" class="select select-sm" bind:value={selectedCareId}>
      {#each allCares as c (c._id)}
        <option value={c._id}>{c.title}</option>
      {/each}
    </select>

    <label class="label" for="plan-schedule-type">
      <span class="label-text">Schedule type</span>
    </label>
    <select
      id="plan-schedule-type"
      class="select select-sm"
      bind:value={planType}
      onchange={() => {
        if (planType === PLAN_TYPE.INTERVAL_AFTER_DONE.value) {
          planOverdueBehavior = OVERDUE_BEHAVIOR.KEEP.value;
        }
        if (isIntervalPlanType(planType)) intervalPickerOpen = true;
      }}
    >
      <option value={PLAN_TYPE.INTERVAL_FIXED.value}>Fixed interval (e.g. every 2 weeks)</option>
      <option value={PLAN_TYPE.INTERVAL_AFTER_DONE.value}
        >After completion (e.g. 3 days after done)</option
      >
      <option value={PLAN_TYPE.FIXED_DAYS.value}>Specific days (e.g. every wednesday)</option>
    </select>

    {#if isIntervalPlanType(planType)}
      <span class="label-text">Interval</span>
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
          if (planDaysSubtype === FIXED_DAYS_SUBTYPE.YEARDAYS.value) openWheelNew();
        }}
      >
        <option value={FIXED_DAYS_SUBTYPE.WEEKDAYS.value}>Days of the week</option>
        <option value={FIXED_DAYS_SUBTYPE.MONTHDAYS.value}>Days of the month</option>
        <option value={FIXED_DAYS_SUBTYPE.YEARDAYS.value}>Dates of the year</option>
      </select>

      {#if planDaysSubtype === FIXED_DAYS_SUBTYPE.WEEKDAYS.value}
        <div class="flex flex-wrap gap-1 mt-1">
          {#each ISO_WEEKDAYS as entry (entry.iso)}
            <button
              class="btn btn-sm {planDaysOfWeek.includes(entry.iso) ? 'btn-primary' : 'btn-ghost'}"
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
          class="input input-sm mt-1"
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
        <div class="flex flex-wrap gap-2 items-center mt-1">
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

    <label class="label" for="plan-start-date">
      <span class="label-text">Start date</span>
    </label>
    <input id="plan-start-date" type="date" class="input input-sm" bind:value={planStartDate} />

    {#if planType !== PLAN_TYPE.INTERVAL_AFTER_DONE.value}
      <label class="label" for="plan-overdue">
        <span class="label-text">If the date passes</span>
      </label>
      <select id="plan-overdue" class="select select-sm" bind:value={planOverdueBehavior}>
        <option value={OVERDUE_BEHAVIOR.KEEP.value}>Keep it</option>
        <option value={OVERDUE_BEHAVIOR.MISSED.value}>Mark missed</option>
        <option value={OVERDUE_BEHAVIOR.DISCARD.value}>Discard</option>
      </select>
    {/if}

    <div class="flex justify-end mt-2">
      <button class="btn btn-primary btn-sm" disabled={!canSave()} onclick={handleSave}>
        <Save class="size-4" />
        Save
      </button>
    </div>
  </div>
</div>

<MonthDayPicker
  bind:open={wheelOpen}
  bind:month={wheelMonth}
  bind:day={wheelDay}
  editing={editIdx >= 0}
  onconfirm={confirmWheel}
  onremove={removeDate}
/>
