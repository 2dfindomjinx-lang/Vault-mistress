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
const imports=ast.statements.filter(ts.isImportDeclaration).map(node=>node.getText(ast)).join("\n");
const bundle=await build({stdin:{contents:imports+"\n"+card.getText(ast)+'\nimport {createRoot} from "react-dom/client";createRoot(document.getElementById("app")).render(<ThroneDebtCard/>);',resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,platform:"browser",jsx:"automatic"});
const css=fs.readdirSync(".next/static/chunks").filter(p=>p.endsWith(".css")).map(p=>fs.readFileSync(path.join(".next/static/chunks",p),"utf8")).join("\n");
const browser=await chromium.launch({channel:process.platform==="win32"?"chrome":undefined,headless:true});
let contracts=[],submitted,money=100;
try {
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("dialog",dialog=>dialog.accept());
  await page.clock.install({time:new Date("2026-09-11T12:00:00Z")});
  await page.route("**/*",async route=>{
    const url=new URL(route.request().url());
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
    return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body class="principessa-court-ui" style="margin:0;background:#09050b"><main id="app"></main></body></html>'});
  });
  await page.goto("https://debt-fixture.invalid/");
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByPlaceholder("Total USD").fill("75");
  await page.getByLabel("Contract length",{exact:true}).selectOption("4");
  await page.getByText("Payment schedule: $19 + $19 + $19 + $18",{exact:true}).waitFor();
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
  assert.deepEqual(errors,[]);
  console.log("Throne Debt browser passed: preview, invalid cents, legacy amendment, mobile/desktop, PM installment and early full settlement, completed agreement retained. HTTP mocked.");
} finally {await browser.close();}

