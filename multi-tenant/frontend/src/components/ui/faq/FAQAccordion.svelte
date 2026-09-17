<script lang="ts">
  import { cn } from "$lib/utils";
  import { Accordion } from "bits-ui";
  import { Badge, type BadgeVariant } from "$components/ui/badge";

  export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category?: string;
    badgeVariant?: BadgeVariant;
  }

  interface FAQAccordionProps {
    items: FAQItem[];
    class?: string;
  }

  let { items, class: className = "" }: FAQAccordionProps = $props();
</script>

<div class={cn("w-full space-y-3 font-sans", className)}>
  <Accordion.Root type="multiple" class="w-full space-y-3">
    {#each items as item}
      <Accordion.Item
        value={item.id}
        class="group rounded-2xl border border-white/10 bg-[#131316] transition-all duration-200 data-[state=open]:border-[#FF634A]/40 data-[state=open]:bg-[#18181b]"
      >
        <Accordion.Header class="flex">
          <Accordion.Trigger
            class="flex flex-1 items-center justify-between px-6 py-5 text-left font-heading text-base font-semibold text-[#fafafa] transition-colors hover:text-[#FF634A] [&[data-state=open]>i]:rotate-45"
          >
            <div class="flex items-center gap-3">
              {#if item.category}
                <Badge variant={item.badgeVariant || "in-review"}>
                  {item.category}
                </Badge>
              {/if}
              <span>{item.question}</span>
            </div>
            <i class="bx bx-plus text-xl text-zinc-400 transition-transform duration-200 ease-out group-data-[state=open]:text-[#FF634A]"></i>
          </Accordion.Trigger>
        </Accordion.Header>

        <Accordion.Content
          class="overflow-hidden px-6 text-sm text-zinc-400 leading-relaxed transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
        >
          <div class="pb-5 pt-2 border-t border-white/[0.06]">
            {item.answer}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
</div>
