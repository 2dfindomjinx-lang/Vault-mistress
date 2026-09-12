import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { build } from "esbuild";
import { chromium } from "playwright";

const source=fs.readFileSync("src/components/DebtSection.tsx","utf8");
const ast=ts.createSourceFile("DebtSection.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const card=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="ThroneDebtCard");
assert.ok(card);

const fixture = source + `
import {createRoot} from "react-dom/client";
function Fixture(){
 const [all,setAll]=useState(false),[contract,setContract]=useState(null),[auto,setAuto]=useState(false),[timeout,setTimeoutState]=useState(false),[manage,setManage]=useState(false);
 window.fixtureSetAll=setAll;window.fixtureSetContract=setContract;window.fixtureSetTimeout=setTimeoutState;window.fixtureSetManage=setManage;
 if(!all)return <ThroneDebtCard/>;
 return <DebtSection petDebtContract={contract} tasks={[{id:"pet-debt-contract",kind:"debt-contract",description:"Coin contract"}]} isDebtAutoPayEnabled={auto} onDebtAutoPayChange={setAuto} onPayDebtPeriod={()=>window.fixturePaid=true} onSignDebtContract={form=>{window.fixtureSigned=form;return true}} isTimeoutActive={timeout} canManageActiveDebtWhileTimedOut={manage}/>;
}
createRoot(document.getElementById("app")).render(<Fixture/>);
`;
const bundle=await build({stdin:{contents:fixture,resolveDir:path.resolve("src/components"),loader:"tsx"},outfile:"tmp/contract-fixture.js",bundle:true,write:false,platform:"browser",jsx:"automatic",loader:{".css":"local-css"},plugins:[{name:"fixture-image",setup(builder){builder.onResolve({filter:/^next\/image$/},()=>({path:"image",namespace:"fixture"}));builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'import {createElement} from "react";export default function Image({unoptimized,priority,...props}){return createElement("img",props)}',resolveDir:process.cwd(),loader:"js"}));}}]});
const css=bundle.outputFiles.find(file=>file.path.endsWith(".css")).text;
const javascript=bundle.outputFiles.find(file=>file.path.endsWith(".js")).text;
const browser=await chromium.launch({channel:process.platform==="win32"?"chrome":undefined,headless:true});
let contracts=[],submitted,money=100;
try {
  const page=await browser.newPage({locale:"en-US",viewport:{width:390,height:900}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("dialog",dialog=>dialog.accept());
  await page.clock.install({time:new Date("2026-09-11T12:00:00Z")});
  await page.route("**/*",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/user/debt-contracts") return route.fulfill({json:{capacity:{balanceCoins:100000,balanceComponent:75000,reliablePeriodIncome:20000,evaluatedPeriods:4,totalLimit:500000,purchasePledgeBoost:0,baseTotalLimit:500000}}});
    if(url.pathname.startsWith("/brand/") || url.pathname.startsWith("/principessa-ui/")) return route.fulfill({path:path.join(process.cwd(),"public",url.pathname)});
    if(url.pathname==="/api/user/throne-debts") {
      if(route.request().method()==="POST") {
        submitted=route.request().postDataJSON();
        if(submitted.action === "pay_pm") {
          money-=submitted.expectedAmount;
          for(const item of contracts[0].installments) if(item.installment_number<=submitted.throughInstallment && item.status!=="approved_paid") {item.pm_paid_usd=item.amount_usd-(item.webhook_paid_usd??0);item.status="approved_paid";}
          if(contracts[0].installments.every(item=>item.status==="approved_paid")) contracts[0].status="completed";
          return route.fulfill({json:{money,spent:submitted.expectedAmount}});
        }
        contracts=[{id:"debt",debt_code:"TD-1234ABCD",total_amount_usd:75,installment_count:4,repayment_frequency:"weekly",status:"pending_review",installments:[]}];
        return route.fulfill({json:{contract:contracts[0]}});
      }
      return route.fulfill({json:{contracts,money}});
    }
    if(url.pathname==="/styles.css")return route.fulfill({contentType:"text/css",body:css});
    return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body class="principessa-court-ui" style="margin:0;background:#09050b;font-family:Arial,sans-serif"><main id="app"></main></body></html>'});
  });
  await page.goto("https://debt-fixture.invalid/");
  await page.addScriptTag({content:javascript});
  await page.getByPlaceholder("Total USD").fill("75");
  await page.getByLabel("Contract length",{exact:true}).selectOption("4");
  await page.getByRole("complementary",{name:"Throne draft payment summary"}).getByText("$18.00",{exact:true}).waitFor();
  await page.getByPlaceholder("Total USD").fill("75.75");
  assert.ok(await page.getByRole("button",{name:"Submit Throne Debt Request",exact:true}).isDisabled());
  await page.getByPlaceholder("Total USD").fill("75");
  await page.getByRole("button",{name:"Submit Throne Debt Request",exact:true}).click();
  await page.getByText(/Pending manual admin approval/).waitFor();
  assert.equal(submitted.totalAmountUsd,75);
  contracts[0]={...contracts[0],status:"active",contract_length_weeks:4,approved_at:"2026-09-11T12:00:00Z",schedule_adjusted_at:"2026-09-11T12:00:00Z",rounding_waived_usd:0.25,installments:[18.75,19,19,18].map((amount,i)=>({id:"i"+i,installment_number:i+1,amount_usd:amount,original_amount_usd:i?18.75:null,status:i===0?"approved_paid":"pending",webhook_paid_usd:0,pm_paid_usd:0,due_date:"2026-09-18T12:00:00Z"}))};
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.getByRole("button",{name:"Pay 19 PM",exact:true}).waitFor();
  await page.getByText("$56.00",{exact:true}).waitFor();
  assert.equal(await page.getByText("Approved Paid",{exact:true}).count(),1);
  assert.equal(await page.getByText("Pending",{exact:true}).count(),3);
  for(const width of [390,1440]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:"tmp/throne-debt-"+width+".png",fullPage:true});
  }
  await page.getByRole("button",{name:"Pay 19 PM",exact:true}).click();
  await page.getByText("$37.00",{exact:true}).waitFor();
  assert.equal(submitted.action,"pay_pm");assert.equal(submitted.expectedAmount,19);
  assert.equal(submitted.throughInstallment,2);assert.ok(submitted.requestId);
  assert.equal(await page.getByText("Approved Paid",{exact:true}).count(),2);
  await page.getByLabel("Pay installments through",{exact:true}).selectOption("4");
  await page.getByRole("button",{name:"Pay 37 PM",exact:true}).click();
  await page.getByText("Your agreement is fulfilled. No balance remains.",{exact:true}).waitFor();
  assert.equal(await page.getByText("Approved Paid",{exact:true}).count(),4);
  assert.equal(money,44);
  await page.getByText("Request another agreement",{exact:true}).waitFor();
  await page.evaluate(()=>window.fixtureSetAll(true));
  const coin=page.locator('[data-contract="coin"]'), evil=page.locator('[data-contract="evil"]');
  await coin.getByLabel("Coin installment amount",{exact:true}).fill("10000");
  await coin.getByLabel("Coin contract duration",{exact:true}).fill("4");
  await coin.getByRole("complementary").getByText("40,000",{exact:false}).waitFor();
  await coin.getByLabel("Coin contract duration",{exact:true}).fill("1.9");
  await coin.getByRole("complementary").getByText("1 week",{exact:true}).waitFor();
  await coin.getByLabel("Coin contract duration",{exact:true}).fill("4");
  assert.equal(await coin.getByRole("checkbox").isChecked(),false);
  await coin.getByRole("button",{name:/Auto payment/}).click();
  assert.equal(await coin.getByRole("button",{name:/Auto payment/}).getAttribute("aria-pressed"),"true");
  await coin.getByRole("button",{name:"Sign Debt Contract",exact:true}).click();
  assert.equal((await page.evaluate(()=>window.fixtureSigned)).debtAmount,10000);
  await coin.getByText("Contract signed.",{exact:true}).waitFor();
  await page.clock.runFor(5000);
  await evil.getByLabel("Full name",{exact:true}).fill("Example Court Member");
  await evil.getByLabel("Age",{exact:true}).fill("25");
  await evil.getByLabel("Evil installment amount",{exact:true}).fill("40000");
  await evil.getByLabel("Evil contract duration",{exact:true}).fill("3");
  await evil.getByLabel("First consent statement").fill("I confirm that these images belong to me and I am sharing them with my own consent.");
  await evil.getByLabel("Second consent statement").fill("I consent that Principessa may use these images and I accept the consequences.");
  await evil.getByLabel("Contract attachments",{exact:true}).setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64")});
  await evil.getByRole("img",{name:"Contract attachment 1",exact:true}).waitFor();
  await evil.getByRole("button",{name:"Sign Evil Debt Contract",exact:true}).click();
  const evilForm=await page.evaluate(()=>window.fixtureSigned);
  assert.equal(evilForm.contractType,"evil");assert.equal(evilForm.fullName,"Example Court Member");assert.equal(evilForm.imageUrls.length,1);
  await page.clock.runFor(5000);
  const stored={id:"d0000000-0000-0000-0000-000000000001",pet_name:"Debt Piglet",contract_type:"evil",full_name:"Example Court Member",timezone:"UTC+3",debt_amount:40000,current_installment_remaining:25000,duration_periods:3,paid_periods:1,missed_periods:0,period_type:"weekly",status:"pending",started_at:"2026-09-01T12:00:00Z",created_at:"2026-09-01T12:00:00Z",next_due_at:"2026-09-08T12:00:00Z",ends_at:"2026-09-22T12:00:00Z"};
  await page.evaluate(value=>window.fixtureSetContract(value),stored);
  await evil.getByText(/Your agreement is awaiting Principessa/).waitFor();
  assert.equal(await evil.getByRole("button",{name:"Pay current installment",exact:true}).count(),0);
  await coin.getByText("One promise at a time.",{exact:true}).waitFor();
  await page.evaluate(value=>window.fixtureSetContract({...value,status:"active"}),stored);
  await evil.getByRole("button",{name:"Pay current installment",exact:true}).waitFor();
  await evil.getByText("25,000 Coins",{exact:true}).waitFor();
  await evil.getByRole("button",{name:"Pay current installment",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixturePaid),true);
  await page.evaluate(()=>window.fixtureSetTimeout(true));
  assert.equal(await evil.getByRole("button",{name:"Pay current installment",exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.fixtureSetManage(true));
  assert.equal(await evil.getByRole("button",{name:"Pay current installment",exact:true}).isDisabled(),false);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await evil.screenshot({path:"tmp/contract-evil-active-"+width+".png"});
    await coin.screenshot({path:"tmp/contract-coin-locked-"+width+".png"});
  }
  await page.evaluate(value=>window.fixtureSetContract({...value,contract_type:"normal",full_name:null,status:"active"}),stored);
  await evil.getByText("One promise at a time.",{exact:true}).waitFor();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await coin.screenshot({path:"tmp/contract-coin-active-"+width+".png"});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log("Contract behavior passed: Throne preview/amendment/PM settlement/archive; Coin live totals, sign and auto-pay; Evil declarations/upload/sign, pending/active/locked states, partial balance and timeout exception. HTTP mocked; CSS delivery covered separately by debt-contracts-browser-check.mjs.");
} finally {await browser.close();}

