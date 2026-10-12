"use client";
import type {DashboardPage} from "./SidebarNav";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
type CourtHomeStageProps={affection:number;coins:number;dailyMessage:string;displayName:string;money?:number;onNavigate:(page:DashboardPage)=>void};
const lines=["I was hoping you’d show up. ♡","Go on. Make it interesting.","A little attention looks good on you."];
export function CourtHomeStage({displayName,onNavigate}:CourtHomeStageProps) {
 const [line,setLine]=useState(0);
 const stage=useRef<HTMLElement>(null);
 useEffect(()=>{
   const node=stage.current;
   if(!node)return;
   let visible=false;
   const sync=()=>{node.dataset.motion=visible&&!document.hidden?'running':'paused';};
   const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
   observer.observe(node);
   document.addEventListener('visibilitychange',sync);
   return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
 },[]);
 return <section ref={stage} className="bb-welcome bb-window" aria-label="Principessa’s desktop">
   <div className="bb-titlebar"><span><i className="bb-online"/> principessa.exe</span><span aria-hidden="true">♡ &nbsp; ✧</span></div>
   <div className="bb-welcome-body">
     <div className="bb-welcome-copy"><span className="bb-label">WELCOME BACK, {displayName}</span><h1>A little trouble.<br/><em>A lot of fun.</em></h1><p>Your games. Your collection. Her rules.</p><div className="bb-actions"><button className="bb-primary" onClick={()=>onNavigate('tasks')}>Let’s play <span>↗</span></button><button className="bb-secondary" onClick={()=>onNavigate('tribute')}>Visit her shrine ♡</button></div></div>
     <div className="bb-welcome-art"><div className="bb-orbit" aria-hidden="true"/><span className="bb-star" aria-hidden="true">✧</span><div className="bb-character-layer"><picture><source srcSet="/bubblegum/principessa-play-480.webp 480w, /bubblegum/principessa-play-720.webp 720w, /bubblegum/principessa-play-v2.webp 900w" sizes="(min-width:1700px) 287px, 267px"/><Image src="/bubblegum/principessa-play-v2.webp" alt="Principessa holding a pink controller" fill loading="eager" fetchPriority="high" sizes="(min-width:1700px) 287px, 267px" onLoad={()=>{if(stage.current)stage.current.dataset.imageReady='true';}} unoptimized/></picture></div></div>
     <button className="bb-message" onClick={()=>setLine(i=>(i+1)%lines.length)} aria-label="Hear another thought from Principessa"><span>♥ message from Principessa</span><q>{lines[line]}</q><small>Tap for another thought ↻</small></button>
     <span className="bb-sticker" aria-hidden="true">100%<br/><b>HER RULES</b></span>
   </div>
   <footer className="bb-welcome-footer"><span><i className="bb-online"/> Principessa is on your mind.</span><span>PLAY · COLLECT · DEVOTE</span></footer>
 </section>;
}
