import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=await build({stdin:{contents:'export * from "./src/lib/crates"; export * from "./src/lib/crate-events";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const discount={effect:{type:'crate_cost_discount',multiplier:.6}}, boost={effect:{type:'crate_drop_adjustment'}};
const modes={base:[],discount:[discount],lucky:[boost],combined:[discount,boost],duplicate:[discount,discount,boost]};
for(const [key,crate] of Object.entries(m.CRATE_TYPES)) {
  const values=[];
  for(const [mode,events] of Object.entries(modes)) {
    const drops=m.getAdjustedCrateDrops(key,events);
    assert.ok(drops.every(x=>m.SAMPLE_CRATE_ITEMS[x.item_id]&&x.weight>=0));
    const weight=drops.reduce((s,x)=>s+x.weight,0);
    const value=drops.reduce((s,x)=>s+x.weight*m.SAMPLE_CRATE_ITEMS[x.item_id].sell_value,0);
    let ev=value/weight;
    if(key===m.PRINCIPESSA_PITY_CRATE) {
      const resetChance=drops.filter(x=>m.isPityResettingRarity(m.SAMPLE_CRATE_ITEMS[x.item_id].rarity)).reduce((s,x)=>s+x.weight,0)/weight;
      const legends=drops.filter(x=>m.SAMPLE_CRATE_ITEMS[x.item_id].rarity==='legendary');
      const epics=drops.filter(x=>m.SAMPLE_CRATE_ITEMS[x.item_id].rarity==='epic');
      const legendaryChance=legends.reduce((s,x)=>s+x.weight,0)/weight;
      const pityValue=legends.reduce((s,x)=>s+x.weight*m.SAMPLE_CRATE_ITEMS[x.item_id].sell_value,0)/weight+(1-legendaryChance)*epics.reduce((s,x)=>s+x.weight*m.SAMPLE_CRATE_ITEMS[x.item_id].sell_value,0)/epics.reduce((s,x)=>s+x.weight,0);
      // Renewal cycle: a normal epic/legendary or the guaranteed fifth open resets pity.
      const occupancy=Array.from({length:m.PRINCIPESSA_PITY_THRESHOLD+1},(_,i)=>(1-resetChance)**i);
      ev=(ev*occupancy.slice(0,-1).reduce((a,b)=>a+b,0)+pityValue*occupancy.at(-1))/occupancy.reduce((a,b)=>a+b,0);
    }
    const cost=m.getCrateOpenCost(crate.cost,events,true,key),rtp=ev/cost;
    assert.ok(rtp<=.98,`${key}/${mode}: ${rtp*100}% becomes a repeatable Coin source`);
    assert.equal(m.getCrateBatchCost(crate.cost,5,events,true,key),cost*5);
    values.push(`${mode} ${(rtp*100).toFixed(2)}%`);
  }
  console.log(`${key}: ${values.join(', ')}`);
}
assert.equal(m.getCrateCostMultiplier([discount],'future-case'),1,'Unreviewed new cases must not inherit a 40% discount');
