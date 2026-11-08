export const SIDEBAR_MENU_KEYS = ["BOARDS", "PROJECTS", "SERIES"] as const;
export type SidebarMenuKey = typeof SIDEBAR_MENU_KEYS[number];
export const sidebarMenuLabels:Record<SidebarMenuKey,string>={BOARDS:"게시판",PROJECTS:"프로젝트",SERIES:"시리즈"};
export function isSidebarMenuOrder(value:unknown):value is SidebarMenuKey[]{
 return Array.isArray(value)&&value.length===3&&new Set(value).size===3&&value.every(key=>SIDEBAR_MENU_KEYS.includes(key));
}
export function reorderSidebarMenu(order:SidebarMenuKey[],source:SidebarMenuKey,gap:number):SidebarMenuKey[]{
 const from=order.indexOf(source);if(!isSidebarMenuOrder(order)||from<0||!Number.isInteger(gap)||gap<0||gap>order.length)return order;
 const to=gap>from?gap-1:gap;if(from===to)return order;
 const next=[...order];next.splice(from,1);next.splice(to,0,source);return next;
}
