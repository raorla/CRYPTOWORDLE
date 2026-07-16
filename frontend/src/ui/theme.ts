const STORAGE_KEY = "cw-theme";

export function initTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  const theme = saved ?? "dark";
  document.body.dataset.theme = theme;
}

export function toggleTheme(): string {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function currentTheme(): string {
  return document.body.dataset.theme ?? "dark";
}
