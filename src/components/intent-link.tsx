"use client";
import {useState,type ComponentProps} from "react";
import Link from "next/link";

// Only public navigation uses this component. Wait for intent before fetching
// the full destination, rather than prefetching every visible menu at once.
export function IntentLink({prefetch,onMouseEnter,onFocus,onTouchStart,...props}:ComponentProps<typeof Link>) {
 const [activeHref,setActiveHref]=useState<typeof props.href>();
 const active=activeHref===props.href;
 const activate=() => setActiveHref(props.href);
 return <Link {...props} prefetch={prefetch===false?false:prefetch===true||active?true:false}
  onMouseEnter={event=>{onMouseEnter?.(event);if(!event.defaultPrevented) activate();}}
  onFocus={event=>{onFocus?.(event);if(!event.defaultPrevented) activate();}}
  onTouchStart={event=>{onTouchStart?.(event);if(!event.defaultPrevented) activate();}}/>;
}
