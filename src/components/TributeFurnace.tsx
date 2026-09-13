"use client";
import { emitSoundEvent } from "@/lib/sound";
import { useSoundLoop } from "@/lib/use-animation-sound";
import Image from "next/image";
import {useCallback,useEffect,useRef,useState,type CSSProperties} from "react";
import {postSealToX} from "@/lib/share-seal";
import {FURNACE_CONFIRM_THRESHOLD,FURNACE_MAX_BURN,FURNACE_MIN_BURN,getFurnaceProgressToNext,getFurnaceRank,getNextFurnaceRank,type FurnaceLeaderboardEntry} from "@/lib/tribute-furnace";
import {furnaceDuration,furnaceFrame} from "./furnace-animation";
import {CourtCompanion} from "./CourtCompanion";
import styles from "./TributeFurnace.module.css";

type Phase="idle"|"awaiting"|"burning"|"ash"|"cooling";
type Burn={amount:number;before:number;reduced:boolean};


export function TributeFurnace({burnedTotal,disabled=false,error,isBurning,money,onBurn}:{burnedTotal:number;disabled?:boolean;error?:string;isBurning:boolean;money:number;onBurn:(amount:number)=>Promise<boolean>}) {
  const [amount,setAmount]=useState("");
  const [phase,setPhase]=useState<Phase>("idle");
  useSoundLoop("furnace_burn", phase === "burning");
  const [burn,setBurn]=useState<Burn|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [confirm,setConfirm]=useState(false);
  const [leaders,setLeaders]=useState<FurnaceLeaderboardEntry[]>([]);
  const [localError,setLocalError]=useState("");
  const [shareError,setShareError]=useState("");
  const inFlight=useRef(false),mounted=useRef(true);
  const frame=useRef<number|null>(null);
  const timers=useRef<number[]>([]);
  const parsed=Math.floor(Number(amount));
  const valid=Number.isFinite(parsed)&&parsed>=FURNACE_MIN_BURN&&parsed<=Math.min(FURNACE_MAX_BURN,money);
  const occupied=isBurning||phase!=="idle";
  const currentFrame=burn?furnaceFrame(burn.amount,elapsed):{consumed:0,notes:[]};
  const consumed=currentFrame.consumed;
  const progress=burn?consumed/burn.amount:0;
  const fuel=burn?burn.amount-consumed:valid?parsed:0;
  // The confirmed offering moves from fuel to ash on a single timeline.
  // Their sum is always the paid amount; authoritative totals resume at rest.
  const displayedTotal=burn?burn.before+consumed:burnedTotal;
  const rank=getFurnaceRank(displayedTotal),nextRank=getNextFurnaceRank(displayedTotal);
  const rankProgress=getFurnaceProgressToNext(displayedTotal);
  const max=Math.min(FURNACE_MAX_BURN,Math.max(0,money));
  const loadLeaders=useCallback(async()=>{
    try{const response=await fetch("/api/furnace/leaderboard",{cache:"no-store"});const data=await response.json();if(mounted.current)setLeaders(data.leaders??[]);}catch{/* Leaderboard failure does not affect a burn. */}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    const capturedTimers=timers.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the external leaderboard on mount; updates occur after the response.
    void loadLeaders();
    return()=>{mounted.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);capturedTimers.forEach(clearTimeout);};
  },[loadLeaders]);
  const animate=(session:Burn)=>{
    const duration=furnaceDuration(session.amount);
    timers.current.forEach(clearTimeout);timers.current.length=0;
    setPhase("burning");
    emitSoundEvent("furnace_ignite");
    let lastConsumed=0;
    let elapsedMs=0,lastTime=performance.now();
    const tick=(now:number)=>{
      if(!mounted.current)return;
      // Keep every banknote on screen, including after a background tab resumes.
      const delta=document.hidden?0:Math.min(64,now-lastTime);
      lastTime=now;
      elapsedMs=Math.min(duration,elapsedMs+delta*(session.reduced?duration/240:1));
      setElapsed(elapsedMs);
      const consumedNow=furnaceFrame(session.amount,elapsedMs).consumed;
      if(consumedNow>lastConsumed){lastConsumed=consumedNow;emitSoundEvent("furnace_note");}
      if(elapsedMs<duration){frame.current=requestAnimationFrame(tick);return;}
      frame.current=null;setPhase("ash");emitSoundEvent("furnace_ash");
      void loadLeaders();
      timers.current.push(window.setTimeout(()=>setPhase("cooling"),session.reduced?100:700));
      timers.current.push(window.setTimeout(()=>{
        if(!mounted.current)return;
        setPhase("idle");setBurn(null);setElapsed(0);inFlight.current=false;
      },session.reduced?240:1400));
    };
    frame.current=requestAnimationFrame(tick);
  };
  const submit=async()=>{
    if(!valid||disabled||isBurning||inFlight.current||phase!=="idle")return;
    if(parsed>=FURNACE_CONFIRM_THRESHOLD&&!confirm){setConfirm(true);return;}
    inFlight.current=true;setConfirm(false);setLocalError("");
    const session:Burn={amount:parsed,before:burnedTotal,reduced:window.matchMedia("(prefers-reduced-motion: reduce)").matches};
    setBurn(session);setElapsed(0);setPhase("awaiting");
    try{
      const ok=await onBurn(session.amount);
      if(!mounted.current)return;
      if(!ok){setBurn(null);setPhase("idle");inFlight.current=false;return;}
      setAmount("");animate(session);
    }catch(cause){
      if(!mounted.current)return;
      setLocalError(cause instanceof Error?cause.message:"The furnace could not accept this offering.");
      setBurn(null);setPhase("idle");inFlight.current=false;
    }
  };
  return <section className={styles.furnace} data-furnace-phase={phase}>
    <a href="/sounds/selected/credits.txt" target="_blank" rel="noreferrer" className="text-xs text-zinc-500">Sound credits</a>
    <header className={styles.header}><div><p>Nothing comes back</p><h3>The Tribute Furnace</h3><span>Money becomes ash. Your devotion remains.</span></div><CourtCompanion>Feed it. I’m watching.</CourtCompanion></header>
    <div className={styles.workbench}>
      <div className={styles.machineArea}>
        <div className={styles.machine} style={{"--burn-progress":progress} as CSSProperties}>
          <Image src="/principessa-ui/atelier/furnace-voxel-v3.webp" alt="Principessa’s blackstone furnace" width={360} height={360} sizes="(max-width:700px) 280px,330px" className={styles.stone} unoptimized/>
          <div className={styles.firebox} aria-hidden="true"><div className={styles.fireGlow}/><svg className={styles.fire} viewBox="0 0 160 95"><path d="M0 95V75H12V56H23V68H34V31H45V12H53V43H63V59H72V39H82V18H92V3H100V37H111V58H122V42H131V63H144V78H160V95Z" fill="#ec591c"/><path d="M5 95V82H24V70H40V81H52V52H65V73H80V45H91V60H103V78H117V65H130V85H150V95Z" fill="#ffb73f"/><path d="M34 95V85H59V77H73V65H85V79H102V87H133V95Z" fill="#ffedab"/></svg></div>
          <div className={styles.feed} aria-hidden="true">{phase==="burning"&&!burn?.reduced&&currentFrame.notes.map(note=>{
            const p=note.progress,burnEdge=Math.max(0,(p-.4)/.6)*100;
            const opacity=Math.min(1,p/.12,(1-p)/.12);
            const bottom=(offset:number)=>Math.max(0,100-burnEdge+Math.sin(p*9+offset)*Math.min(9,burnEdge/5));
            return <div className={styles.note} data-furnace-note={note.index} data-note-value="1" key={note.index} style={{opacity,transform:"translate("+(-25*(1-p)+Math.sin(p*Math.PI)*10)+"px,"+(-15+p*123)+"px) rotate("+(-20+Math.sin(p*Math.PI)*28+p*12)+"deg) scale("+(.93-Math.max(0,p-.55)*.7)+")",filter:"sepia("+Math.max(0,p-.4)+") brightness("+(1-Math.max(0,p-.4)*1.4)+")",clipPath:"polygon(0 0,100% 0,100% "+bottom(0)+"%,88% "+bottom(1)+"%,76% "+bottom(2)+"%,64% "+bottom(3)+"%,50% "+bottom(4)+"%,36% "+bottom(5)+"%,24% "+bottom(6)+"%,12% "+bottom(7)+"%,0 "+bottom(8)+"%)"}}><Image src="/principessa-money.png" alt="" width={160} height={94} unoptimized/><i style={{bottom:burnEdge+"%"}}/></div>;
          })}</div>
          <div className={styles.sparks} aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{"--spark-x":(i%4)*22+"%","--spark-delay":-i*.19+"s","--spark-shift":((i%3)-1)*17+"px"} as CSSProperties}/>)}</div>
          <div className={styles.ashPile} aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{height:4+(i%3)*3,left:35+i*5+"%"}}/>)}</div>
        </div>
        <div className={styles.fuelMeter}><span>{phase==="awaiting"?"Preparing the offering":phase==="burning"?"In the fire":phase==="ash"||phase==="cooling"?"Reduced to ash":"Ready to burn"}</span><strong data-furnace-fuel={fuel}>{fuel.toLocaleString()} <small>PM</small></strong></div>
      </div>
      <div className={styles.ledger}>
        <div className={styles.ashLedger}><div><p>Your ash</p><strong data-furnace-ash={displayedTotal}>{displayedTotal.toLocaleString()}<small>PM burned</small></strong></div><span className={styles.rank}>{rank.name}<small>{rank.blurb}</small></span></div>
        <div className={styles.burnTrack} role="progressbar" aria-label="Offering burned" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{width:progress*100+"%"}}/></div>
        <p className={styles.receipt} role="status">{phase==="awaiting"?"Confirming your offering…":phase==="burning"?"Another note. Another little surrender.":phase==="ash"||phase==="cooling"?"Gone. She smiles.":"No Coins, items or refunds."}</p>
        <form className={styles.burnForm} onSubmit={event=>{event.preventDefault();void submit();}}>
          <label htmlFor="furnace-amount">The offering <span>1 PM = $1</span></label>
          <div><input id="furnace-amount" aria-label="Money to burn" inputMode="numeric" placeholder={"1–"+max+" PM"} disabled={(disabled)||occupied} value={amount} onChange={event=>{setAmount(event.target.value.replace(/[^0-9]/g,""));setConfirm(false);}}/><button type="submit" disabled={!valid||disabled||occupied}>{phase==="awaiting"?"Confirming…":occupied?"Burning…":confirm?"Yes. Burn $"+parsed:"Burn"}</button></div>
        </form>
        {confirm&&<p className={styles.confirm}>{parsed+" PM will be destroyed. Nothing is returned."}</p>}
        {(error||localError)&&<p className={styles.error} role="alert">{error||localError}</p>}
        {nextRank&&<div className={styles.rankProgress}><span style={{width:rankProgress*100+"%"}}/><p>{(nextRank.min-displayedTotal).toLocaleString()} PM to {nextRank.name}</p></div>}

        {burnedTotal>0&&<button className={styles.share} type="button" disabled={occupied||disabled} onClick={()=>{setShareError("");void postSealToX("furnace").then(message=>{if(message)setShareError(message);});}}>Post my ash on X ↗</button>}
        {shareError&&<p className={styles.error}>{shareError}</p>}
      </div>
    </div>
    {leaders.length>0&&<div className={styles.leaders}><p>Burned the most</p><ol>{leaders.slice(0,5).map(entry=><li key={entry.rank+"-"+entry.username}><span>{entry.rank}</span><strong>{entry.displayName||entry.username||"Anonymous"}</strong><span>{entry.burned.toLocaleString()} PM</span></li>)}</ol></div>}
  </section>;
}
