"use client";
import {useState,type ComponentProps} from "react";
import Link from "next/link";

// Only public navigation uses this component. Wait for intent before fetching
// the full destination, rather than prefetching every visible menu at once.
export function IntentLink({prefetch,onMouseEnter,onFocus,onTouchStart,...props}:ComponentProps<typeof Link>) {
 const [active,setActive]=useState(false);
 return <Link {...props} prefetch={prefetch===false?false:active?true:prefetch}
  onMouseEnter={event=>{setActive(true);onMouseEnter?.(event);}}
  onFocus={event=>{setActive(true);onFocus?.(event);}}
  onTouchStart={event=>{setActive(true);onTouchStart?.(event);}}/>;
}
