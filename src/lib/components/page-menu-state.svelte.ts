type IconComponent = typeof import('lucide-svelte').Icon;

export interface PageMenuItem {
  id: string;
  label: string;
  icon?: IconComponent;
  onclick?: () => void | Promise<void>;
}

let items = $state<PageMenuItem[]>([]);

function setItems(next: PageMenuItem[]): void {
  items = next;
}

function clear(): void {
  items = [];
}

export function getPageMenuState() {
  return {
    get items() {
      return items;
    },
    setItems,
    clear,
  };
}

export function usePageMenu(builder: () => PageMenuItem[]): void {
  const menu = getPageMenuState();
  $effect(() => {
    menu.setItems(builder());
    return () => menu.clear();
  });
}
