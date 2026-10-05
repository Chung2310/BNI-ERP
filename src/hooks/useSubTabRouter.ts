import { useCallback, useEffect, useSyncExternalStore } from "react";

export type SubTabRouteMap<T extends string> = Array<{ slug: string; value: T }>;
const SUB_TAB_CHANGE = "sub-tab-change";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(SUB_TAB_CHANGE, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(SUB_TAB_CHANGE, listener);
  };
}
const getSearch = () => window.location.search;

/** Keep the selected sub-tab in the URL, including browser back/forward navigation. */
export function useSubTabRouter<T extends string>(
  routeMap: SubTabRouteMap<T>, defaultValue: T,
): [T, (tab: T) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, () => "");
  const slug = new URLSearchParams(search).get("sub");
  const active = routeMap.find(entry => entry.slug === slug)?.value ?? defaultValue;
  const replaceSubTab = useCallback((tab: T) => {
    const match = routeMap.find(entry => entry.value === tab);
    const url = new URL(window.location.href);
    if (match) url.searchParams.set("sub", match.slug);
    else url.searchParams.delete("sub");
    if (url.search !== window.location.search) {
      window.history.replaceState(null, "", url.toString());
      window.dispatchEvent(new Event(SUB_TAB_CHANGE));
    }
  }, [routeMap]);
  useEffect(() => { replaceSubTab(active); }, [active, replaceSubTab]);
  return [active, replaceSubTab];
}
