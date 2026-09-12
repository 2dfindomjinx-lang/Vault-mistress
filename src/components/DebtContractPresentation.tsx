"use client";
import type { ReactNode } from "react";
import type { PetDebtContract } from "@/lib/types";
import styles from "./DebtContracts.module.css";

type ContractKind = "coin" | "evil" | "throne";
const editions = {
  coin: { number: "01", title: "Coin Debt", subtitle: "A promise, paid in devotion.", currency: "COIN AGREEMENT" },
  evil: { number: "02", title: "Evil Debt", subtitle: "Her terms. Your signature.", currency: "PERSONAL AGREEMENT" },
  throne: { number: "03", title: "Throne Debt", subtitle: "Your commitment, written in gold.", currency: "PM & THRONE AGREEMENT" },
};

export function ContractDocument({kind,status,recorded=false,children}:{kind:ContractKind;status:string;recorded?:boolean;children:ReactNode}) {
  const edition=editions[kind];
  return <article id={kind+"-agreement"} className={styles.document+" "+styles[kind]} data-contract={kind} data-contract-state={recorded ? "recorded" : "draft"}>
    <header className={styles.contractHeading}>
      <div className={styles.contractEdition}><span>{edition.number}</span><small>{edition.currency}</small><span aria-hidden="true">♛</span></div>
      <h3>{edition.title}<em>{recorded ? "Agreement" : "Create your agreement"}</em></h3>
      <p>{edition.subtitle}</p>
      <span className={styles.contractStatus}>{status}</span>
    </header>
    <div className={styles.body}>{children}</div>
  </article>;
}

export function ContractClause({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className={styles.clause}><div className={styles.clauseHeading}><span>{number}</span><h4>{title}</h4></div>{children}</section>;
}

export function ContractField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

export function ContractSignature({ name, state }: { name: string; state: string }) {
  return <footer className={styles.signature}><div><span>Principessa</span><small>ISSUED BY THE COURT</small></div><div><span>{name}</span><small>{state}</small></div></footer>;
}

export function CoinContractSummary({ amount, duration, period, contract, remaining }: {
  amount: string; duration: string; period: "weekly" | "monthly"; contract?: PetDebtContract | null; remaining?: number;
}) {
  const installment = contract?.debt_amount ?? Math.floor(Number(amount));
  const periods = contract?.duration_periods ?? Math.floor(Number(duration));
  const hasPlan = Number.isFinite(installment) && installment > 0 && Number.isFinite(periods) && periods > 0;
  const total = hasPlan ? installment * periods : 0;
  const paid = contract?.paid_periods ?? 0;
  const active = contract?.status === "active";
  const periodLabel = period === "weekly" ? "week" : "month";
  return <aside className={styles.schedule} aria-label="Contract payment summary">
    <p className={styles.edition}>{contract ? "RECORDED COMMITMENT" : "YOUR AGREEMENT AT A GLANCE"}</p>
    <h4>{contract ? "The account" : "The commitment"}</h4>
    <div className={styles.total}>{hasPlan ? total.toLocaleString() : "—"}<small>COINS IN TOTAL</small></div>
    <dl className={styles.facts}>
      <div><dt>Per {periodLabel}</dt><dd>{hasPlan ? installment.toLocaleString() + " Coins" : "To be set"}</dd></div>
      <div><dt>Term</dt><dd>{hasPlan ? periods + " " + periodLabel + (periods === 1 ? "" : "s") : "To be set"}</dd></div>
      <div><dt>Payments</dt><dd>{hasPlan ? `${paid} / ${periods} settled` : "To be set"}</dd></div>
      {active ? <div><dt>Remaining</dt><dd>{Number(remaining ?? total).toLocaleString()} Coins</dd></div> : null}
    </dl>
    <div className={styles.installmentStrip} aria-label="Installment progress">{Array.from({length: hasPlan ? Math.min(12,periods) : 6},(_,i)=><span key={i} data-paid={hasPlan && i < Math.floor(paid / periods * Math.min(12,periods))}/>)}</div>
    <p className={styles.scheduleNote}>{contract?.status === "pending" ? "Awaiting Principessa’s approval. Payments open after approval." : active ? "Only the current period is payable. Future installments open on their scheduled dates." : "This is a preview. Your payment dates are set when the contract begins."}</p>
    <div className={styles.scheduleRule}><span>01</span><p>Coin payments only. PM and Throne payments belong to the separate Throne agreement.</p></div>
    <div className={styles.scheduleRule}><span>02</span><p>Coin Debt and Evil Debt share one contract slot. Only one may be active or awaiting approval.</p></div>
    <div className={styles.scheduleRule}><span>03</span><p>A missed payment has a 48-hour grace period. Any debt timeout requires admin review.</p></div>
  </aside>;
}
