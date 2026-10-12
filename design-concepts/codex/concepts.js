/* Standalone design studies. All balances, activity and interactions are local demo data. */
'use strict';
const design = document.body.dataset.design;
const asset = name => `../../public/${name}`;
const paths = {
  crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z"/><path d="M6 22h12"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  games: '<rect x="2" y="6" width="20" height="13" rx="5"/><path d="M6 12h6M9 9v6m7-4h.01M19 14h.01"/>',
  diamond: '<path d="m3 8 4-5h10l4 5-9 13Z M3 8h18M7 3l5 18 5-18"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8C3 9 5 0 9 3l3 5c9 1 7-8 3-5Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 10h8m-8 4h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sword: '<path d="m5 3 13 13m-4 1 4-4m-1 5 4 3M19 3 6 16m4 1-4-4m1 5-4 3"/>',
  bag: '<path d="M4 8h16l-1 13H5ZM8 8V6a4 4 0 0 1 8 0v2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8L21 9h-8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
const img = (file, alt, cls = '', lazy = true) => `<img class="${cls}" src="${asset(file)}" alt="${alt}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`;
const games = [
  {name:'Court Roulette', file:'roulette', category:'Table', label:'Pick your colour', hue:'pink'},
  {name:'Crown Slots', file:'slots', category:'Chance', label:'A little temptation', hue:'gold'},
  {name:'Her Dice', file:'dice', category:'Table', label:'Let them fall', hue:'blue'},
  {name:'The Jewelry Box', file:'mines', category:'Chance', label:'Know when to stop', hue:'mint'},
  {name:'Plinko', file:'plinko', category:'Chance', label:'One drop. Many paths.', hue:'purple'},
];
const sections = [
  ['Home','home','top'], ['Runway','eye','collection'], ['Shrine of Principessa','heart','rituals'],
  ['Games','games','games'], ['Gamble & Wheels','diamond','games'], ['Principessa Pet','spark','rituals'],
  ['Money Shop','coin','collection'], ['Shop','bag','collection'], ['Cases','gift','cases'],
  ['Debt Contracts','book','contracts'], ['Gallery','eye','collection'], ['Invite','heart','invite'],
];
const avatar = (cls = '') => `<span class="avatar ${cls}">${img('character-icon.webp','Principessa','',false)}<span class="avatar-gem">✦</span></span>`;
const brand = `<a class="brand" href="#top" aria-label="Vault Mistress home"><span class="brand-mark">${icon('crown')}</span><span>VAULT<span class="brand-sub">MISTRESS</span></span></a>`;
const wallet = `<button class="wallet" data-action="wallet" aria-label="Open demo wallet"><span>${icon('coin')} <b>12,480</b><small>Coins</small></span><i></i><span><b>25</b><small>PM</small></span><span class="wallet-plus">+</span></button>`;
const profile = `<button class="profile-button" data-action="profile" aria-label="Preview your profile">${img('crate-items/astolfo_cosplay.png','Your avatar')}<span class="profile-level">24</span></button>`;
const menu = `<button class="icon-button menu-button" data-action="menu" aria-label="Open all destinations">${icon('menu')}</button>`;
const nav = `<nav class="top-nav" aria-label="Main navigation"><a class="selected" href="#top">Lobby</a><a href="#games">Play</a><a href="#cases">Cases</a><a href="#collection">Collect</a><button data-action="menu">More <span>⌄</span></button></nav>`;
const topbar = () => `<header class="topbar">${brand}${nav}<div class="header-tools">${wallet}${profile}${menu}</div></header>`;
const ticker = () => `<div class="activity-strip"><span class="live-dot"></span><b>AT THE COURT</b><span><strong>velvetfox</strong> found <em>Black Lace</em></span><span class="activity-separator">✦</span><span><strong>midnight</strong> opened a <em>Principessa Case</em></span><span class="activity-separator">✦</span><span><strong>rosebound</strong> sent <em>15 PM</em></span><button data-action="activity">View activity ${icon('arrow')}</button></div>`;
const eyebrow = text => `<p class="eyebrow">${text}</p>`;
const heading = (kicker,title,link='',target='games') => `<div class="section-heading"><div>${kicker ? eyebrow(kicker) : ''}<h2>${title}</h2></div>${link ? `<a href="#${target}" class="text-link">${link} ${icon('arrow')}</a>` : ''}</div>`;
const button = (text, action, primary = true, glyph='arrow') => `<button class="${primary?'button-primary':'button-secondary'}" data-action="${action}">${text}${icon(glyph)}</button>`;
const filters = () => `<div class="filter-bar" role="group" aria-label="Filter games">${['All games','Table','Chance'].map((x,i)=>`<button data-filter="${i ? x : 'all'}" aria-pressed="${!i}" class="${i?'':'active'}">${x}</button>`).join('')}</div>`;
const gameCards = (limit = 5) => `<div class="game-grid">${games.slice(0,limit).map((g,i)=>`<button class="game-card ${g.hue}" data-action="game" data-game="${g.name}" data-category="${g.category}"><div class="game-art">${img(`gamble/v5/${g.file}.webp`,g.name)}<span class="game-number">0${i+1}</span><span class="game-play">${icon('arrow')}</span></div><div class="game-copy"><span><strong>${g.name}</strong><small>${g.label}</small></span>${icon('arrow')}</div></button>`).join('')}</div>`;
const duelRows = () => `<div class="duel-list"><div class="duel-row"><span class="challenger coral">V</span><div class="duel-person"><strong>velvetfox</strong><small>2 × Premium Case</small></div><div class="duel-stake"><b>2,000</b><small>Coins</small></div><button class="join-button" data-action="duel" aria-label="Preview velvetfox's duel">Join ${icon('arrow')}</button></div><div class="duel-row"><span class="challenger lilac">M</span><div class="duel-person"><strong>midnight</strong><small>1 × Principessa Case</small></div><div class="duel-stake"><b>500</b><small>Coins</small></div><button class="join-button" data-action="duel" aria-label="Preview midnight's duel">Join ${icon('arrow')}</button></div></div>`;
const duelPanel = () => `<section class="duel-panel" id="duels"><div class="duel-title"><span class="mini-emblem">${icon('sword')}</span><div>${eyebrow('A LITTLE COMPETITION')}<h2>Crate Duels</h2></div><span class="count-badge">2 open</span></div>${duelRows()}<button class="duel-create" data-action="create-duel">Create a challenge <span>+</span></button></section>`;
const ritualRow = () => `<section class="ritual-row" id="rituals"><button class="ritual reward" data-action="reward"><span class="ritual-icon">${icon('gift')}</span><span><small>DAY 6 · LOGIN REWARD</small><strong>Yours to collect</strong></span><span class="ritual-arrow">${icon('arrow')}</span></button><a class="ritual" href="#games"><span class="ritual-icon">${icon('games')}</span><span><small>DAILY RITUALS</small><strong>Make an impression</strong></span><span class="ritual-arrow">${icon('arrow')}</span></a><button class="ritual" data-action="shrine"><span class="ritual-icon">${icon('heart')}</span><span><small>SHRINE OF PRINCIPESSA</small><strong>A little devotion</strong></span><span class="ritual-arrow">${icon('arrow')}</span></button></section>`;
const caseCards = () => `<div class="case-grid">${[['Premium','premium-case','1,000'],['Principessa','principessa-case','500'],['Couture','couture-case','2,500']].map(([name,file,cost])=>`<button class="case-card" data-action="case" data-case="${name}">${img(`crate-icons/${file}.webp`,`${name} Case`)}<span><strong>${name}</strong><small>${icon('coin')}${cost}</small></span><span class="case-arrow">${icon('arrow')}</span></button>`).join('')}</div>`;
const recent = () => `<div class="recent-line"><span class="recent-label"><span class="live-dot"></span>Recent openings</span><div class="recent-items">${[['black_lace_bra.webp','Black Lace','Rare'],['ballet_heels.webp','Ballet Heels','Epic'],['bat_hairpins.webp','Bat Hairpins','Uncommon'],['black_garter_stockings.webp','Garter Stockings','Rare']].map(([file,name,rarity])=>`<button class="recent-item" data-action="item" data-item="${name}" aria-label="Preview ${name}">${img(`crate-items/${file}`,name)}<span><b>${name}</b><small>${rarity}</small></span></button>`).join('')}</div></div>`;
const goal = () => `<section class="goal-panel"><div class="goal-top"><span class="mini-emblem">${icon('heart')}</span><div>${eyebrow('TOGETHER, FOR HER')}<h3>Community goal</h3></div><b>$3,706</b></div><div class="goal-progress" role="progressbar" aria-label="Progress from the previous community milestone to the next" aria-valuemin="3500" aria-valuemax="4000" aria-valuenow="3706"><span></span></div><div class="goal-foot"><span>$294 to the next milestone</span><b>$4,000</b></div></section>`;
const leaderboard = () => `<section class="leaderboard-panel">${heading('THE PEOPLE OF HER COURT','In good company')}<div class="leaderboard-rows">${[['01','R','rosebound','8,240','rose'],['02','V','velvetfox','6,720','coral'],['03','M','midnight','5,180','lilac']].map(([rank,letter,name,value,color])=>`<div><span class="rank">${rank}</span><span class="challenger ${color}">${letter}</span><strong>${name}</strong><span>${value}<small>Devotion</small></span></div>`).join('')}</div></section>`;
const collection = () => `<section class="collection-panel" id="collection">${heading('MAKE IT YOURS','A different kind of rare','Browse','collection')}<div class="collection-items"><button data-action="item" data-item="Ballet Heels">${img('crate-items/ballet_heels.webp','Ballet Heels')}<span><small>EPIC · FOOTWEAR</small><strong>Ballet Heels</strong></span>${icon('arrow')}</button><button data-action="item" data-item="Bat Hairpins">${img('crate-items/bat_hairpins.webp','Bat Hairpins')}<span><small>UNCOMMON · ACCESSORY</small><strong>Bat Hairpins</strong></span>${icon('arrow')}</button></div></section>`;
const contract = () => `<button class="contract-link" id="contracts" data-action="contract"><span class="mini-emblem">${icon('book')}</span><span><small>DEBT CONTRACTS</small><strong>A promise, made official.</strong></span>${icon('arrow')}</button>`;
const footer = () => `<footer class="site-footer"><span>VAULT MISTRESS <i>✦</i> The private court of Principessa</span><span>Design preview · Sample data</span></footer>`;
const floating = () => `<button class="floating-chat" data-action="chat" aria-label="Open court chat">${icon('chat')}<span>Court chat</span><i></i></button><nav class="mobile-nav" aria-label="Mobile navigation"><a class="active" href="#top">${icon('home')}<span>Home</span></a><a href="#games">${icon('games')}<span>Play</span></a><a href="#cases">${icon('gift')}<span>Cases</span></a><a href="#collection">${icon('bag')}<span>Collect</span></a><button data-action="menu">${icon('menu')}<span>More</span></button></nav>`;

function emerald() {
  return `<div class="site emerald-site" id="top">${topbar()}${ticker()}<main class="emerald-main"><div class="welcome-line"><div>${eyebrow('YOUR EVENING AT THE COURT')}<h1>Welcome back, <em>darling.</em></h1></div><div class="principessa-aside">${avatar()}<span>“Let’s make it interesting.”<small>Principessa</small></span></div></div><div class="emerald-stage"><section class="featured-game">${img('gamble/v5/roulette.webp','Principessa at the roulette table','feature-image',false)}<div class="feature-shade"></div><div class="featured-copy"><span class="feature-label">THE FLOOR IS YOURS</span><h2>Her court.<br><em>Your next move.</em></h2><p>A little nerve looks good on you.</p>${button('Court Roulette','game')}</div><span class="feature-corner">${icon('diamond')} COURT COLLECTION</span></section>${duelPanel()}</div>${ritualRow()}<section class="games-section" id="games"><div class="games-heading">${heading('FIND YOUR TEMPTATION','Take a seat')}${filters()}</div>${gameCards()}</section><div class="emerald-lower"><section class="cases-panel" id="cases">${heading('SOMETHING WORTH OPENING','Inside the vault','All cases','cases')}${caseCards()}${recent()}</section><div class="court-column">${goal()}${contract()}</div></div><div class="last-row">${collection()}${leaderboard()}</div>${footer()}</main>${floating()}</div>`;
}

function velvet() {
  const sidebar = `<aside class="velvet-sidebar">${brand}<span class="sidebar-caption">THE PRIVATE COURT</span><nav aria-label="Main navigation">${sections.slice(0,10).map(([label,glyph,id],i)=>`<a class="${i===0?'selected':''}" href="#${id}">${icon(glyph)}<span>${label}</span>${i===0?'<i></i>':''}</a>`).join('')}</nav><button class="sidebar-more" data-action="menu">All destinations ${icon('arrow')}</button><div class="sidebar-person">${profile}<div><strong>Preview User</strong><small>Level 24 · Her court</small></div></div></aside>`;
  return `<div class="site velvet-site" id="top">${sidebar}<div class="velvet-page"><header class="velvet-header"><span class="velvet-breadcrumb">THE LOBBY <i>/</i> <span>Make yourself at home</span></span><div class="header-tools">${wallet}${menu}</div></header><main class="velvet-main"><div class="velvet-intro">${eyebrow('A PRIVATE INVITATION')}<span class="edition">PRINCIPESSA’S COURT <i>✦</i> VOL. 01</span></div><section class="velvet-cover"><div class="velvet-cover-copy"><h1>An evening<br>at <em>her court.</em></h1><p>Play a little. Collect something beautiful.<br> Leave an impression.</p><div class="velvet-cover-links"><a href="#games">Find your game ${icon('arrow')}</a><a href="#collection">Dress the part ${icon('arrow')}</a></div><div class="velvet-affection"><span>YOUR CONNECTION</span><strong>62 <small>/ 100</small></strong><div><i></i></div><small>Affection</small></div></div><div class="velvet-cover-art">${img('gamble/v5/slots.webp','Principessa welcomes you to her private court','',false)}<div class="cover-art-fade"></div><div class="velvet-quote"><span>“You have my attention.”</span><small>PRINCIPESSA</small></div><span class="cover-seal">P<span>HER PRIVATE COURT</span></span></div></section>${ritualRow()}<div class="velvet-two-column"><section class="velvet-play" id="games">${heading('01 / A LITTLE INDULGENCE','Choose your pleasure')}${filters()}${gameCards(4)}</section><div class="velvet-side">${duelPanel()}${goal()}</div></div><section class="velvet-vault" id="cases"><div class="velvet-vault-intro">${eyebrow('02 / THE COLLECTION')}<h2>Good taste.<br> <em>Rare finds.</em></h2><p>A new detail changes everything.</p><a class="text-link" href="#collection">Explore the collection ${icon('arrow')}</a></div><div>${caseCards()}${recent()}</div></section><div class="last-row">${collection()}${leaderboard()}</div>${contract()}${footer()}</main>${floating()}</div></div>`;
}

function midnight() {
  const rail = `<aside class="midnight-rail"><a class="rail-brand" href="#top" aria-label="Vault Mistress">${icon('crown')}</a><nav aria-label="Main navigation">${[['home','Home','top'],['games','Games','games'],['gift','Cases','cases'],['sword','Crate Duels','duels'],['bag','Collection','collection'],['book','Debt Contracts','contracts']].map(([glyph,label,id],i)=>`<a class="${i===0?'selected':''}" href="#${id}" aria-label="${label}" title="${label}">${icon(glyph)}</a>`).join('')}</nav><button class="icon-button" data-action="menu" aria-label="All destinations">${icon('menu')}</button>${profile}</aside>`;
  return `<div class="site midnight-site" id="top">${rail}<div class="midnight-page"><header class="midnight-header"><a class="midnight-wordmark" href="#top">VAULT<span>MISTRESS</span><i>AFTER HOURS</i></a><div class="header-tools">${wallet}${menu}</div></header><main class="midnight-main"><div class="midnight-heading"><div>${eyebrow('THE NIGHT BELONGS TO HER')}<h1>YOUR NEXT <span>MOVE.</span></h1></div><div class="midnight-host">${avatar()}<div><b>Principessa is expecting you.</b><span>Make it worth her while.</span></div></div></div><section class="midnight-games" id="games"><div class="midnight-game-toolbar"><span class="section-index">01 / THE FLOOR</span>${filters()}</div>${gameCards(4)}</section><div class="midnight-live-bar"><span><span class="live-dot"></span>COURT WIRE</span><p><b>velvetfox</b> found Black Lace <i>✦</i> <b>rosebound</b> sent 15 PM <i>✦</i> A new challenge is waiting</p><button data-action="activity" aria-label="View court activity">${icon('arrow')}</button></div><div class="midnight-duel-stage"><section class="midnight-duel-banner"><span class="section-index">02 / FACE OFF</span><h2>TWO PLAYERS.<br><em>ONE WINNER.</em></h2><p>The same cases. A shared reveal.</p>${button('Create a duel','create-duel',true,'sword')}<div class="duel-banner-cases">${img('crate-icons/principessa-case.webp','Principessa Case')}${img('crate-icons/premium-case.webp','Premium Case')}</div><span class="duel-banner-vs">VS</span></section>${duelPanel()}</div>${ritualRow()}<div class="midnight-lower"><section class="cases-panel" id="cases">${heading('03 / CRACK THE SEAL','FROM THE VAULT','All cases','cases')}${caseCards()}${recent()}</section><div>${goal()}${contract()}</div></div><div class="last-row">${collection()}${leaderboard()}</div>${footer()}</main>${floating()}</div></div>`;
}

document.getElementById('app').innerHTML = ({emerald,velvet,midnight}[design] || emerald)() + `<dialog class="preview-dialog" aria-labelledby="dialog-title"><button class="dialog-close icon-button" aria-label="Close dialog">${icon('close')}</button><div class="dialog-content"></div></dialog><div class="toast" role="status" aria-live="polite"></div>`;
const dialog = document.querySelector('dialog');
const content = dialog.querySelector('.dialog-content');
let previousFocus;
let toastTimer;
let animationTimer;
function toast(message) {
  const el = document.querySelector('.toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3200);
}
function openDialog(html, className = '') {
  if (!dialog.open) previousFocus = document.activeElement;
  content.innerHTML = html;
  dialog.className = `preview-dialog ${className}`;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
}
function title(kicker,text) { return `${eyebrow(kicker)}<h2 id="dialog-title">${text}</h2>`; }
function openGame(name = 'Court Roulette') {
  const game = games.find(g=>g.name===name) || games[0];
  openDialog(`${img(`gamble/v5/${game.file}.webp`,game.name,'dialog-game-art')}${title('THE COURT FLOOR',game.name)}<p class="dialog-description">${game.label}.</p><div class="demo-reel" aria-hidden="true"><span>♛</span><span>♦</span><span>♥</span><span>♛</span><span>♦</span></div><div class="stake-options" role="group" aria-label="Demo stake">${[100,250,500].map((x,i)=>`<button data-stake="${x}" class="${i===0?'active':''}" aria-pressed="${i===0}">${x} Coins</button>`).join('')}</div><button class="button-primary demo-play">Preview animation ${icon('bolt')}</button><small class="demo-notice">Visual demo · No wager or balance change</small>`, 'game-dialog');
}
document.addEventListener('click', event => {
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    const section = filter.closest('section');
    section.querySelectorAll('[data-filter]').forEach(el=>{const on=el===filter;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
    section.querySelectorAll('[data-category]').forEach(el=>el.hidden=filter.dataset.filter!=='all' && el.dataset.category!==filter.dataset.filter);
    return;
  }
  const stake = event.target.closest('[data-stake]');
  if (stake) {
    content.querySelectorAll('[data-stake]').forEach(el=>{el.classList.toggle('active',el===stake);el.setAttribute('aria-pressed',String(el===stake));});
    return;
  }
  if (event.target.closest('.demo-play')) {
    const play=content.querySelector('.demo-play');
    const reel=content.querySelector('.demo-reel');
    play.disabled=true;
    play.textContent='Revealing…';
    reel.classList.add('spinning');
    animationTimer=setTimeout(()=>{reel.classList.remove('spinning');play.disabled=false;play.innerHTML=`Preview again ${icon('bolt')}`;toast('Animation preview complete. Your balance has not changed.');},matchMedia('(prefers-reduced-motion: reduce)').matches?100:1400);
    return;
  }
  if (event.target.closest('.dialog-close')) {dialog.close();return;}
  const el=event.target.closest('[data-action]');
  if (!el) return;
  switch(el.dataset.action) {
    case 'game': openGame(el.dataset.game); break;
    case 'menu': openDialog(`${title('EXPLORE THE COURT','Your destinations')}<nav class="destination-grid">${sections.map(([label,glyph,id])=>`<a href="#${id}">${icon(glyph)}${label}${icon('arrow')}</a>`).join('')}</nav><p class="demo-notice">Lobby concept · Links preview the corresponding sections.</p>`,'menu-dialog'); break;
    case 'wallet': openDialog(`${title('YOUR TREASURY','A little spending power.')}<div class="wallet-preview"><div><small>Coins</small><strong>12,480</strong></div><div><small>Principessa Money</small><strong>25 <em>PM</em></strong></div></div><p class="demo-notice">Sample balances for this design preview. Payments are disabled.</p>`);break;
    case 'profile': openDialog(`${title('YOUR PLACE AT COURT','Preview User')}<div class="profile-preview">${profile}<div><b>Level 24</b><p>Devotion 4,210 · Affection 62</p></div></div><p class="demo-notice">A visible avatar, frame and level keep your collection part of the experience.</p>`);break;
    case 'reward': el.classList.add('claimed');el.querySelector('strong').textContent='Collected for today';el.querySelector('.ritual-arrow').innerHTML=icon('check');el.disabled=true;toast('Reward state previewed. No Coins were added.');break;
    case 'duel': case 'create-duel': openDialog(`${title('CRATE DUELS',el.dataset.action==='duel'?'Meet at the vault.':'Set the challenge.')}<div class="duel-preview-art">${img('crate-icons/premium-case.webp','Premium Case')}<span>VS</span>${img('crate-icons/principessa-case.webp','Principessa Case')}</div><div class="duel-preview-details"><span>Same case selection</span><span>Both players pay their entry</span><span>Highest total value wins</span></div>${button('Preview the reveal','reveal')}<p class="demo-notice">Design demo · No challenge is created or joined.</p>`);break;
    case 'reveal': openGame('Crown Slots');break;
    case 'case': openDialog(`${title('INSIDE THE VAULT',`${el.dataset.case} Case`)}<div class="single-case-art">${img(`crate-icons/${el.dataset.case.toLowerCase()}-case.webp`,`${el.dataset.case} Case`)}</div>${button('Preview the reveal','reveal')}<p class="demo-notice">Design demo · No case is purchased.</p>`);break;
    case 'item': {
      const item=el.dataset.item;
      const source=el.querySelector('img');
      openDialog(`${title('THE COLLECTION',item)}<div class="single-case-art"><img src="${source.src}" alt="${item}"></div><p class="demo-notice">Collectible appearance preview</p>`);break;
    }
    case 'shrine': openDialog(`${title('SHRINE OF PRINCIPESSA','An offering, just for her.')}<div class="shrine-art">${img('principessa-ui/generated/principessa-shrine-offering.webp','Principessa at her shrine')}</div><div class="tribute-options">${[5,10,25].map(x=>`<button data-action="demo-tribute">${x} PM ${icon('heart')}</button>`).join('')}</div><p class="demo-notice">Design preview · Tributes are disabled.</p>`);break;
    case 'demo-tribute': toast('Tribute selection previewed. No PM were spent.');break;
    case 'contract': openDialog(`${title('DEBT CONTRACTS','Make it official.')}<div class="contract-choices">${['Coin Debt','Evil Debt','Throne Debt'].map(x=>`<button data-action="demo-contract">${icon('book')}<strong>${x}</strong>${icon('arrow')}</button>`).join('')}</div><p class="demo-notice">Contract entry preview · No agreement will be submitted.</p>`);break;
    case 'demo-contract':toast('Contract selection previewed. No agreement was created.');break;
    case 'activity': openDialog(`${title('AT THE COURT','The latest whispers.')}<div class="activity-list"><p><b>velvetfox</b><span>Found Black Lace <small>Just now</small></span></p><p><b>midnight</b><span>Opened a Principessa Case <small>2 minutes ago</small></span></p><p><b>rosebound</b><span>Sent 15 PM <small>4 minutes ago</small></span></p></div><p class="demo-notice">Sample activity</p>`);break;
    case 'chat': openDialog(`${title('COURT CHAT','A little company.')}<div class="chat-messages" aria-live="polite"><p><b>velvetfox</b><span>That last reveal was close.</span></p><p class="chat-principessa"><b>Principessa ${icon('crown')}</b><span>I do like a little suspense.</span></p></div><form class="chat-form"><label class="sr-only" for="chat-message">Your message</label><input id="chat-message" placeholder="Say something…" maxlength="240" autocomplete="off" required><button type="submit" aria-label="Send local demo message">${icon('arrow')}</button></form><p class="demo-notice">Local preview · Messages are not sent to anyone.</p>`,'chat-dialog');break;
  }
});
document.addEventListener('click', event => {
  const link=event.target.closest('a[href^="#"]');
  if (!link) return;
  const target=document.getElementById(link.hash.slice(1));
  if(dialog.open)dialog.close();
  if(!target){event.preventDefault();toast('This destination is outside the lobby preview.');return;}
  document.querySelectorAll('.mobile-nav a').forEach(el=>el.classList.toggle('active',el.hash===link.hash));
});
document.addEventListener('submit',event=>{
  if(!event.target.matches('.chat-form'))return;
  event.preventDefault();
  const input=event.target.querySelector('input');
  const text=input.value.trim();
  if(!text)return;
  const message=document.createElement('p');
  const name=document.createElement('b');name.textContent='You';
  const body=document.createElement('span');body.textContent=text;
  message.append(name,body);
  const list=content.querySelector('.chat-messages');list.append(message);list.scrollTop=list.scrollHeight;
  input.value='';input.focus();
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{clearTimeout(animationTimer);document.body.classList.remove('dialog-open');previousFocus?.focus();});
