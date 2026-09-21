const paths: Record<string,string> = {
 grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/>',
 calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 news: '<path d="m3 10 17-6v15L3 14v-4ZM7 15l1 6h4l-2-5"/>',
 general: '<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/>',
 user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 out: '<path d="M10 3H4v18h6M9 12h12m-5-5 5 5-5 5"/>',
 left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
 close: '<path d="m6 6 12 12M6 18 18 6"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
 clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
 plus: '<path d="M12 4v16M4 12h16"/>',
 check: '<path d="m5 12 4 4L19 6"/>',
 shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 alert: '<path d="m12 3 10 18H2L12 3ZM12 9v5m0 3h.01"/>',
 pin: '<path d="m16 3 5 5-4 1-3 5-1 4-7-7 4-1 5-3 1-4ZM9 15l-6 6"/>',
 edit: '<path d="m15 4 5 5-10 10-6 1 1-6L15 4Z"/>',
 trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 book: '<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3V4Zm9 2v15"/>',
 link: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>'
};
export function icon(name: string): string { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.tasks}</svg>`; }

