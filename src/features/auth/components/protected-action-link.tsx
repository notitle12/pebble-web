"use client";
import Link, {type LinkProps} from "next/link";
import {useRouter} from "next/navigation";
import {useRef,type ComponentProps,type MouseEvent} from "react";
import {openLoginDialog} from "./login-dialog";
import {useUserSession} from "./member-gate";
import {loginDestination,memberActionDestination} from "../login-destination";
import {userSession} from "../user-session";

type Props = Omit<ComponentProps<typeof Link>,"href"|"onClick"> & {
  href: string;
  onClick?: LinkProps["onClick"];
};

export function ProtectedActionLink({href,onClick,...props}:Props){
  const router=useRouter();
  const session=useUserSession();
  const opening=useRef(false);
  const destination=loginDestination(href);

  async function handleClick(event:MouseEvent<HTMLAnchorElement>){
    onClick?.(event);
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target==="_blank")return;
    event.preventDefault();
    if(opening.current)return;
    opening.current=true;
    try{
      let current=userSession.snapshot();
      if(session.phase==="loading" || current.phase==="loading"){
        await userSession.ensure();
        current=userSession.snapshot();
      }
      if(current.phase!=="ready" || !current.member){
        openLoginDialog(destination);
        return;
      }
      router.push(memberActionDestination(destination,current.member));
    }finally{
      opening.current=false;
    }
  }

  return <Link {...props} href={href} onClick={handleClick} prefetch={props.prefetch??false}/>;
}
