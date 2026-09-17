// Reactive Svelte 5 Router Store for MOVA Platform
class RouterStore {
  currentPath = $state(typeof window !== 'undefined' ? window.location.pathname : '/');
  queryParams = $state<Record<string, string>>({});

  constructor() {
    if (typeof window !== 'undefined') {
      this.updateFromLocation();
      window.addEventListener('popstate', () => {
        this.updateFromLocation();
      });
    }
  }

  private updateFromLocation() {
    if (typeof window === 'undefined') return;
    this.currentPath = window.location.pathname || '/';
    const params = new URLSearchParams(window.location.search);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    this.queryParams = result;
  }

  navigate(path: string, query?: Record<string, string>) {
    if (typeof window === 'undefined') return;
    let target = path;
    if (query && Object.keys(query).length > 0) {
      const search = new URLSearchParams(query).toString();
      target = `${path}?${search}`;
    }
    if (window.location.pathname + window.location.search !== target) {
      window.history.pushState({}, '', target);
    }
    this.updateFromLocation();
  }

  replace(path: string) {
    if (typeof window === 'undefined') return;
    window.history.replaceState({}, '', path);
    this.updateFromLocation();
  }
}

export const router = new RouterStore();
