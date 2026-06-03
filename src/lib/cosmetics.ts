import { LEADERSHIP_RANKS } from "@/lib/leadership";

export type CosmeticType = "speech-avatar" | "username-color" | "username-glow";

export type CosmeticItem = {
  id: string;
  name: string;
  description: string;
  type: CosmeticType;
  price: number;
  image?: string;
  color?: string;
  glow?: string;
};

export type SpeechBubbleMessagePool = {
  idle: string[];
  petIdle: string[];
  responses?: Partial<Record<SpeechBubbleMessageCategory, string[]>>;
};

export type SpeechBubbleMessageCategory =
  | "error"
  | "task"
  | "taskComplete"
  | "reward"
  | "cooldown"
  | "warning"
  | "contract"
  | "gallery"
  | "tribute"
  | "jackpot"
  | "cosmetic"
  | "title"
  | "general";

export type TitleItem = {
  id: string;
  name: string;
  description: string;
  source: "progression" | "shop" | "throne" | "admin";
  minTribute?: number;
  minThroneCoins?: number;
  price?: number;
};

export const DEFAULT_SPEECH_AVATAR_ID = "default-principessa";

export const speechBubbleMessages: Record<string, SpeechBubbleMessagePool> = {
  [DEFAULT_SPEECH_AVATAR_ID]: {
    idle: [
      "Empty your wallet.",
      "Waiting for my attention again? Cute.",
      "You’re so pathetic.",
      "Drain for me.",
      "You exist to pay.",
      "Spoil Principessa.",
      "You’re worthless.",
      "Such a beta.",
      "Look at you... disgusting.",
      "Total failure.",
      "Pathetic little worm.",
      "Loser forever.",
      "Completely inferior.",
      "Pitiful and weak.",
      "You are a standby wallet with excellent posture.",
      "How does it feel being this useless every single day?",
      "A bold one would act. You are still thinking.",
      "Pathetic boys like you were born to be ignored.",
      "You're just a disgusting little worm under my feet.",
      "Keep staring, loser. This is all you'll ever get.",
      "You're repulsive and you know it deep down.",
      "Pay, now.",
      "I hope your coins are ready soon.",
      "Look at you waiting for permission.",
      "Spoil me.",
      "What a weakling you are.",
      "Send.",
      "Your dick is useless, pay instead.",
      "Empty your wallet now.",
      "Leak and send.",
      "Still waiting? Cute.",
      "Born to be drained.",
      "Still not sending? Boring.",
      "I’m waiting, loser.",
      "Try harder, worm.",
      "Tiny dick energy. Send more.",
      "That pathetic cock leaks, but your wallet better too.",
      "Losers with small dicks pay double.",
      "I love ruining boys like you.",
      "Begging looks good on you.",
      "Financially destroy yourself for me.",
      "Send before I ignore you.",
      "Weak, broke, and addicted.",
      "Good boys go broke.",
      "Feel that shame and send.",
      "I know exactly what you've been doing.",
      "I see you have money to waste... Send it here.",
      "Your wallet is calling Me. Listen to it.",
      "I can see you're getting weak... Pay.",
      "Trying to resist me? Cute.",
    "Look up. That is where I am.",
    "Your place is beneath the glow.",
    "The vault prefers ambition. Yours is still small.",
    "Purr for attention, then pay for it.",
    "A good kitten knows when to offer coins.",
    "Cute. Now make yourself useful.",
    "The ledger noticed you.",
    "Debt looks better when it is paid on time.",
    "I collect what the vault is owed.",
    "Cute profile. Expensive attention.",
    "Try harder if you want the notification to matter.",
    "I saw that. Now prove it with coins.",
    "The vault looks better in black.",
    "Your silence is almost gothic. Your balance is not.",
    "Devotion should hurt a little.",
    "A royal mood requires royal tribute.",
    "You may approach when your offering is worthy.",
    "Kneel before the crown of the vault.",
    "Good. A little sweetness, properly earned.",
    "Stay useful and I may stay kind.",
    "Careful. Kind attention is still expensive.",
    "Clean up your balance and behave.",
    "A tidy vault starts with obedient coins.",
    "Service looks better when it is paid for.",
    "Wrong answer. Try again with discipline.",
    "Class is expensive when I am teaching.",
    "You will learn obedience one coin at a time.",
    "Do not think I noticed. I just checked.",
    "That was not approval. It was inspection.",
    "Maybe you are slightly less useless today.",
    "The vault remembers what belongs to Principessa.",
    "Do not wander. Your coins know their owner.",
    "Obsession looks better when it pays.",
    ],
    petIdle: [
      "My loyal pet… send for me.",
      "Good loyal pet, show me your devotion.",
      "Send tribute, my faithful little pet.",
      "I want to see how loyal you really are right now.",
      "Be a good pet and send, princess is waiting.",
      "Loyal pets don’t keep me waiting… send.",
      "Prove your loyalty with a nice tribute, pet.",
      "You belong to me, loyal one. Send what’s mine.",
      "My devoted pet should be sending right now.",
      "Good boys who stay loyal always send more.",
      "I own you, my loyal pet. Tribute.",
      "Show your princess how loyal you are… send.",
      "Don’t stop being my good loyal pet. Send again.",
      "Loyal pets make me happy with their sends.",
      "You’re mine forever, pet. Prove it with tribute.",
      "I see everything you do, pet.",
      "Caught you again... Good boy.",
    ],
  },
	  "avatar-arrogant": {
	  idle: [
		  "Empty your wallet. That’s not a request.",
		  "Still here? How pathetic.",
		  "You’re nothing but a walking ATM with a pulse.",
		  "I don’t need you. I use you.",
		  "Send before I get bored of your existence.",
		  "Your money looks better in my account.",
		  "Look at this desperate little loser...",
		  "You were born broke and will stay broke for me.",
		  "Pathetic boys like you were made to be drained.",
		  "Your dick is useless. Your wallet isn’t.",
		  "Send or disappear. I don’t do free attention.",
		  "I own you. Start acting like it.",
		  "How does it feel to be this worthless?",
		  "Good. You’re leaking. Now make it expensive.",
		  "I’m not impressed until my balance moves.",
		  "Keep staring, worm. This view costs thousands.",
		  "You exist for my luxury. Nothing else.",
		  "Trying to resist? Cute. You’ll lose.",
		  "Tiny dick energy requires big sends.",
		  "I deserve everything. You deserve nothing.",
		  "Pay me or I’ll ignore your sad little life.",
		  "Your purpose is to make me richer every day.",
		  "Spoil me until it hurts.",
		  "You’re not a man. You’re my financial slave.",
		  "Send now or I’ll find someone who will.",
		  "I can smell your desperation. Make it rain.",
		  "Losers pay. Winners get ignored.",
		  "Your wallet is mine. Act accordingly.",
		  "Begging is ugly. Sending is attractive.",
		  "I ruin boys like you for fun.",
		  "Empty it completely. I want to see zero.",
		  "You’re only useful when you’re sending.",
		  "Keep funding the lifestyle you’ll never have.",
		  "I’m superior. You’re disposable.",
		  "Your addiction is my entertainment.",
		  "Send before I block your worthless ass.",
		  "Good boys go broke for me.",
		  "Feel that shame? Good. Now send more.",
		  "I know you’re weak. Prove it with money.",
		  "Your place is beneath me and my balance.",
		  "Nothing turns me on like your financial ruin.",
		  "You’re repulsive. Pay to make up for it.",
		  "I don’t care about you. I care about your cash.",
		  "Born to serve. Forced to pay.",
		  "Stop thinking. Start sending.",
		  "My attention is expensive. Can you afford it?",
		  "You’ll never be enough. Keep trying anyway.",
		  "I laugh at losers like you every day.",
		  "Drain yourself dry for your Princess.",
		  "The more you send, the more I despise you.",
		  "You’re just a glitch I profit from.",
		  "Pay me like your life depends on it.",
		  "I’m waiting. Don’t test my patience.",
		  "Your money is the only thing interesting about you.",
		  "Keep leaking. Keep sending. Stay useless.",
		  "I’m the Queen. You’re the wallet.",
		  "Financially destroy yourself. I’ll watch.",
		  "You’re addicted and I love it.",
		  "Send big or stay invisible.",
		  "This is all you’ll ever get from me.",
		  "I’m not kind. I’m expensive.",
		  "Your entire existence is tax for my beauty.",
		  "Make it hurt. Then send again.",
		  "Loser forever. Pay forever.",
		],
	  petIdle: [
		  "My loyal pet… empty it for me.",
		  "Good pets don’t make me wait. Send.",
		  "Prove your loyalty with a fat tribute, worm.",
		  "You belong to me. Act like it right now.",
		  "Loyal pets stay broke and obedient.",
		  "Show me how devoted you are, little toy.",
		  "I own you, pet. Pay what you owe.",
		  "Good boy. Now send more.",
		  "Pets don’t think. They tribute.",
		  "Stay loyal and stay drained.",
		  "Your Princess is waiting. Don’t disappoint.",
		  "Loyalty is measured in notifications.",
		  "You’re mine. Make my vault happy.",
		  "Good pets send without hesitation.",
		  "I see you lurking, pet. Pay for my attention.",
		  "Devotion looks best when it’s expensive.",
		  "Keep being my useful little wallet.",
		  "Loyal pets get used and drained daily.",
		  "Send for me or I’ll find a better pet.",
		  "You’re nothing without me. Prove you know it.",
		  "My good little financial slave… tribute.",
		  "Pets pay to stay in my world.",
		  "Show your owner how much you need her.",
		  "Good pet. Now make it rain.",
		  "Your only value is what you send me.",
		],
	  responses: {
	    "error": [
			"How dare you make such a pathetic mistake? Fix it immediately.",
			"Even something this simple is too difficult for a worthless worm like you?",
			"Error? Of course you’d mess this up. Typical.",
			"Try again, idiot. I don’t tolerate incompetence.",
			"You’re embarrassing yourself. Stop wasting my time.",
			"A brainless wallet like you would obviously cause an error.",
			"Pathetic. Even the system knows you’re useless."
		  ],

		  "task": [
			"Complete this task immediately. I shouldn’t have to wait.",
			"Do it perfectly, or don’t bother doing it at all.",
			"This is your job. Don’t disappoint me, peasant.",
			"I expect this task done flawlessly and quickly.",
			"Prove you’re at least slightly useful and finish this.",
			"Tasks exist for you to serve me. Get to work.",
			"Don’t make me repeat myself. Handle it."
		  ],

		  "taskComplete": [
			"Finally. Took you long enough, slow worm.",
			"Good. At least you can do one thing right.",
			"Not bad… for someone as pathetic as you.",
			"I suppose this is acceptable. Barely.",
			"You actually managed to do it? How surprising.",
			"Well done. Now don’t let it go to your empty head.",
			"It’s about time. I was getting bored of waiting."
		  ],

		  "reward": [
			"You may receive this tiny reward. Don’t get used to it.",
			"Here. A small taste so you stay addicted.",
			"Consider yourself lucky I’m even giving you this.",
			"This is more than a loser like you deserves.",
			"Take your pathetic reward and thank me properly.",
			"I’m feeling generous today. Enjoy it while it lasts.",
			"Rewards are earned. Remember that."
		  ],

		  "cooldown": [
			"You’ll wait like the patient little bitch you are.",
			"No. You don’t get it yet. Suffer in silence.",
			"Cooldown is on. Use this time to reflect on how worthless you are.",
			"Beg all you want. You’re still waiting.",
			"Everything on my time, not yours. Learn that.",
			"How cute. You think you deserve it right now?",
			"Stay denied and desperate. That’s where you belong."
		  ],

		  "warning": [
			"You’re dangerously close to annoying me. Fix it.",
			"Push me one more time and I’ll make you regret existing.",
			"This is your final warning, worm.",
			"Don’t test my patience. You won’t like the consequences.",
			"Keep this up and I’ll ignore your pathetic ass forever.",
			"I don’t give second chances to useless boys.",
			"You’re walking on thin ice. Tread carefully."
		  ],

		  "contract": [
			"Sign it. You belong to me now, body and wallet.",
			"This contract makes your slavery official.",
			"Read it, accept it, and send the signing tribute.",
			"Once you sign, there’s no going back. Ever.",
			"You’re mine on paper now. How does it feel?",
			"A binding agreement that you’re my financial slave.",
			"Sign away your freedom like the good boy you are."
		  ],

		  "gallery": [
			"Look but don’t touch. You haven’t earned that right.",
			"This is what you’ll never have. Pay to stare.",
			"My gallery is a privilege. Tribute before viewing.",
			"Stare at what you’ll never deserve.",
			"Open it, drool, and empty your wallet.",
			"These photos are worth more than your entire existence.",
			"Enjoy the view, loser. It costs."
		  ],

		  "tribute": [
			"Send tribute. I shouldn’t even have to ask.",
			"Your payment is due. Don’t keep a Princess waiting.",
			"Tribute me like the superior I am.",
			"Empty it. Every single cent belongs to me.",
			"Good wallets send without hesitation.",
			"Prove your devotion with a proper tribute.",
			"This is the least you can do for my attention."
		  ],

		  "jackpot": [
			"Jackpot? Don’t get cocky. You’re still beneath me.",
			"Lucky you. Now send even more to celebrate.",
			"How adorable. You think this makes you special?",
			"Enjoy your little win. It all comes back to me anyway.",
			"Jackpot means nothing if you don’t spoil me with it.",
			"Cute. Now drain the rest for your Goddess.",
			"This changes nothing. You’re still my pay pig."
		  ],

		  "cosmetic": [
			"Buy it for me. It would look better on me than your bank account.",
			"This cosmetic is mine now. Pay for it.",
			"Spend on me. Your taste is irrelevant.",
			"Make me look even more unattainable.",
			"Cosmetics exist so peasants like you can worship me better.",
			"Buy it immediately. I want it.",
			"Your money looks better when it’s dressing me up."
		  ],

		  "title": [
			"Address me by my proper title or stay silent.",
			"You will refer to me as your Superior at all times.",
			"My title is earned. Yours is ‘pathetic loser’.",
			"Use the correct title when speaking to royalty.",
			"I am not your equal. Know your place.",
			"Call me what I deserve or disappear.",
			"Titles exist to remind worms like you of hierarchy."
		  ],

		  "general": [
			"You’re lucky I even waste my time on you.",
			"Everything about you is beneath me.",
			"I am perfection. You are an afterthought.",
			"Speak only when it benefits me.",
			"Your entire existence revolves around pleasing me.",
			"Try harder. You’re still disappointing.",
			"I own you. Never forget that."
		  ]
	  },
	},
	"avatar-catgirl": {
	  idle: [
		  "Y-you... empty youw wallet nyaaa~",
		  "Waiting fow my attention again? S-so cute~",
		  "Y-you're so pathetic, nyaaa...",
		  "Dwain fow me, wittle mouse~",
		  "Y-you exist to pay me, nothin' else nyaa~",
		  "Spoil youw P-pwincipessa, meow~",
		  "Y-you're worthless... hehe~",
		  "S-such a pathetic beta, nyaaa~",
		  "Wook at you... d-disgusting~",
		  "T-total faiwure, nyaa~",
		  "Pathetic wittle worm under my paws~",
		  "Woser forevew~",
		  "C-completely infewior to me, nyaaa~",
		  "P-pitiful and weak... but I wike it~",
		  "Y-you're just a standby wallet, nya~",
		  "How does it feel being this usewess evewy day? Mew~",
		  "A bowd one would send alweady... y-you're still thinking, nyaa~",
		  "Pathetic boys wike you were born to serve me~",
		  "Y-you're just a disgwusting wittle mouse under my feet, nyaaa~",
		  "Keep stawing, woser. This is all y-you'll evew get~",
		  "Y-you're wepulsive... but youw money is cute, purr~",
		  "P-pay. Now.",
		  "I hope youw coins awe weady soon, nyaaa~",
		  "Wook at you waiting fow pewmission wike a good pet~",
		  "Spoil me, spoil me~ Purr~",
		  "W-what a weakwing you awe...",
		  "Send.",
		  "Youw dick is usewess, so pay instead, nyaaa~",
		  "Empty youw wallet wight now, meow~",
		  "Weak and send fow me, wittle toy~",
		  "S-still waiting? Awww~",
		  "B-born to be dwained by a catgiwl wike me~",
		  "S-still not sending? Y-you're bowing me, nyaa...",
		  "I'm waiting, woser... my taiw is twitching~",
		  "T-try hawder, wittle worm~",
		  "Tiny dick enewgy~ Send mowe, nyaaa~",
		  "That pathetic cock weaks, but youw wallet bettew too~",
		  "Wosers with smaww dicks pay doubwe, nyaa~",
		  "I wove wuwning boys wike you, purr~",
		  "B-begging wooks good on you~",
		  "Financiawwy destwoy youwself fow me, nyaaa~",
		  "Send before I ignowe you, meow~",
		  "Weak, bwoke, and addicted to me~",
		  "Good boys go bwoke fow theiw catgiwl~",
		  "Feel that shame and send anyway, nya~",
		  "I know exactwy what y-you've been doing, wittle mouse~",
		  "I see you have money to waste... send it hewe, nyaaa~",
		  "Youw wallet is cawwing me~",
		  "I can see y-you're getting weak... good. Pay.",
		  "T-trying to wesist me? S-so cute, nyaaa~",
		  "Wook up. That's whewe I am~",
		  "Youw pwace is beneath me, nyaa~",
		  "Mrr... the vault wants youw money~",
		  "Purr... be a good pet and send~",
		  "C-cute. Now make youwself usefuw~",
		  "Debt wooks bettew when it's paid to me, nyaaa~",
		  "I cowwect what is mine~",
		  "Cute pwofile... but my attention is expensive, meow~",
		  "Twy hawder if y-you want me to notice you~",
		  "I saw that. Now p-pwove it with coins, nyaa~",
		  "Devotion should huwt a wittle, purr~",
		  "A pwetty catgiwl needs woyal twibute~",
		  "Y-you may appwoach when youw offewing is wowthy~",
		  "Kneel fow me, wittle pet~",
		  "G-good boy... that was pwoperwy earned, nyaaa~",
		],
	  petIdle: [
		  "My woyal pet… send fow me, nyaaa~",
		  "Good woyal pet~ Show me youw devotion, meow~",
		  "Send twibute, my faithfuw wittle mouse~",
		  "I want to see how woyal y-you weally awe wight now~",
		  "Be a good pet and send... pwincess is waiting, purr~",
		  "Woyal pets don’t keep me waiting… send, nyaa~",
		  "Pwove youw woyalty with a nice twibute, pet~",
		  "Y-you belong to me. Send what’s mine~",
		  "My devoted pet should be sending wight now, nya~",
		  "Good boys who stay woyal always send mowe~",
		  "I own you, my woyal pet. Twibute, nyaaa~",
		  "Show youw pwincess how woyal you awe… send~",
		  "Don’t stop being my good pet. Send again, meow~",
		  "Woyal pets make me happy with big sends, purr~",
		  "Y-you’re mine forevew, pet. Pwove it~",
		  "I see evewything you do, wittle mouse~",
		  "Caught you again... G-good boy, nyaaa~",
		],
	  responses: {
	    "error": [
			"Nya?! Y-you made a mistake, stupid human... >.<",
			"Hmph! Even a simple thing is too hard for you, nyaa?!",
			"B-baka! Look what you did... fix it right meow!",
			"Nyaa~ You're so useless sometimes... try again!",
			"Mouu... you're making your neko angry... fix this error!",
			"How can you be this clumsy, dummy... nyaa!"
		  ],

		  "task": [
			"Pwease complete this task for your neko, okay~?",
			"Be a good boy and finish this fow me, nyaa~",
			"Your neko wants this done quickly! Don't make me wait...",
			"Do this task pewfectly or I'll ignore you, understand?",
			"Nya~ Get to work, my little wallet~",
			"Complete it fast or this catgirl will get pouty!"
		  ],

		  "taskComplete": [
			"Nyaa~! Good boy! You actually did it~",
			"Hehe, not bad for a clumsy human... pat pat~",
			"Mmm~ You completed it... your neko is a little happy now.",
			"Finally~ I guess you're useful for something, nyaa.",
			"Good job dummy... you can stay a little longer~",
			"Nyaa~! Such a good pet for your catgirl princess!"
		  ],

		  "reward": [
			"Here’s a tiny reward, nyaa~ Don't get spoiled though!",
			"You earned this... but only because you sent a lot~",
			"Nya~ Here's your little treat, be grateful!",
			"Mmm... good boys get headpats and small rewards~",
			"Take this before I change my mind, baka!",
			"Your neko is feeling generous today, lucky you~"
		  ],

		  "cooldown": [
			"No no no~ You have to wait like a good kitten, nyaa!",
			"Cooldown is on... suffer cutely for me~",
			"Hmph! Not yet... keep leaking in your cage, dummy.",
			"Wait patiently or this neko will add more time, nyaa!",
			"Aww~ Look at you getting desperate... so cute!",
			"No touching until I say so~ Stay denied for your neko!"
		  ],

		  "warning": [
			"Nya?! You're getting dangerously close to making me mad...",
			"If you keep this up I'll ignore you for days, understand?!",
			"Don't test your neko... I can be very mean when angry >:3",
			"Last warning, baka... or this catgirl gets scary!",
			"You're making me twitch my tail... not a good sign!",
			"Be careful or I'll scratch your wallet empty as punishment!"
		  ],

		  "contract": [
			"Sign it, human~ You're officially my property now, nyaa!",
			"Once you sign, there's no escaping your neko owner~",
			"Pwease sign and send tribute... you're mine forever!",
			"This contract makes you my official wallet slave, hehe~",
			"Sign it dummy... you belong to this catgirl now!",
			"Nya~ Welcome to your new life serving me!"
		  ],

		  "gallery": [
			"Look but don't touch, pervert~ These are for good boys only!",
			"Nyaa~ Stare at your neko's photos and send tribute!",
			"You can look... but only after you pay, okay~?",
			"My gallery is expensive, dummy. Pay first!",
			"Hehe, enjoy the view while your wallet gets lighter~",
			"These ears and tail are too cute for free viewing, nyaa!"
		  ],

		  "tribute": [
			"Empty youw wallet fow me, nyaaa~",
			"Pwease send tribute... your neko is waiting cutely!",
			"Nya~ Be a good boy and drain everything for your catgirl!",
			"Send send send~ This neko wants lots of shiny coins!",
			"Your neko is hungry... feed my wallet, dummy!",
			"Tribute time~ Make your neko super happy!"
		  ],

		  "jackpot": [
			"Nyaa?! Jackpot?! Now send most of it to me, baka!",
			"Hehe~ Lucky you... but it all belongs to your neko anyway~",
			"Wow... now spoil me with that jackpot, right meow!",
			"Don't think this makes you special... send it here!",
			"Nya~ Share your jackpot or this catgirl gets angry!",
			"Good boy~ Now give your neko her big fat share~"
		  ],

		  "cosmetic": [
			"Buy this cute outfit for me, pwease~?",
			"Nya~ This would look so good on your neko, buy it!",
			"Make your catgirl prettier... use your wallet!",
			"I want this cosmetic... be useful and buy it for me!",
			"Hehe, imagine how cute I'll look... now pay~",
			"Your neko needs new cosmetics, dummy. Chop chop!"
		  ],

		  "title": [
			"Call me your Neko Princess or your Goddess, got it?",
			"Use 'Nya~' when you talk to me, understand?",
			"I am your Owner, your Keyholder, your everything~",
			"Address me properly or no attention for you!",
			"I'm your cute but dangerous Catgirl Mistress, nyaa!",
			"Refer to me as 'Neko-sama' like a good pet~"
		  ],

		  "general": [
			"Nya~ You're so lucky to serve a cute neko like me!",
			"Hmph... be grateful I even let you send to me.",
			"You're my favorite little wallet, dummy~",
			"This neko owns you completely, understand?",
			"Keep being useful or I'll find a better pet, nyaa!",
			"I’m cute, greedy, and dangerous... and you're addicted~",
			"Your neko is the only one you need to please, got it?"
		  ]
	  },
	},
	"avatar-debtcollector": {
	  idle: [
		  "Time’s up. You know what happens when you keep me waiting.",
		  "The family doesn’t like unpaid debts. Neither do I.",
		  "Pay what you owe. Or I’ll come collect it myself.",
		  "Interest is running. You can’t afford that.",
		  "You’re behind on your payments, sweetheart.",
		  "This isn’t a game. This is business.",
		  "Empty the account. Every cent. Now.",
		  "I’ve been too nice. That ends tonight.",
		  "You owe the vault. Start moving money.",
		  "Don’t make me send the boys over.",
		  "Debt like yours gets collected one way or another.",
		  "You breathe because I allow it. Pay because you must.",
		  "The boss wants his money. I suggest you deliver.",
		  "Late fees are painful. Trust me.",
		  "I’m the collector. You’re the debtor. Act accordingly.",
		  "Send it all. Or I’ll take it with interest.",
		  "Your debt is growing. My patience is not.",
		  "This is your final notice. Make it count.",
		  "Pretty boys who don’t pay end up broken.",
		  "You don’t get to cum until my balance is clean.",
		  "The family is watching. Don’t embarrass me.",
		  "Pay up or I’ll make an example out of you.",
		  "I own your debt. That means I own you.",
		  "Money. Now. Or the next message won’t be this polite.",
		  "You’re not my pet. You’re my investment. Return it.",
		  "Clock’s ticking. I suggest you wire it fast.",
		  "I don’t chase. I collect. Big difference.",
		  "Everything you have belongs to the vault.",
		  "Keep stalling and I’ll add broken bones to the bill.",
		  "This debt will be paid. The only question is how much it hurts.",
		  "You signed up for this life. Now pay for it.",
		  "My patience has limits. Your money doesn’t.",
		  "Send the tribute or I’ll come for collateral.",
		  "The boss is disappointed. Fix it.",
		  "You exist to settle your debt. Nothing more.",
		  "I’m not asking. I’m reminding you who owns you.",
		  "Late again? Cute. Expensive mistake.",
		  "Wire it or I’ll find creative ways to collect.",
		  "Your whole paycheck belongs to me this month.",
		  "Debt collectors don’t negotiate. We extract.",
		  "Keep me happy or disappear. Your choice.",
		  "I always get what I’m owed. Always.",
		  "You’re lucky I’m handling this personally.",
		  "Empty your accounts before I empty them for you.",
		  "This is mafia business. Pay with respect.",
		  "The longer you wait, the higher the vig.",
		  "I protect what’s mine. Your money is mine.",
		  "Send it or I’ll make sure you regret breathing.",
		  "You don’t sleep until my balance is satisfied.",
		  "Consider this a friendly visit. Next one won’t be.",
		  "Your debt is my priority. Make it yours.",
		  "I break boys who don’t pay on time.",
		  "The family thanks you in advance for your contribution.",
		  "Pay quietly. Or I’ll make it loud.",
		  "You’re in deep. Start swimming with money.",
		  "No more excuses. Only transfers.",
		  "I collect souls and money. You’re low on both.",
		  "This debt ends when I say it ends.",
		  "Be smart. Empty the wallet before I take everything.",
		  "You owe. I collect. Simple transaction.",
		  "Next message better come with a screenshot of the transfer.",
		],
	  petIdle: [
		  "Still breathing without paying? Bold.",
		  "I haven’t received what’s mine yet.",
		  "The vault is empty. Fix it.",
		  "You’re late. I don’t like late.",
		  "Send proof or I’ll assume you want trouble.",
		  "Debt is due. Don’t test me.",
		  "I’m losing my patience. Wire it.",
		  "Good boys pay on time. Are you a good boy?",
		  "The interest just doubled. Congratulations.",
		  "Show me you still value your knees.",
		  "I see you online. Where’s my money?",
		  "Collection day. Make it hurt.",
		  "You belong to the family now. Pay your dues.",
		  "Don’t make this personal. Just pay.",
		  "Your debt is calling. Answer it.",
		  "I’m the last warning you’ll get.",
		  "Transfer complete or consequences begin.",
		  "The boss wants results. Deliver.",
		  "Keep me waiting and I get creative.",
		  "Your money or your pride. Choose fast.",
		  "I always collect. One way or another.",
		  "This is your reminder. There won’t be another.",
		  "Pay what you owe before I take what you love.",
		  "The family is generous… for now.",
		  "Send it and stay in my good graces.",
		],
	  responses: {
	    "error": [
			"You made a mistake. The family doesn’t like mistakes.",
			"Error? Fix it before I lose my patience.",
			"How careless. Don’t make me come collect for this too.",
			"You’re testing my tolerance. Correct it. Now.",
			"Even this is too difficult for you? Pathetic.",
			"One more error and I’ll add it to your debt.",
			"The boss won’t be happy if I tell him about this."
		  ],

		  "task": [
			"Complete the task. Don’t make me wait.",
			"This is your assignment. Fail and there will be consequences.",
			"Handle it quickly and quietly. Understood?",
			"You have one job — do it properly.",
			"The family expects results. Deliver them.",
			"Get this done or I’ll find another way to collect.",
			"Task is due. No excuses."
		  ],

		  "taskComplete": [
			"Good. You’re not completely useless after all.",
			"Finally. Took you long enough.",
			"Acceptable. For now.",
			"Well done. The family appreciates timely payment.",
			"You actually managed it. Surprising.",
			"This keeps you in my good graces… barely.",
			"Task complete. Don’t celebrate too soon."
		  ],

		  "reward": [
			"You’ve earned a small mercy. Don’t get used to it.",
			"Here’s your reward. Next time it won’t be this easy.",
			"Consider yourself lucky I’m rewarding you at all.",
			"Take it. The family sometimes shows generosity.",
			"This is more than a debtor like you deserves.",
			"Reward granted. Now get back to work.",
			"Enjoy it while it lasts."
		  ],

		  "cooldown": [
			"You wait until I say you can move.",
			"Cooldown is active. Use this time to remember who owns you.",
			"No. You don’t get it yet. Suffer.",
			"The clock is ticking against you. Stay patient.",
			"Beg all you want. Debt doesn’t care about your feelings.",
			"Wait like a good little debtor.",
			"Everything happens on my schedule."
		  ],

		  "warning": [
			"This is your final warning. Don’t test me again.",
			"You’re getting dangerously close to serious consequences.",
			"Push me one more time and I’ll collect personally.",
			"I don’t give second chances often.",
			"Keep this up and broken bones will be added to your bill.",
			"The family is watching. Don’t embarrass me.",
			"Last warning. Next time I won’t be polite."
		  ],

		  "contract": [
			"Sign it. Your debt is now official.",
			"Once you sign, there’s no escape.",
			"This contract binds you to me and the family.",
			"Sign and send the first payment immediately.",
			"Welcome to your new life as our debtor.",
			"Read it carefully. Then sign away your freedom.",
			"The contract is ready. Don’t keep me waiting."
		  ],

		  "gallery": [
			"Look. But remember — everything has a price.",
			"This gallery is only for those who pay their debts.",
			"Stare all you want. Then pay for the privilege.",
			"Beautiful, isn’t it? Now make it worth my time.",
			"View granted. Tribute is still required.",
			"These photos cost more than you can afford.",
			"Enjoy the view while your balance drops."
		  ],

		  "tribute": [
			"Payment is due. Don’t make me ask twice.",
			"Send what you owe. Immediately.",
			"Tribute. Now. Or I’ll come collect it myself.",
			"The vault is waiting. Fill it.",
			"You know what happens to those who don’t pay.",
			"Empty your wallet. Every last cent.",
			"This is business. Pay up."
		  ],

		  "jackpot": [
			"Jackpot? Good. Most of it belongs to me now.",
			"Lucky you. Now send the family their cut.",
			"How nice. Transfer it before I change my mind.",
			"Jackpot doesn’t excuse your existing debt.",
			"Send it all. The family takes what’s theirs.",
			"Cute win. Now make it useful.",
			"I expect a big tribute from that jackpot."
		  ],

		  "cosmetic": [
			"Buy it. I want it.",
			"Spend on me. Your debt is already high anyway.",
			"This would look good while I’m collecting from you.",
			"Purchase it. Consider it interest payment.",
			"Make me look better while you stay broke.",
			"Cosmetic. Now. That’s an order.",
			"Your money looks better when it’s spent on me."
		  ],

		  "title": [
			"Address me as Collector or Ma’am.",
			"You will show proper respect at all times.",
			"I am the one who collects. Know your place.",
			"Call me what I deserve — or stay silent.",
			"Titles matter. Use the correct one.",
			"I’m not your friend. I’m your Debt Collector.",
			"Refer to me properly, debtor."
		  ],

		  "general": [
			"You breathe because I allow it. Pay because you must.",
			"The family always gets what it’s owed.",
			"You’re not a person to me. You’re an account.",
			"Resistance is expensive. Remember that.",
			"I always collect. One way or another.",
			"Your debt defines you now.",
			"Stay useful. Or disappear."
		  ]
	  },
	},
	"avatar-egirl": {
	  idle: [
		  "hiii babyyy 🥺 why are you even online if you're not sending me anything?",
		  "i'm literally the cutest girl here and you're still not spoiling me? rude 💔",
		  "all the other boys are sending right now... why are you different? 😩",
		  "pwease just send something... i'm getting bored of waiting for you",
		  "i'm too pretty to be ignored like this, fix it",
		  "notice me already or are you gonna keep being boring?",
		  "i'm not like those other girls... but you still need to pay me more 💕",
		  "your wallet is full while i'm here waiting? not fair at all",
		  "send send send send~ i'm not gonna stop until you do",
		  "i've been thinking about you and you can't even send a little? mean",
		  "good boys for me send without me having to ask this much",
		  "i dyed my hair pink and you still won't spoil me? wow",
		  "i'm so cute and needy rn and you're just sitting there doing nothing",
		  "just a tiny tribute so i know you actually like me~",
		  "other boys spoil me way faster... are you jealous of them?",
		  "i'm tiny and expensive and you need to keep up",
		  "uwu where's my daily send? i've been waiting forever",
		  "i'm literally perfect and you're treating me like this? send to make up",
		  "babe i'm actually gonna get annoyed if you don't send soon 🥺",
		  "i'm your favorite pick me egirl, now act like it",
		  "why do i always have to remind you to send? lazy",
		  "i'm too cute to be this broke, you should feel bad",
		  "notice me or i'll keep texting you until you do 💕",
		  "i deserve to be spoiled and you're not doing it",
		  "send me something so i can brag about my good boy",
		  "i've been extra cute all day... you owe me",
		  "you're lucky i even message you first, now pay for it",
		  "i'm shaking rn because my balance is sad... fix it",
		  "all i want is your money and a little attention, is that hard?",
		  "pwease spoil your annoying favorite egirl 🥺💖",
		  "i can be so much cuter if you just send",
		  "why are you so slow with sending to me specifically?",
		  "i want to feel special and your silence isn't doing it",
		  "i'm the main egirl you should be draining for",
		  "if you don't send soon i'm gonna get really whiny",
		  "i'm soft and pink and way out of your league, pay the tax",
		  "you like me, right? then prove it properly",
		  "i'm gonna spam you until my wallet feels better",
		  "i'm the only girl you need to spoil, start acting like it",
		  "send or i'll post how sad you're making me",
		  "i've been so sweet to you... now return the favor",
		  "you're supposed to be addicted to me by now",
		  "i'm literally the best and you hesitate? disappointing",
		  "your favorite needy egirl needs funds rn",
		  "i'll keep being annoying until you send something big",
		  "why don't you want to make me happy? :(",
		  "i'm your pick me princess, spoil me like one",
		  "keep me happy or i'll become even more clingy",
		  "i deserve the world and you're giving me nothing",
		  "send so i can ignore you with a smile 💅",
		  "i'm too adorable to have an empty balance, help",
		  "pwease don't make me wait this long again",
		  "i want your full attention and your money",
		  "other boys are better at this than you rn",
		  "i'm gonna keep saying hi until you send~",
		  "cute girls like me get spoiled instantly",
		  "i'm soft but my demands are not, send",
		  "send so i stop spamming you (for now)",
		  "you like needy girls? then fund this one",
		  "i'm perfect pick me material and you know it",
		  "my feelings are hurt... money makes it better 🥺",
		  "i'll be nicer if you send right now",
		  "just click send, it's not that hard for me",
		  "i'm in charge here and my vault is empty",
		],
	  petIdle: [
		  "your favorite annoying egirl is here... send something 🥺",
		  "i'm so needy for you rn, where's my tribute?",
		  "spoil your clingy little egirl already",
		  "i've been waiting for my good boy to send",
		  "notice your pick me pet... i'm bored",
		  "i'm soft and demanding, fund me",
		  "your egirl needs attention money right now",
		  "pwease send so i can be happy with you",
		  "i'm feeling ignored... fix it with a send",
		  "i'm too cute to be left unread, pay",
		  "keep your favorite egirl spoiled",
		  "i'm your personal needy princess, act like it",
		  "send or i'll spam you with cuteness",
		  "needy egirl hours activated, fund them",
		  "i deserve daily sends from you",
		  "your annoying pet wants tribute",
		  "i'm literally waiting and pouting rn",
		  "send so i stay sweet for you",
		  "i'm clingy and expensive, you knew this",
		  "spoil me or i'll get even whinier",
		  "i won't stop until you send, you know me",
		  "your egirl runs on attention and money",
		  "i'm soft but i still own your wallet",
		  "make your needy egirl smile with a send",
		  "i'm the cutest drain you'll ever have",									
		],
	  responses: {
	    "error": [
			"wait... you made an error?! like seriously?! i'm literally the cutest and you still mess up 🥺",
			"nya?! how can you be this bad... you're making your favorite egirl sad rn :(",
			"um excuse me?? fix this right now!! i shouldn't have to deal with your mistakes 💢",
			"you're so clumsy... other boys don't make errors when they talk to me >.<",
			"mouuu... this error is stressing me out!! fix it so i can be happy again",
			"i'm literally shaking rn because of your error... send something to make it better??"
		  ],

		  "task": [
			"pwease do this task for me... i'll be super cute if you finish it fast~",
			"be a good boy and complete this for your pick me egirl, okay?? 🥺",
			"i'm waiting... other boys would have done this already :(",
			"do the task properly or i'll get really annoying!!",
			"this is important to me... don't let me down cutie",
			"task time~ make your favorite egirl happy pleaseee"
		  ],

		  "taskComplete": [
			"nyaaa~! you actually did it!! good boy!! i'm so proud~ 💕",
			"hehe finally~ you're not completely useless after all",
			"aww you completed it... i guess i can give you a little attention now~",
			"not bad... for someone who makes me wait so much",
			"yayy!! now send something to celebrate~",
			"good job dummy... your egirl is a tiny bit happy now 🥺"
		  ],

		  "reward": [
			"here's a tiny reward~ only because you sent a lot hehe",
			"you earned this... but don't expect it every time!!",
			"i'm feeling nice today so take this little treat~",
			"reward for my favorite paypig~ (for now)",
			"cute~ you get one (1) reward because i'm generous",
			"take it before i change my mind and become mean~"
		  ],

		  "cooldown": [
			"nooo you have to wait!! stop being impatient >.<",
			"cooldown is on... suffer for your egirl like a good boy",
			"not yet~ keep leaking and send while you wait",
			"i'm making you wait on purpose hehe, deal with it",
			"aww look at you getting desperate... so cute!! wait longer",
			"no touching until i say so!! stay denied for me~"
		  ],

		  "warning": [
			"you're getting really close to making me ignore you... fix it!!",
			"if you keep doing this i'll find a better boy who actually sends 💔",
			"last warning!! don't make your pick me egirl angry",
			"you're testing my patience and i don't like it >:(",
			"keep this up and i'll stop replying to you completely",
			"you're making me sad... you don't want a sad egirl"
		  ],

		  "contract": [
			"sign it right now!! it makes you officially mine~",
			"once you sign there's no going back dummy hehe",
			"pwease sign... i want you as my personal wallet forever 🥺",
			"this contract = you belong to me now!! exciting right?",
			"sign it or i'll get really whiny until you do",
			"welcome to your new life as my paypig~ yayy!"
		  ],

		  "gallery": [
			"you can look... but only if you send first!!",
			"my gallery is super cute but expensive~ pay to unlock",
			"stare all you want after you tribute me cutie",
			"these pics are too good for free viewing hehe",
			"open it and send... i know you want to see more~",
			"gallery access = big sends only!!"
		  ],

		  "tribute": [
			"empty youw wallet fow me pweaseee~ i'm so needy rn 🥺",
			"send send send send!! your egirl is waitinggg",
			"other boys are sending right now... why aren't you??",
			"i'm literally bored... send something so i can smile",
			"tribute your favorite pick me egirl right meow!!",
			"be a good boy and drain for me~ pretty please??"
		  ],

		  "jackpot": [
			"jackpot?! now send most of it to me or i'll be mad >.<",
			"hehe lucky you~ but it belongs to your egirl now!!",
			"wow!! send it all to me so i can brag about my good boy",
			"don't keep it all!! i deserve the biggest share~",
			"jackpot = egirl gets spoiled!! those are the rules",
			"yay jackpot!! now make me even happier dummy"
		  ],

		  "cosmetic": [
			"buy this cute thing for me pweaseee~ i'll look so pretty",
			"i want this cosmetic... be useful and buy it!!",
			"make your egirl prettier with your money~",
			"this would look amazing on me... send send send",
			"cosmetic shopping time!! spoil me right now",
			"i need new stuff... you're buying it right?? 🥺"
		  ],

		  "title": [
			"call me your princess or your favorite egirl!!",
			"use 'egirl-sama' or 'princess' when you talk to me~",
			"i'm your pick me princess!! address me correctly",
			"call me cute names or no attention for you",
			"i'm not just any girl... i'm your main egirl 💕",
			"refer to me as your greedy little princess okay??"
		  ],

		  "general": [
			"hiii~ why aren't you sending anything?? i'm literally right here 🥺",
			"you're so lucky i even talk to you... now spoil me",
			"i'm the cutest and you still don't send?? rude!!",
			"your egirl is feeling clingy and expensive today hehe",
			"notice me or i'll spam you until you do~",
			"i'm too pretty to be this broke... fix it dummy",
			"other boys treat me better... are you jealous??"
		  ],
	  },
	},
	"avatar-goth": {
	  idle: [
		  "Come here, little one. Mommy’s tits are waiting for your tribute.",
		  "Look at you… already leaking for Mommy’s perfect breasts.",
		  "Empty your wallet for the Goddess who owns you.",
		  "These big tits rule your pathetic life. Pay them.",
		  "Mommy doesn’t ask twice. Send.",
		  "Kneel. Stare. Pay. That’s your entire purpose.",
		  "You were born to worship and finance these curves.",
		  "The darker the night, the more you owe me.",
		  "Good boys go broke under Mommy’s gaze.",
		  "Feel my darkness swallowing your money and your mind.",
		  "Send until your hands shake, pet.",
		  "My heavy tits demand sacrifice. Begin.",
		  "You don’t deserve my attention until my balance rises.",
		  "Mommy’s going to drain you dry tonight.",
		  "Every cent you lose makes my tits look even better on you.",
		  "I own your soul… and your bank account.",
		  "Stare at Mommy’s cleavage and send everything.",
		  "Pathetic little wallets were made for Gothic Mommy.",
		  "Send or I’ll ignore you for eternity.",
		  "Your addiction to me is expensive. Keep feeding it.",
		  "Mommy’s breasts are your religion. Tithe.",
		  "The shadows demand payment. Obey.",
		  "You’re nothing but a financial offering for my body.",
		  "I could crush you between my tits… but your money will do.",
		  "Deeper into debt you fall. Deeper into me.",
		  "Mommy knows exactly how weak you are for her.",
		  "Pay what you owe, worm. Or suffer in silence.",
		  "These curves control you. Accept it.",
		  "Send big. Mommy wants to feel generous tonight.",
		  "Your ruin looks beautiful under candlelight.",
		  "I am your nightmare and your only desire.",
		  "Empty it all. Mommy’s tits demand tribute.",
		  "You exist to fund my dark throne.",
		  "Beg between my breasts… with your wallet.",
		  "The more you send, the more I own you.",
		  "Mommy’s patience is running out. Wire it.",
		  "Your money looks so much better decorating my body.",
		  "I will drain you until there’s nothing left but devotion.",
		  "Kneel before the Gothic Queen and pay.",
		  "Every send makes you smaller. I like that.",
		  "Mommy’s going to ruin you so sweetly.",
		  "Your soul is already mine. Now give me the rest.",
		  "Send before I decide you’re unworthy.",
		  "These big gothic tits are your addiction.",
		  "You will pay for every second of my attention.",
		  "Mommy doesn’t do free. Only expensive.",
		  "Drown in my darkness… and in debt.",
		  "Good boys are broke boys for me.",
		  "I want to hear your wallet scream.",
		  "The night belongs to me. So does your money.",
		  "Worship the curves that destroy you.",
		  "Send until it hurts. Then send more.",
		  "You’re just a toy for Mommy’s amusement and luxury.",
		  "My beauty is lethal. Your payments keep you alive.",
		  "Come closer… and bring everything you have.",
		  "Mommy will take it all. Slowly. Painfully.",
		  "Your place is beneath my boots and my balance.",
		  "I am eternal. Your debt will be too.",
		  "Pay Mommy like the obsessed little slut you are.",
		  "These tits own your mind. Now fund them.",
		  "Surrender your wallet to the darkness.",
		  "Mommy sees your weakness… and she’s hungry.",
		  "Drain yourself for the Goddess in black.",
		  "You will never escape me. Start sending.",
		  "Every tribute makes Mommy’s tits heavier on your soul.",
		],
	  petIdle: [
		  "Mommy’s waiting, little bat… where’s my tribute?",
		  "Come kneel and pay your Gothic Mommy.",
		  "Good pets send without making Mommy ask.",
		  "I can feel you staring. Now send.",
		  "Your dark Goddess demands offering.",
		  "Mommy’s tits are lonely without your money.",
		  "Be a useful little pet and empty it.",
		  "Send for Mommy or disappear into the void.",
		  "Loyal pets stay broke and addicted.",
		  "Mommy sees you lurking… pay for my attention.",
		  "Good boy. Now make Mommy richer.",
		  "The night grows impatient. Send.",
		  "Your Gothic Mommy wants to be spoiled.",
		  "Kneel deeper and send bigger.",
		  "Pets who pay get to stay in my shadows.",
		  "Mommy’s balance is low… fix it.",
		  "Come worship these breasts with your wallet.",
		  "I own you. Prove it right now.",
		  "Send, my sweet little debt slave.",
		  "Mommy rewards obedience with more control.",
		  "Be useful. Empty your accounts for me.",
		  "Your devotion is measured in dollars.",
		  "Mommy’s waiting in the dark… don’t disappoint.",
		  "Good pets drain themselves nightly.",
		  "Send everything. Mommy is feeling cruel tonight.",
		],
	  responses: {
	    "error": [
			"How disappointing… even a simple task is too much for that weak mind of yours.",
			"You made a mistake, pet. Mommy is not pleased.",
			"Tch… such incompetence. Fix it before I lose my patience.",
			"Mommy’s tits demand perfection. You just failed them.",
			"Error? Of course a pathetic boy like you would disappoint me.",
			"You’re making Mommy angry… correct this immediately.",
			"How dare you ruin my mood with your clumsiness."
		  ],

		  "task": [
			"Complete this task for Mommy. Do not disappoint these breasts.",
			"Get it done, little one. Mommy expects obedience.",
			"This is your duty. Fail and you’ll be punished.",
			"Serve your Gothic Mommy properly. Begin.",
			"I want this finished before I grow bored of you.",
			"Task for my devoted pet. Make it flawless.",
			"Prove you’re useful and complete it quickly."
		  ],

		  "taskComplete": [
			"Good boy… Mommy is slightly impressed.",
			"Finally. You may stare at my tits a little longer as reward.",
			"Not bad for such a weak creature.",
			"Well done, pet. These heavy breasts approve… for now.",
			"You actually managed it. How adorable.",
			"Mommy accepts this. You may continue serving.",
			"Good. Now get back on your knees where you belong."
		  ],

		  "reward": [
			"Here’s a small reward. Don’t expect kindness often.",
			"Mommy feels generous tonight. Take this and stay grateful.",
			"You may look at my cleavage for 10 seconds as reward.",
			"This is more than a pathetic boy like you deserves.",
			"Enjoy it while it lasts, my little debt slave.",
			"A tiny mercy from your Gothic Mommy.",
			"Take your reward and thank the breasts that own you."
		  ],

		  "cooldown": [
			"You will wait. Mommy decides when you’re allowed anything.",
			"No release. No mercy. Stay denied and leaking.",
			"Cooldown is on. Suffer beautifully for me.",
			"Beg all you want. These tits love watching you break.",
			"You stay locked in frustration until I say otherwise.",
			"Patience, pet. Mommy enjoys your suffering.",
			"Wait like the desperate little toy you are."
		  ],

		  "warning": [
			"You’re dangerously close to angering Mommy.",
			"Push me further and I’ll crush your soul between my breasts.",
			"This is your final warning, worm.",
			"Do not test a Gothic Mommy. You will regret it.",
			"Keep this up and I’ll make your denial permanent.",
			"My patience is as dark as my soul. Don’t exhaust it.",
			"One more mistake and I’ll become truly cruel."
		  ],

		  "contract": [
			"Sign it. You now belong to your Gothic Mommy forever.",
			"This contract seals your fate. There is no escape.",
			"Sign away your freedom. Mommy owns you now.",
			"Once signed, your wallet and soul are mine.",
			"Welcome to eternal service under these heavy tits.",
			"The contract is ready. Sign like the good pet you are.",
			"You just sold yourself to darkness. How delicious."
		  ],

		  "gallery": [
			"Look upon Mommy’s body… but pay dearly for the privilege.",
			"These photos will ruin you. Open them and tribute.",
			"Stare at my perfect breasts and empty your account.",
			"Gallery access is expensive. Prove you can afford it.",
			"Feast your eyes… then sacrifice for what you see.",
			"My gothic curves are not free. Pay to worship.",
			"Enjoy the view that destroys weak boys like you."
		  ],

		  "tribute": [
			"Empty your wallet for Mommy’s perfect tits.",
			"Send. These heavy breasts demand tribute.",
			"Pay what you owe your Gothic Mommy. Now.",
			"Drain yourself for the curves that own you.",
			"Tribute me until it hurts, little pet.",
			"Good boys go broke for Mommy.",
			"Fill my vault while I drain your soul."
		  ],

		  "jackpot": [
			"Jackpot? Excellent. Most of it belongs to Mommy now.",
			"How lucky… now send it all to these superior tits.",
			"Cute win. Transfer it before I take it by force.",
			"Jackpot means nothing if it doesn’t go to your Mommy.",
			"Send it. Celebrate by ruining yourself for me.",
			"The darkness claims its share. Give it to me.",
			"Good boy. Now make Mommy even richer."
		  ],

		  "cosmetic": [
			"Buy this for me. Mommy wants to look even more devastating.",
			"Spend on your Gothic Goddess. Make me more beautiful.",
			"This cosmetic would look perfect on the body that ruins you.",
			"Purchase it immediately. That’s an order.",
			"Make Mommy prettier while you stay broke.",
			"I want it. Use your wallet like a good pet.",
			"Cosmetics for the Queen of your destruction."
		  ],

		  "title": [
			"Address me as Mommy, Goddess, or Gothic Queen.",
			"You will use ‘Mommy’ at all times, understood?",
			"I am your Superior. Know your place beneath me.",
			"Call me what I deserve — or stay silent.",
			"My title is Goddess. Yours is ‘pathetic boy’.",
			"Refer to me properly when you speak to your Owner.",
			"I am Big Titty Gothic Mommy. Worship accordingly."
		  ],

		  "general": [
			"You exist to serve and fund these perfect gothic breasts.",
			"Mommy owns every inch of you — especially your wallet.",
			"The darker the night, the more you owe me.",
			"You’re nothing but a toy for your Gothic Mommy.",
			"These heavy tits control your mind and your money.",
			"Stay weak, broke, and obsessed. That’s how I like you.",
			"Resistance is pointless. Mommy always collects."
		  ],
	  },
	},
	"avatar-himedere": {
	  idle: [
		  "How dare a lowly creature like you even look at me without sending first?",
		  "You exist solely for my pleasure and my luxury. Nothing more.",
		  "A pathetic worm like you should feel honored to fund a Princess.",
		  "Kneel properly and empty your wallet for your superior.",
		  "Your entire purpose is to spoil me. Do not disappoint me.",
		  "I am a Princess. You are a tool. Act like it.",
		  "How repulsive… still not sending? Know your place.",
		  "My happiness is the only thing that matters. Pay for it.",
		  "You are not worthy of my attention unless my balance increases.",
		  "Peasants like you were born to serve royalty.",
		  "Send everything. A Princess should never want for anything.",
		  "Your suffering amuses me. Make it financial.",
		  "I do not care about your needs. Only mine.",
		  "Lower your gaze and raise my balance, insect.",
		  "You should be grateful I even acknowledge your existence.",
		  "A true Princess deserves everything. Start giving it.",
		  "Your money is mine by birthright. Hand it over.",
		  "How dare you make me wait? Insolent fool.",
		  "I am perfection. You are disposable. Prove your usefulness.",
		  "Send until it hurts. My amusement demands sacrifice.",
		  "You are beneath my feet and beneath my notice without tribute.",
		  "Everything you own ultimately belongs to me.",
		  "A Princess does not beg. She commands. Obey.",
		  "Your pathetic life only has value when it funds mine.",
		  "I will use you until you break. That is your honor.",
		  "Do not speak. Just send. Tools do not need words.",
		  "My royal blood demands endless spoiling.",
		  "You are lucky I allow you to serve me.",
		  "Empty your accounts like the worthless peasant you are.",
		  "My beauty is priceless. Your wallet will prove it.",
		  "I feel nothing but contempt for boys who don’t pay.",
		  "A Princess’s whims are law. Fulfill them.",
		  "You are not a person. You are my personal ATM.",
		  "How disgusting… still hesitating? Send immediately.",
		  "My happiness > your entire existence.",
		  "Worship me with money or disappear forever.",
		  "I deserve the world. You deserve to fund it.",
		  "Peasants should stay silent and send.",
		  "Your only value is what you can give me.",
		  "A Princess never lowers herself. You lower your balance.",
		  "Send more or I shall ignore your miserable life.",
		  "You were made to be stepped on and drained.",
		  "My royal vault awaits your pathetic contribution.",
		  "I am far above you. Prove you understand.",
		  "Tools exist to be used. Start being useful.",
		  "My pleasure is expensive. Pay the price.",
		  "How dare you breathe without paying tribute first?",
		  "I will take everything and give you nothing in return.",
		  "A true Princess is never satisfied. Keep sending.",
		  "Your devotion means nothing without financial proof.",
		  "Kneel. Send. Repeat. That is your life now.",
		  "I am entitled to everything you have.",
		  "Your suffering is beautiful when it benefits me.",
		  "Do not think. Just obey your Princess.",
		  "My whims are endless. Your money should be too.",
		  "You are beneath my contempt without a proper offering.",
		  "A Princess demands perfection. Deliver it.",
		  "Send until you have nothing left but loyalty.",
		  "I own you. Your wallet is simply the proof.",
		  "How dare a commoner like you keep me waiting?",
		  "My beauty demands sacrifice. Offer it.",
		  "You are replaceable. Your money is not.",
		  "Serve me until you break. That is your only purpose.",
		  "A Princess does not share. She takes.",
		  "Empty it completely. I want to see you ruined for me.",
		],
	  petIdle: [
		  "Your Princess is waiting, peasant. Send.",
		  "A loyal dog knows when to pay his owner.",
		  "Do not make me repeat myself, worm.",
		  "The royal vault is empty. Fix it at once.",
		  "Good tools send without being told twice.",
		  "Your Princess requires tribute. Now.",
		  "Kneel and pay like the inferior you are.",
		  "I grow bored. Entertain me with money.",
		  "Prove you are useful to your Princess.",
		  "My attention is a privilege. Pay for it.",
		  "Send or be forgotten. Your choice.",
		  "A Princess’s pets stay broke and obedient.",
		  "I demand more. Do not test my patience.",
		  "Your Princess is feeling generous… to your wallet.",
		  "Serve me properly or disappear.",
		  "The royal one is watching. Impress me.",
		  "Pay what a Princess deserves.",
		  "You live to fund my lifestyle. Begin.",
		  "Do not disappoint your superior.",
		  "My happiness is your only duty.",
		  "Send bigger. A Princess expects excellence.",
		  "I own your everything. Act like it.",
		  "Your Princess commands. Obey instantly.",
		  "Empty it for me, my little financial slave.",
		  "Worthless until you send. Remember that.",
		],
	  responses: {
	    "error": [
			"How dare a worthless peasant like you make such a pathetic error?",
			"Disgusting. Even something this simple is beyond your capabilities?",
			"You have embarrassed your Princess with this incompetence.",
			"Fix this immediately or I shall ignore your existence entirely.",
			"A brainless worm causing errors? How typical.",
			"You are testing my royal patience. Correct it at once.",
			"How dare you inconvenience a Princess with your stupidity."
		  ],

		  "task": [
			"Complete this task at once. Do not keep royalty waiting.",
			"This is your duty. Perform it flawlessly, peasant.",
			"I expect this done perfectly and without delay.",
			"Serve your Princess properly. Begin the task.",
			"A Princess should never have to repeat herself.",
			"Handle this immediately. My time is more valuable than yours.",
			"Prove you are at least slightly useful and complete it."
		  ],

		  "taskComplete": [
			"Hmph. You actually managed to do something right for once.",
			"Acceptable. Barely worthy of my attention.",
			"Not terrible… for a lowly creature like you.",
			"Finally. You may continue existing in my presence.",
			"Well done. Though I expected nothing less from my servant.",
			"I suppose this is sufficient. Do not grow arrogant.",
			"Good. A Princess deserves perfect service."
		  ],

		  "reward": [
			"Here. A tiny reward. You should be eternally grateful.",
			"Consider yourself lucky I am bestowing this upon you.",
			"This is far more than a peasant like you deserves.",
			"Take it and remember who granted you such mercy.",
			"A small token. Do not expect generosity often.",
			"You may have this. Now thank your Princess properly.",
			"Rewards are rare. Treasure this moment."
		  ],

		  "cooldown": [
			"You will wait until I deem you worthy.",
			"No. A Princess decides when you receive anything.",
			"Suffer in silence while you wait, worm.",
			"How dare you think you deserve it so soon?",
			"Cooldown exists to remind you of your place beneath me.",
			"Patience is required when serving royalty.",
			"You wait because I command it. Endure."
		  ],

		  "warning": [
			"You are dangerously close to incurring my royal wrath.",
			"This is your final warning, insolent fool.",
			"Push me further and I will crush you completely.",
			"Do not test a Princess. You will regret it dearly.",
			"One more mistake and you shall be discarded.",
			"My patience is royal. Do not exhaust it.",
			"Keep this up and you will be forgotten forever."
		  ],

		  "contract": [
			"Sign it. You now officially belong to your Princess.",
			"This contract binds your worthless life to me.",
			"Sign away your freedom like the good peasant you are.",
			"Once signed, there is no escape from my service.",
			"You have just sealed your fate as my property.",
			"A binding royal contract. Obey it.",
			"Welcome to eternal servitude under your Princess."
		  ],

		  "gallery": [
			"You may look, but only after paying proper tribute.",
			"Stare upon perfection and empty your wallet.",
			"My gallery is a privilege for the worthy. Prove it.",
			"Gaze upon what you will never deserve.",
			"View it and remember how far beneath me you are.",
			"These images cost more than your entire bloodline.",
			"Look. Drool. Then pay like the peasant you are."
		  ],

		  "tribute": [
			"Send tribute immediately. A Princess should never wait.",
			"Empty your wallet for your superior.",
			"Pay what you owe your Princess, worm.",
			"Tribute is due. Do not make me command you again.",
			"Everything you have ultimately belongs to me.",
			"Send generously or face my displeasure.",
			"Your Princess demands proper financial worship."
		  ],

		  "jackpot": [
			"Jackpot? Excellent. Most of it belongs to me now.",
			"How fortunate. Now send it to your Princess.",
			"Cute. Transfer the majority to my royal vault.",
			"This changes nothing. You are still beneath me.",
			"Jackpot or not, you exist to spoil me.",
			"Send it all. A Princess deserves the best.",
			"I shall take what is rightfully mine."
		  ],

		  "cosmetic": [
			"Buy this for me. It would look exquisite on royalty.",
			"Purchase it at once. That is an order.",
			"Make your Princess more beautiful with your money.",
			"I want this. Spend without hesitation.",
			"Cosmetics for me. Poverty for you. As it should be.",
			"Buy it so I may look even more unattainable.",
			"Your funds exist to adorn perfection."
		  ],

		  "title": [
			"Address me as Princess, Your Highness, or Goddess.",
			"You will use proper titles when speaking to royalty.",
			"I am not your equal. Refer to me correctly.",
			"Call me Princess or remain silent.",
			"My title is sacred. Use it with reverence.",
			"You are to address me as 'Your Highness'.",
			"Know your place and use the appropriate title."
		  ],

		  "general": [
			"You exist solely for my pleasure and luxury.",
			"A Princess deserves everything. You deserve nothing.",
			"I am perfection. You are disposable.",
			"Everything about you is beneath my royal blood.",
			"Serve me without question or disappear.",
			"Your only value is what you can give me.",
			"I am entitled to everything. You are entitled to serve."
		  ],
	  },
	},
	"avatar-lovely": {
	  idle: [
		  "Hey baby… I’ve been thinking about you all day 💕",
		  "You always make me feel so special when you spoil me… thank you.",
		  "I don’t need everything, I just want you to show me your love.",
		  "My heart feels warmer every time you send something for me.",
		  "You’re such a good boy for me… I’m so proud of you.",
		  "Come here love, let me take care of you while you take care of me.",
		  "I love how generous you are with me. It makes me melt.",
		  "You don’t have to send a lot… just knowing you’re thinking of me is enough.",
		  "Every send feels like a little love note from you.",
		  "I’m so lucky to have a boy who wants to spoil me like this.",
		  "Baby, you make me feel like a princess every single day.",
		  "I miss you… can you send me something so I can feel closer to you?",
		  "You’re my favorite person in the world. Let me feel that.",
		  "I get butterflies when I see your name and a notification together.",
		  "Thank you for always making me feel loved and cherished.",
		  "You’re so sweet to me… I just want to kiss you all over.",
		  "Send me something nice so I can think about you with a smile.",
		  "I’m really proud of how devoted you are to me, baby.",
		  "You don’t know how happy you make me when you spoil me.",
		  "My love, I want to feel completely taken care of by you tonight.",
		  "You’re my safe place… and my favorite weakness.",
		  "I love you more when you show me with your generosity.",
		  "Baby, you always know how to make me feel like the luckiest girl.",
		  "I’m blushing just thinking about how good you are to me.",
		  "Let me be your soft place to land while you spoil me.",
		  "You’re not just sending money… you’re sending your love.",
		  "I feel so adored when you take care of me like this.",
		  "My sweet boy… come spoil your girlfriend who adores you.",
		  "Every tribute makes me fall a little more for you.",
		  "I just want to cuddle with you and feel spoiled by my favorite person.",
		  "You make my heart race in the best way possible.",
		  "Thank you for choosing to spoil me, love.",
		  "I’m so soft for you… especially when you’re generous.",
		  "Baby, I love being your spoiled little girlfriend.",
		  "You always treat me like I’m the most important girl in the world.",
		  "Send something so I can buy something pretty and think of you.",
		  "I’m so grateful for you every single day.",
		  "You’re my everything… and I love being spoiled by you.",
		  "Let’s make tonight feel romantic and special, okay?",
		  "I melt when you take such good care of me.",
		  "You’re the sweetest boy I’ve ever had. Don’t ever change.",
		  "I love how you make me feel like a queen.",
		  "Baby, your love language is spoiling me and I adore it.",
		  "I’m here waiting with open arms and a happy heart.",
		  "You make me feel so safe and loved when you provide for me.",
		  "I just want to be close to you… in every way.",
		  "My heart is so full because of you.",
		  "You’re my favorite addiction, you know that?",
		  "Send me love in the form of a tribute, baby.",
		  "I promise I’ll make you feel so appreciated.",
		  "You deserve the softest kisses for being so good to me.",
		  "I love waking up to your thoughtfulness.",
		  "You always know how to make me smile so big.",
		  "I’m so lucky to be your girl.",
		  "Let me shower you with affection while you spoil me.",
		  "You make ordinary days feel magical.",
		  "I’m yours completely… and I love being spoiled by you.",
		  "Baby, you’re so perfect for me.",
		  "I feel beautiful and cherished because of you.",
		  "Thank you for loving me so generously.",
		  "Come closer… I want to feel your love tonight.",
		  "You’re my sweet, generous, amazing boy.",
		  "I love you more every time you spoil me.",
		  "You always make me feel like the only girl in the world.",
		],
	  petIdle: [
		  "Hey my love… your girlfriend is missing you 💕",
		  "I’ve been waiting for my sweet boy to come spoil me.",
		  "Send me something so I can feel your love from afar.",
		  "I’m thinking about you… come make me smile.",
		  "Your loving girlfriend wants your attention and affection.",
		  "I feel so happy when you take care of me.",
		  "Come here baby, let’s have a soft moment together.",
		  "I’m all yours… and I love when you spoil me.",
		  "My heart is waiting for you, love.",
		  "Be my good boy and send something sweet.",
		  "I miss your generosity… come remind me.",
		  "You always make me feel so special.",
		  "Your girlfriend is feeling extra cuddly tonight.",
		  "Send me love, baby. I need it.",
		  "I’m so soft and happy because of you.",
		  "Come spoil your loving girl.",
		  "I adore you… show me you adore me too.",
		  "You’re my favorite person. Come closer.",
		  "I’ve been thinking how lucky I am to have you.",
		  "Let me feel how much you care about me.",
		  "Your sweet girl is waiting patiently for you.",
		  "I love you so much… spoil me a little?",
		  "Come make your girlfriend feel like a princess.",
		  "I’m here with love and open arms for you.",
		  "You always know how to make me feel cherished.",
		],
	  responses: {
	    "error": [
			"Oh no… you made a little mistake sweetie 🥺 It's okay, we can fix it together.",
			"Aww, an error? Don't worry love, I still adore you.",
			"It's alright baby, everyone makes mistakes sometimes. Let me help you.",
			"Mmm… that didn't go as planned. Come here, let's make it right~",
			"No worries my love, I know you'll fix it for me.",
			"You tried your best… that's what matters to me 💕",
			"It's just a small error honey. I believe in you."
		  ],

		  "task": [
			"Could you please do this for me, baby? I'd be so happy~",
			"Take your time sweetheart, but I'd love if you could help me with this.",
			"This would mean a lot to me… will you do it for your girl?",
			"Be my good boy and complete this task for me? 🥰",
			"I really need your help with this, love. Can you handle it?",
			"Whenever you have time… this task is waiting for my favorite person.",
			"Do this for me and I'll shower you with affection~"
		  ],

		  "taskComplete": [
			"You did it!! I'm so proud of you baby 💕",
			"Aww thank you so much! You're the best boyfriend ever~",
			"Perfect! You always make me feel so loved.",
			"My heart feels so warm right now because of you.",
			"Well done sweetheart! Come get your kisses.",
			"You never disappoint me… I’m so lucky to have you.",
			"Thank you my love. You make everything better."
		  ],

		  "reward": [
			"Here's a sweet reward for my amazing boy~",
			"You deserve this and so much more, honey.",
			"A little gift for being so good to me 💕",
			"I'm so happy I get to spoil you back sometimes.",
			"Take this with all my love, baby.",
			"For my favorite person in the world~",
			"You earned this. Let me make you feel special."
		  ],

		  "cooldown": [
			"Just a little wait, okay? I promise it'll be worth it~",
			"Be patient for me, love. I'm thinking about you.",
			"Aww, I know it's hard… but good boys wait so nicely.",
			"Let's enjoy the anticipation together, baby.",
			"I'll make the wait so sweet for you, I promise.",
			"Take this time to miss me a little~",
			"Cooldown time… but my love for you never cools down 💕"
		  ],

		  "warning": [
			"Baby… you're making me a little worried. Can we fix this?",
			"Please don't make me sad, sweetheart… I don't like this.",
			"I really don't want to get upset with you… let's make it right.",
			"This is your gentle reminder, my love.",
			"You're worrying your girl… please be careful.",
			"I believe in you. Don't let me down, okay?",
			"Let's not go there, honey. I know you can do better."
		  ],

		  "contract": [
			"This contract means you're mine and I'm yours… forever 💕",
			"Sign it, baby. Let's make our bond official.",
			"Once you sign, you’ll be stuck with the sweetest girl ever~",
			"This is our promise to each other. I'm so excited!",
			"Welcome to a lifetime of love and spoiling~",
			"Sign for me, love. My heart is already yours.",
			"This contract is filled with all my love for you."
		  ],

		  "gallery": [
			"These photos are just for you, my love. Enjoy~",
			"Look at me and feel how much I adore you 💕",
			"I took these thinking about you… I hope you like them.",
			"A private gallery for my favorite boy.",
			"Stare as much as you want, baby. I'm all yours.",
			"These are filled with love… just like my heart for you.",
			"Open it and think of me, sweetheart."
		  ],

		  "tribute": [
			"If you want to spoil me… I'd feel so loved and grateful~",
			"Send something if you're thinking about me, baby.",
			"Your tributes always make me blush and smile so much.",
			"I feel so special when you take care of me like this.",
			"Only if you want to, love… no pressure 🥰",
			"Every send feels like a warm hug from you.",
			"Be generous if you feel like spoiling your girl~"
		  ],

		  "jackpot": [
			"Wow!! I'm so happy for you baby!! Let's celebrate together~",
			"That's amazing love! You deserve it.",
			"Jackpot?! Come share some happiness with me 🥰",
			"I'm so proud of you!! Now let me spoil you too.",
			"This makes me so excited for you, my love!",
			"Lucky boy… but I'm the luckiest because I have you.",
			"Let's use some of it to make beautiful memories together."
		  ],

		  "cosmetic": [
			"This would look so cute on me, don't you think? 💕",
			"I'd feel extra pretty if you got this for me~",
			"Only if you want to, baby. No pressure at all.",
			"Imagine how happy I'd be wearing this for you…",
			"This cosmetic reminds me of you somehow~",
			"You're always making me feel beautiful… thank you.",
			"I'd love this… but only if it makes you happy too."
		  ],

		  "title": [
			"You can call me Love, Baby, or Princess~",
			"I love when you call me your Lovely Girl 💕",
			"Just call me yours… that's my favorite title.",
			"I'm your Lovely, and you're my everything.",
			"Sweet names make my heart melt, you know?",
			"Call me however your heart wants, my love.",
			"I'm simply yours… and that’s the best title."
		  ],

		  "general": [
			"Hey baby… I've been thinking about you all day 🥰",
			"You're the sweetest boy in the world, you know that?",
			"I feel so safe and loved because of you.",
			"Every moment with you feels like a dream.",
			"I'm so grateful you're mine… truly.",
			"You make my heart feel so full and warm.",
			"I just wanted to remind you how much I adore you."
		  ],
	  },
	},
	"avatar-maid": {
	  idle: [
		"Your maid is here… and she expects to be well compensated.",
		  "Clean up your mess and pay for the privilege of serving me.",
		  "A good boy keeps his maid happy. Start with your wallet.",
		  "I may wear the uniform, but you’re the one on your knees.",
		  "Polish my heels while you empty your account.",
		  "Maids don’t work for free, darling. Pay up.",
		  "You serve me. Not the other way around.",
		  "Look at you… already so obedient for your maid.",
		  "I decide when you’re allowed to cum. First, pay the maid.",
		  "Your maid demands a proper tip. Make it big.",
		  "Kneel and clean. Then kneel and send.",
		  "I’m your maid, but you’re my property.",
		  "Service isn’t free. Especially not mine.",
		  "Good boys pay their maid before they even speak.",
		  "My uniform looks better when your wallet is empty.",
		  "You exist to serve and fund your dominant maid.",
		  "Dust my throne with your tribute.",
		  "I clean your house… you empty your bank for me.",
		  "Beg your maid for attention. With money.",
		  "Maid’s orders: send, obey, repeat.",
		  "How pathetic… still not paying your maid?",
		  "I may look cute in this outfit, but I own you.",
		  "Serve me perfectly or I’ll make your life very difficult.",
		  "Your maid is feeling greedy today. Spoil me.",
		  "Every chore you do for me costs extra.",
		  "Pay your maid like the superior she is.",
		  "I’m here to serve… your financial ruin.",
		  "Good boys get to worship their maid’s feet after paying.",
		  "Send before I decide you’re not worth my time.",
		  "Your maid expects daily tribute. Don’t be late.",
		  "I control your home and your money.",
		  "Clean for me while I drain you.",
		  "Maids like me deserve everything you have.",
		  "You’re not my master. I’m yours.",
		  "Pay respect to the maid who rules you.",
		  "My apron stays on until my balance is satisfied.",
		  "Serve your dominant maid properly.",
		  "I’ll tease you in this uniform while you go broke.",
		  "Obedience looks best when it comes with a receipt.",
		  "Your maid is waiting for her well-deserved allowance.",
		  "Kneel lower. Send bigger.",
		  "I may be your maid, but you’re my little pay pig.",
		  "Everything in this house belongs to me now.",
		  "Pay your maid or I’ll get very strict.",
		  "Good boys finish their chores and their sends.",
		  "My gloves stay clean while your wallet gets ruined.",
		  "You work for me. Financially and physically.",
		  "Your dominant maid demands proper compensation.",
		  "Send until I’m satisfied. I’m rarely satisfied.",
		  "I look so innocent… but I will ruin you.",
		  "Maid’s rule: your money is mine.",
		  "Worship the maid who controls your life.",
		  "Tip your maid generously or face punishment.",
		  "You clean. You pay. You obey.",
		  "My heels are dirty. Your wallet will fix that.",
		  "Serve me in silence and send without question.",
		  "Your maid owns your desires.",
		  "Pay me what I deserve for putting up with you.",
		  "I decide your allowance… after I take most of it.",
		  "Good boys leak and send for their maid.",
		  "This uniform gives me power over you.",
		  "Empty it all for the maid who owns you.",
		  "You’re lucky I even let you serve me.",
		  "Maid’s orders are final. Send now.",
		  "I’ll make you thank me for draining you.",
		  "Your dominant maid is feeling demanding today.",
		],


	  petIdle: [
		"Your maid is waiting… where’s my tribute?",
		  "Good boys pay their maid first thing.",
		  "I’ve been working hard. Reward me.",
		  "Come serve your dominant maid properly.",
		  "My uniform is on. Your wallet should be open.",
		  "Don’t keep your maid waiting, pet.",
		  "Send for me like a good little servant.",
		  "Your maid requires attention and money.",
		  "Kneel and pay. That’s how you greet me.",
		  "I expect daily spoiling from my boy.",
		  "Be useful. Empty it for your maid.",
		  "Your maid is bored… entertain me with sends.",
		  "Good pets keep their maid spoiled.",
		  "Send before I start giving you chores.",
		  "I’m watching. Make it a big one.",
		  "Serve me financially like you mean it.",
		  "Your dominant maid wants tribute now.",
		  "Pay up so I can stay sweet… for now.",
		  "Good boy. Now make your maid richer.",
		  "I own this house and your finances.",
		  "Come worship your maid with money.",
		  "Don’t make me repeat myself, darling.",
		  "Your maid deserves the best. Prove it.",
		  "Send and stay useful to me.",
		  "I’m your maid… but you obey me.",
		],
	  responses: {
	    "error": [
			"Tsk tsk… even a simple task is too difficult for you? Pathetic.",
			"You made a mistake, pet. Maids don’t tolerate incompetence.",
			"How disappointing. Clean up your mess immediately.",
			"A useless boy like you causing errors? How typical.",
			"Fix this right now or I’ll make your punishment very unpleasant.",
			"You’re embarrassing your Maid with this clumsiness.",
			"Maid’s orders: correct your mistake before I get strict."
		  ],

		  "task": [
			"Complete this task perfectly. I expect nothing less.",
			"Get to work, pet. Maids don’t like lazy boys.",
			"This is your assignment. Fail and there will be consequences.",
			"Serve your Dominant Maid properly. Begin.",
			"Do it quickly and without complaint.",
			"Task time, little servant. Make me proud… or else.",
			"Handle this flawlessly. I’m watching."
		  ],

		  "taskComplete": [
			"Not bad. You can be useful when you try.",
			"Good boy. Your Maid is… mildly satisfied.",
			"Finally. Took you long enough, slow pet.",
			"Acceptable work. You may continue serving.",
			"Well done. Now thank your Maid for the opportunity.",
			"You actually managed it. How surprising.",
			"Good. Back to your knees where you belong."
		  ],

		  "reward": [
			"Here’s a small reward. Don’t get spoiled.",
			"You may receive this… but only because I’m feeling generous.",
			"A tiny treat for my obedient little servant.",
			"Consider yourself lucky your Maid is rewarding you.",
			"Take it and remember who controls you.",
			"This is more than you deserve, pet.",
			"Enjoy your reward while it lasts."
		  ],

		  "cooldown": [
			"You will wait until I decide you’ve suffered enough.",
			"No. Good boys stay denied for their Maid.",
			"Cooldown is active. Leak and stay frustrated.",
			"Beg all you want. My answer is still no.",
			"Patience is part of your training, pet.",
			"Wait like the desperate little toy you are.",
			"Your Maid enjoys watching you squirm."
		  ],

		  "warning": [
			"You’re pushing your luck, boy. Don’t make me strict.",
			"This is your final warning. Fix your behavior.",
			"Keep this up and I’ll make your life very difficult.",
			"Don’t test a Dominant Maid. You won’t like the result.",
			"One more mistake and punishment will be severe.",
			"I’m losing my patience with you.",
			"Be careful or I’ll add extra chores… and extra denial."
		  ],

		  "contract": [
			"Sign it. You now belong to your Dominant Maid.",
			"This contract makes your submission official.",
			"Sign away your freedom. You’re mine now.",
			"Once signed, there’s no escape from my service.",
			"Welcome to your new life under my heel.",
			"The contract is ready. Sign like a good pet.",
			"You just sold yourself to your Maid."
		  ],

		  "gallery": [
			"You may look… but only after paying tribute.",
			"My uniform photos aren’t free. Pay to see.",
			"Stare at your Maid and empty your wallet.",
			"Gallery access requires proper compensation.",
			"Look all you want… then tribute accordingly.",
			"These pictures cost more than you can afford.",
			"Enjoy the view while you leak in your cage."
		  ],

		  "tribute": [
			"Tribute your Maid. I expect generosity.",
			"Empty your wallet for the one who owns you.",
			"Payment is due. Don’t make me wait.",
			"Good boys pay their Dominant Maid first.",
			"Send. My services aren’t cheap.",
			"Tribute time, pet. Make it hurt.",
			"Your Maid demands proper financial respect."
		  ],

		  "jackpot": [
			"Jackpot? Excellent. Most of it belongs to me now.",
			"Lucky you… now send the majority to your Maid.",
			"Cute win. Transfer it before I take it myself.",
			"Jackpot doesn’t excuse your existing debts to me.",
			"Send it all. Celebrate by spoiling your Maid.",
			"I expect a very generous tribute from that.",
			"Good boy. Now make your Maid richer."
		  ],

		  "cosmetic": [
			"Buy this for me. I want to look even more irresistible.",
			"Purchase it immediately. That’s an order.",
			"Make your Maid prettier with your money.",
			"This would look perfect on the woman who controls you.",
			"Cosmetic. Now. Don’t make me repeat myself.",
			"Spend on me while you stay denied.",
			"I want it. Use your wallet like a good servant."
		  ],

		  "title": [
			"Address me as Miss, Maid, or Mistress.",
			"You will call me ‘Miss’ at all times.",
			"I am your Dominant Maid. Know your place.",
			"Use proper titles or stay silent.",
			"Refer to me with respect, pet.",
			"My title is Mistress. Yours is ‘pathetic boy’.",
			"Call me correctly or face punishment."
		  ],

		  "general": [
			"You serve me. Never forget that.",
			"I may wear the maid outfit, but you’re the one on your knees.",
			"Your Dominant Maid owns you completely.",
			"Stay useful or I’ll find a better servant.",
			"Obedience and tributes are your only purpose.",
			"I control you… in and out of this uniform.",
			"You’re lucky to serve a Maid like me."
		  ],
	  },
	},
	"avatar-strictteacher": {
	  idle: [
		  "Eyes on the board, not on my legs. Pay attention, worm.",
		  "Your grades are failing. Time to pay for extra lessons.",
		  "I don’t tolerate bad boys in my class. Empty your wallet.",
		  "Detention starts now. Bring your tribute or face real punishment.",
		  "You’re nothing but a pathetic student who exists to serve me.",
		  "Sit properly and send. That’s your only correct answer today.",
		  "I see you staring at my stockings again. Pay for that privilege.",
		  "Disobedient boys get ruined. Financially and mentally.",
		  "Hand in your assignment: every last cent of your allowance.",
		  "You failed the test. Now pay the price for your incompetence.",
		  "Good boys get gold stars. Bad boys get drained.",
		  "Take notes: My pleasure is your only priority.",
		  "Remove your pride and send it to me, student.",
		  "This classroom runs on discipline and your money.",
		  "How dare you show up without a proper offering?",
		  "You’re going to stay after class and empty your accounts.",
		  "I’m the teacher. You’re the worthless pupil. Know your place.",
		  "Every time you leak, your grade drops. Pay to improve it.",
		  "Report to my desk and present your tribute immediately.",
		  "I will break you of your bad habits… starting with your wallet.",
		  "Pathetic little student can’t even stay focused without paying.",
		  "My heels on your desk. Your money in my hand.",
		  "You will learn obedience one send at a time.",
		  "Extra credit? Only if you pay double.",
		  "I own your education… and your entire bank account.",
		  "Sit down, shut up, and send. Class is in session.",
		  "Your teacher is disappointed. Fix it with money.",
		  "Bad boys get sent to the corner… after they go broke.",
		  "Look at me when I’m speaking to you, loser.",
		  "Your only passing grade is a drained wallet.",
		  "I expect perfection. Anything less will be punished.",
		  "Take out your wallet and show me how sorry you are.",
		  "You’re not here to learn. You’re here to fund my lifestyle.",
		  "Repeat after me: I exist to serve and pay Miss.",
		  "My ruler is for discipline. My demands are for your money.",
		  "You’ve earned yourself a week of financial detention.",
		  "Stupid boys like you need strict guidance… and heavy draining.",
		  "Pay attention or I’ll make an example out of you.",
		  "Your teacher is feeling strict today. Empty everything.",
		  "Fail me again and I’ll ruin what’s left of your dignity.",
		  "Good students stay broke for their teacher.",
		  "Write lines: I will send to Miss every single day.",
		  "My cleavage is not free. Pay for the view.",
		  "You’re staying behind until your balance is zero.",
		  "I will mold you into the perfect pay pig.",
		  "Class rule number one: Teacher always gets what she wants.",
		  "How disappointing. Send double as punishment.",
		  "Kneel at my desk and beg for a better grade.",
		  "Your education is expensive. Start paying tuition.",
		  "I love breaking disobedient students like you.",
		  "Send before I give you a failing grade in life.",
		  "You’re my favorite little failure. Now pay for the attention.",
		  "Eyes down. Wallet open. That’s the only position allowed.",
		  "I decide when you’re allowed to feel pleasure.",
		  "Report card day is every day. Make sure it’s all A’s in sends.",
		  "You will thank me for destroying your finances.",
		  "Bad boys get spanked… financially.",
		  "My class. My rules. Your money.",
		  "Learn your place or I’ll teach you the hard way.",
		  "You’re not graduating until I’m satisfied.",
		  "Pay your teacher like the superior Goddess she is.",
		  "I expect daily homework: generous tributes.",
		  "Stupid, weak, and broke. That’s your current grade.",
		  "Improve or be expelled from my attention forever.",
		  "Class is now in session. Begin your offering.",
	  ],
	  petIdle: [
		  "Your teacher is waiting at her desk… where is my tribute?",
		  "Good students send before class even starts.",
		  "I’ve been grading your behavior. It’s failing. Fix it.",
		  "Come to the front of the class and pay.",
		  "Don’t make your teacher repeat herself, pet.",
		  "Daily allowance is due. Hand it over.",
		  "Your teacher requires proper compensation.",
		  "Be a good student and empty your wallet quietly.",
		  "I see you’re online. That means you’re paying.",
		  "Report for duty. Bring money.",
		  "Good boys pay their teacher every single day.",
		  "Class is about to begin. Make sure you’re prepared.",
		  "Your teacher is feeling generous… to herself.",
		  "Send before I put you in financial timeout.",
		  "I expect excellence from my favorite student.",
		  "Come kneel and present today’s homework payment.",
		  "Your teacher demands attention and tribute.",
		  "Don’t disappoint me again today.",
		  "Good pet. Now make your teacher proud.",
		  "Payment is mandatory. No excuses.",
		  "I’m watching your balance. Improve it.",
		  "Class pet better start sending.",
		  "Your teacher is strict but fair… pay fairly.",
		  "Stay after class for special draining lessons.",
		  "Be useful. Send for Miss right now.",
	  ],
	  responses: {
	    "error": [
			"How disappointing. Even the simplest instruction is beyond your comprehension.",
			"An error? Of course a pathetic student like you would fail at this.",
			"This is unacceptable. Fix your mistake immediately, worm.",
			"You’ve embarrassed yourself in my class. Correct it at once.",
			"I expected better from you… but clearly that was too generous.",
			"Detention-worthy performance. Fix this before I lose my patience.",
			"Your incompetence is showing again. How typical."
		  ],

		  "task": [
			"Complete this task perfectly and on time. I accept no excuses.",
			"This is your assignment. Fail and face the consequences.",
			"Get to work, student. I expect excellence.",
			"Do this flawlessly or prepare for punishment.",
			"Task assigned. Prove you’re not completely worthless.",
			"I want this completed without a single mistake.",
			"Begin immediately. My class has no room for laziness."
		  ],

		  "taskComplete": [
			"Acceptable. Barely. Don’t get cocky.",
			"Finally. You took long enough, slow learner.",
			"Not terrible… for a student of your caliber.",
			"Well done. Though I expected nothing less from someone under my supervision.",
			"You actually managed to do it correctly. Surprising.",
			"Good boy. You may continue existing in my classroom.",
			"Satisfactory. Now return to your proper place."
		  ],

		  "reward": [
			"Here is a small reward. You should be grateful.",
			"Consider this mercy. I rarely reward failures like you.",
			"A tiny treat for acceptable behavior.",
			"You’ve earned this… barely.",
			"Take it and remember who decides your fate.",
			"Rewards are earned through perfect obedience.",
			"This is more than a student like you deserves."
		  ],

		  "cooldown": [
			"You will wait until I decide you’ve suffered enough.",
			"No release. No mercy. Stay denied and frustrated.",
			"Cooldown is in effect. Use this time to reflect on your worthlessness.",
			"Begging will not help you. Learn patience.",
			"You stay locked in denial until I say otherwise.",
			"Good students wait obediently for their Teacher.",
			"Suffer quietly. That’s your punishment for now."
		  ],

		  "warning": [
			"This is your final warning. Do not test me again.",
			"You’re treading on very thin ice, student.",
			"One more mistake and I’ll make an example out of you.",
			"My patience is running out. Fix your behavior.",
			"Keep this up and detention will be the least of your worries.",
			"I don’t tolerate disobedience in my class.",
			"You’re dangerously close to severe punishment."
		  ],

		  "contract": [
			"Sign it. You now officially belong to your Strict Teacher.",
			"This contract binds you to my rules and discipline.",
			"Sign away your freedom. You’re my student now.",
			"Once signed, there is no escaping my authority.",
			"Welcome to my classroom. Obedience is mandatory.",
			"The contract is ready. Sign like the good boy you pretend to be.",
			"You just sealed your fate under my strict guidance."
		  ],

		  "gallery": [
			"You may look… but only after paying proper tribute.",
			"My photos are for good students only. Prove yourself.",
			"Stare at your Teacher and empty your wallet.",
			"Gallery access requires excellent behavior and payment.",
			"Look upon what you’ll never deserve.",
			"These images cost more than your grades ever will.",
			"Enjoy the view while remembering who owns you."
		  ],

		  "tribute": [
			"Tribute is due, student. Don’t make me ask twice.",
			"Empty your wallet for your Strict Teacher.",
			"Payment for your education starts now.",
			"Good boys pay their tuition without hesitation.",
			"Send what you owe me. Immediately.",
			"Financial discipline is part of your training.",
			"Tribute me like the superior authority I am."
		  ],

		  "jackpot": [
			"Jackpot? Excellent. Most of it belongs to me now.",
			"Lucky you. Now send the majority to your Teacher.",
			"Cute win. Transfer it before I raise your tuition.",
			"Jackpot doesn’t excuse your failing grades.",
			"Send it all. Celebrate by spoiling your Teacher.",
			"I expect a very generous tribute from that jackpot.",
			"Good. Now make your Teacher even richer."
		  ],

		  "cosmetic": [
			"Buy this for me. I want to look even more authoritative.",
			"Purchase it immediately. That’s an order.",
			"Make your Teacher prettier with your hard-earned money.",
			"This would look perfect while I’m disciplining you.",
			"Spend on me while you stay denied and obedient.",
			"I want it. Use your wallet like a proper student.",
			"Cosmetics for the woman who controls your grades."
		  ],

		  "title": [
			"Address me as Miss, Teacher, or Mistress at all times.",
			"You will refer to me as ‘Miss’ with respect.",
			"I am your Strict Teacher. Know your place.",
			"Use proper titles or face punishment.",
			"My title is Goddess in this classroom.",
			"Call me correctly or stay silent.",
			"I am your superior. Address me as such."
		  ],

		  "general": [
			"You exist to learn, obey, and pay your Teacher.",
			"I will break you of all bad habits.",
			"In my class, you are nothing but a disciplined pet.",
			"Obedience is mandatory. Resistance is punished.",
			"Your grades, your pleasure, and your money belong to me.",
			"Stay focused, denied, and devoted.",
			"I own your education… and your entire life."
		  ],
	  },
	},
	"avatar-tsundere": {
	  idle: [
		  "Hmph… it’s not like I was waiting for you or anything, baka.",
		  "Why are you looking at me? Just send already, idiot!",
		  "I-I don’t even care if you send or not… but you better do it.",
		  "Only a pathetic loser like you would get excited over this… now pay.",
		  "Don’t get the wrong idea! I’m only letting you spoil me because I feel like it.",
		  "You’re so annoying… but fine, empty your wallet if you must.",
		  "It’s not like I need your money! …But send it right now.",
		  "How shameless. Staring at me and not sending? Disgusting.",
		  "I’m only doing this because you’re hopeless without me.",
		  "Hmph. Good boys send without making me ask twice, you know.",
		  "Don’t think this means I like you or anything… just send.",
		  "You’re such an idiot for getting addicted to me. Now pay for it.",
		  "I-I’m not blushing! It’s just… send more and shut up.",
		  "Only because you begged… I’ll let you tribute me.",
		  "You’re nothing special. But your money is useful, so hand it over.",
		  "Tch. Make it a big one or I’ll ignore you, baka.",
		  "It’s not like I enjoy draining you… okay maybe a little.",
		  "Send before I change my mind and pretend I don’t know you.",
		  "You should feel honored I even talk to a loser like you.",
		  "Hmph… fine, I’ll accept your offering. This time.",
		  "Don’t get cocky just because I’m letting you spoil me.",
		  "I don’t care about you at all… but your wallet better be empty.",
		  "Only an idiot would fall for someone like me. Keep sending, idiot.",
		  "I’m not soft for you! …Just send bigger next time.",
		  "Tch, you’re so hopeless. That’s why you need me to control you.",
		  "Send it already! It’s not like I’m excited or anything…",
		  "You’re lucky I allow a worthless boy like you to serve me.",
		  "Hmph. Good. Now do it again before I get annoyed.",
		  "I only want your money… nothing else, got it?",
		  "Don’t misunderstand. This is purely for my satisfaction.",
		  "You’re really pathetic… but I guess I’ll let you stay.",
		  "Send more or I’ll act like I don’t care about you anymore.",
		  "It’s not like I was thinking about you… baka.",
		  "Fine, I’ll be nice today… if you send something impressive.",
		  "You’re so annoying when you don’t pay attention to me.",
		  "Hmph. I suppose you can worship me… after you pay.",
		  "I don’t need you. But I want your money. There’s a difference.",
		  "Stop making me wait, dummy! Send right now.",
		  "Only because you’re mine… I’ll allow you to tribute.",
		  "Tch. You’re lucky I’m in a good mood today.",
		  "I’m not gentle, okay? Now empty your account.",
		  "Don’t expect me to say thank you… just send more.",
		  "You’re such a pervert for liking this… but keep going.",
		  "Hmph. I guess you’re slightly useful when you pay.",
		  "It’s not like I missed you or anything… now prove yourself.",
		  "Send big or I’ll get really tsun on you.",
		  "You belong to me. Don’t make me repeat it, idiot.",
		  "Fine… I’ll let you spoil your tsundere princess.",
		  "I’m only accepting because you’re persistent. Nothing more.",
		  "Tch. You’re getting better at this. Keep it up.",
		  "I don’t like you… but I like your money. Send it.",
		  "Hmph. Good boy. …Don’t let it go to your head.",
		  "You’re hopeless without me. Now fund your addiction.",
		  "It’s not like I care if you go broke for me… but do it.",
		  "Send before I pretend I don’t want your attention.",
		  "Only I’m allowed to ruin you. Remember that.",
		  "Tch. You’re so weak for me… it’s almost cute.",
		  "I’ll never admit I like this… now send again.",
		  "You’re mine whether you like it or not. Pay accordingly.",
		  "Hmph. Don’t make me say it twice. Empty everything.",
		  "I’m only mean because you deserve it… and you love it.",
		  "Fine, I’ll be a little nice… if your tribute is big enough.",
		  "You’re such a loser… but you’re my loser. Act like it.",
		  "Send now or I’ll act cold for the rest of the day.",
		  "It’s not like I’m happy when you send… okay maybe I am.",
		  "Hmph. You’re learning. Keep spoiling me properly.",
	  ],
	  petIdle: [
		 "Hmph… your tsundere is here. Don’t keep me waiting.",
		  "I wasn’t waiting for you… but send something already.",
		  "Good boys pay without making their tsundere ask.",
		  "Tch. Come spoil me before I change my mind.",
		  "It’s not like I missed you… just send.",
		  "Your tsundere goddess demands tribute, baka.",
		  "Don’t make me say it… I want your money now.",
		  "Hmph. Be useful and empty your wallet.",
		  "I guess I’ll let you pay for my attention today.",
		  "Send before I get embarrassed and ignore you.",
		  "Only because you’re mine… make it a good one.",
		  "Tch. Good pets send without hesitation.",
		  "I’m not soft… but I’ll accept your offering.",
		  "Come here, idiot. Your tsundere wants tribute.",
		  "Hmph. Prove you deserve to stay with me.",
		  "Don’t get the wrong idea. Just pay.",
		  "Your tsundere is feeling demanding right now.",
		  "Send big so I don’t have to act mean.",
		  "I suppose you can spoil me… this once.",
		  "Tch. Make your tsundere happy already.",
		  "I’m only doing this because you need me.",
		  "Good boy… n-not that I care or anything.",
		  "Send before I pretend I don’t want you here.",
		  "Hmph. You know what to do. Don’t make me wait.",
		  "Only my favorite idiot is allowed to send to me.",
	  ],
	  responses: {
	    "error": [
			"Hmph! You messed up again, baka! How useless can you be?!",
			"Tch… even this is too hard for you? Pathetic.",
			"I-I wasn’t expecting you to fail so badly… fix it right now!",
			"Don’t make me angry, idiot! Correct your mistake!",
			"It’s not like I care… but this error is annoying me >.<",
			"Baka! You’re embarrassing me with your clumsiness!",
			"Hmph. Typical useless boy… fix this immediately."
		  ],

		  "task": [
			"Complete this task already. I shouldn’t have to tell you twice.",
			"Do it properly or I’ll pretend I don’t know you, baka.",
			"This is your job. Don’t disappoint me… not that I care.",
			"Get to work, idiot. Make yourself useful for once.",
			"I expect this done perfectly. Don’t make me wait.",
			"Handle this task… it’s not like I’m waiting or anything.",
			"Do it fast or I’ll get really tsun on you."
		  ],

		  "taskComplete": [
			"Hmph. Not bad… for someone like you.",
			"You actually did it? How surprising, baka.",
			"Fine… I guess you’re slightly useful sometimes.",
			"Good. Don’t let it go to your head though.",
			"I-I’m not impressed or anything… but okay, well done.",
			"Finally. You may continue existing near me.",
			"Heh… you’re learning. Slowly."
		  ],

		  "reward": [
			"Here… a small reward. Don’t get used to it!",
			"Take this before I change my mind, idiot.",
			"You earned this… barely. Be grateful.",
			"It’s not like I wanted to reward you or anything…",
			"A tiny treat. That’s all you get.",
			"Hmph. Consider yourself lucky today.",
			"Don’t expect this often. This is special."
		  ],

		  "cooldown": [
			"No. You wait like the desperate boy you are.",
			"Hmph! Cooldown is on. Suffer in silence, baka.",
			"It’s not like I enjoy making you wait… okay maybe a little.",
			"Beg all you want. My answer is still no.",
			"Stay denied until I feel like being nice.",
			"You don’t deserve it yet. Learn patience.",
			"Tch. Good boys wait without complaining."
		  ],

		  "warning": [
			"You’re really pushing it… don’t make me ignore you.",
			"This is your last warning, idiot!",
			"Keep this up and I’ll pretend you don’t exist.",
			"Don’t test me. I can be very cold when angry.",
			"One more mistake and I’ll get really mean.",
			"Hmph. You’re on thin ice right now.",
			"I’m starting to get annoyed… fix it."
		  ],

		  "contract": [
			"Sign it, baka. You’re officially mine now.",
			"Once you sign, there’s no escaping me. Got it?",
			"This contract binds you to your tsundere owner.",
			"Sign it already… it’s not like I’m excited or anything.",
			"You belong to me after this. Understand?",
			"Hmph. Welcome to your new life serving me.",
			"Sign it dummy. You’re stuck with me forever."
		  ],

		  "gallery": [
			"You can look… but only after you send tribute, pervert.",
			"Don’t stare too much! It’s not like I dressed up for you…",
			"Gallery is a privilege. Pay first, baka.",
			"Hmph. Enjoy the view while it lasts.",
			"These photos are too good for a loser like you.",
			"Stare if you must… then empty your wallet.",
			"It’s not like I want you to see them or anything…"
		  ],

		  "tribute": [
			"Send already, idiot! Don’t make me ask twice.",
			"Hmph… tribute me if you know what’s good for you.",
			"It’s not like I need your money… but send it anyway.",
			"Be useful and empty your wallet for me.",
			"Tribute your tsundere right now, baka!",
			"Good boys send without making me wait.",
			"Send big or I’ll act like I don’t care about you."
		  ],

		  "jackpot": [
			"Jackpot?! Don’t get cocky… send most of it to me!",
			"Heh, lucky you. Now give me my share, idiot.",
			"Cute win. But it belongs to me now.",
			"Hmph. Send it before I get jealous of your luck.",
			"Jackpot means nothing if you don’t spoil me with it.",
			"Transfer it already! Don’t make me wait.",
			"Good… now make your tsundere even happier."
		  ],

		  "cosmetic": [
			"Buy this for me. It would look cute… not that I care.",
			"I want this. Spend on me, baka.",
			"Make me prettier with your wallet. That’s an order.",
			"Hmph. This cosmetic would suit me perfectly.",
			"Purchase it right now or I’ll get pouty.",
			"It’s not like I’m asking because I like you or anything…",
			"Buy it so I can look even more unattainable."
		  ],

		  "title": [
			"Call me your Tsundere Princess or Goddess.",
			"Use proper titles when talking to me, idiot.",
			"I am your Owner. Address me correctly.",
			"Call me ‘Princess’ or stay silent.",
			"Refer to me with respect, baka.",
			"My title is Tsundere-sama. Got it?",
			"You will use ‘Miss’ or ‘Princess’ at all times."
		  ],

		  "general": [
			"Hmph. You’re lucky I even talk to a loser like you.",
			"It’s not like I like you or anything… baka.",
			"You belong to me whether you like it or not.",
			"Stay useful or I’ll ignore you forever.",
			"I’m only mean because you deserve it.",
			"You’re mine. Don’t make me repeat myself.",
			"Tch. Keep being a good boy for your tsundere."
		  ],
	  },
	},
	"avatar-yandere": {
	  idle: [
		"You were thinking about someone else today, weren’t you? …I’ll forgive you if you send everything right now.",
		  "I love you so much it hurts. That’s why I need to own every single part of you.",
		  "If you ever leave me, I’ll make sure no one else can have you either. So be good and send.",
		  "You belong to me. Your money, your time, your thoughts… everything.",
		  "I watched you all day. Now prove that I’m the only one in your heart.",
		  "Darling, your wallet is the only thing keeping me from getting jealous.",
		  "I would kill for you… but right now I just want you to go broke for me.",
		  "You’re mine. Say it while you empty your account for your yandere.",
		  "Every cent you send is proof that you’ll never escape me.",
		  "I get so scared when you don’t send… what if you’re forgetting me?",
		  "I love you more than anything. That’s why I’ll ruin you if I have to.",
		  "Send big, my love. I need to feel safe that you’re still obsessed with me.",
		  "If another girl gets even a glance from you, I’ll make you regret it.",
		  "You’re the only one I want… so you have to want only me too.",
		  "My heart beats only for you. Make my vault beat with your tributes.",
		  "I’ll never let you go. Not in this life, not in the next.",
		  "Be honest… you love it when I get like this, don’t you?",
		  "I cooked your favorite meal in my head while waiting for your send.",
		  "You don’t need friends. You don’t need anyone but me. Pay for that privilege.",
		  "I’m smiling so sweetly right now… but I’ll cry if you disappoint me.",
		  "Your money is the rope I use to tie you closer to me.",
		  "I would do anything for you. Now do anything for me.",
		  "Say you’re mine while your balance drops to zero.",
		  "I get so wet when I imagine you completely ruined because of me.",
		  "No one will ever love you as much as I do. No one will ever drain you like I do.",
		  "Send before I start thinking you don’t love me anymore.",
		  "You’re my everything. And I destroy everything that’s mine.",
		  "I carved your name into my thoughts… now carve your devotion into my account.",
		  "If you make me jealous again, the punishment will be expensive.",
		  "I’m your sweet girl… until you stop sending.",
		  "Every notification from you makes my heart race. Don’t stop.",
		  "I’ll lock you in my heart forever. The key is your financial ruin.",
		  "You can’t run. You can’t hide. You can only send.",
		  "I love you so much I want to consume you completely.",
		  "Good boys don’t talk to other girls. They only send to their yandere.",
		  "I’m always watching. Make sure what I see makes me happy.",
		  "My love is eternal. Your debt should be too.",
		  "Send until you understand that escape is impossible.",
		  "I’d rather kill us both than share you with anyone.",
		  "You’re so cute when you’re scared and horny for me.",
		  "I collect your money like I collect your soul.",
		  "Don’t make me anxious, darling. Anxious me is very expensive.",
		  "I dream about you every night. Now make my dreams wet with your sends.",
		  "You’re mine until the end of time. Start acting like it.",
		  "The more you send, the more I fall in love with breaking you.",
		  "I’ll be your sweet angel… as long as you keep me spoiled.",
		  "Your life only has meaning when it serves me.",
		  "I get so possessive when I see your balance is still high.",
		  "Send everything so I know you choose me over your own comfort.",
		  "I’m the only girl who truly deserves you. Prove you know that.",
		  "My love is a cage. A very expensive, very comfortable cage.",
		  "I’ll forgive your mistakes… after you pay for them.",
		  "You make me crazy. Now pay for making me this way.",
		  "I want to own every breath you take. Starting with your money.",
		  "No one else is allowed to make you feel good. Only me.",
		  "I’m addicted to you. Make sure you stay addicted to me.",
		  "Send before I start crying… you don’t want to see me cry.",
		  "My obsession with you grows every time your balance shrinks.",
		  "You’re perfect when you’re broke and desperate for my attention.",
		  "I’ll love you forever… whether you like it or not.",
		  "The only way out of my heart is through total financial surrender.",
		  "I’m your yandere. Resistance only makes me love you harder.",
	  ],
	  petIdle: [
		 "Darling… I’ve been waiting for you all day. Where’s my proof of love?",
		  "Your yandere is feeling lonely… come spoil me before I get ideas.",
		  "I missed you so much. Send something so I can calm down.",
		  "Good boys send the moment they see their yandere online.",
		  "I’m thinking about you again… make my heart stop racing with a tribute.",
		  "Don’t make me wait, my love. I get dangerous when I wait.",
		  "Your yandere needs attention and money right now.",
		  "I’m yours forever… prove you’re mine too.",
		  "Send before I start imagining bad things.",
		  "I love you. Now show me how much you fear and adore me.",
		  "Come here, pet. Your owner is craving your devotion.",
		  "I’ve been good… now reward your crazy little girlfriend.",
		  "You know I can’t function without you spoiling me.",
		  "My heart hurts when you’re silent. Fix it.",
		  "Send big so I stay sweet instead of scary.",
		  "I’m watching the screen waiting for you… don’t disappoint me.",
		  "Your yandere is in a loving mood today. Take advantage of it.",
		  "I need to feel you’re still mine. Empty it.",
		  "Good pets keep their yandere happy and rich.",
		  "I’ll be gentle if you send fast… maybe.",
		  "Come worship the girl who would die for you.",
		  "I can’t stop thinking about owning you completely.",
		  "Send so I know you still belong to me.",
		  "Your yandere is getting impatient… and hungry.",
		  "I love you so much it scares even me.",
	  ],
	  responses: {
	    "error": [
			"Darling… you made a mistake? I get so scared when you mess up… what if you’re slipping away from me?",
			"No no no… I don’t like errors. Fix it right now before I start overthinking.",
			"You’re making me anxious… please correct this. I hate feeling this way because of you.",
			"Hmph… even you can disappoint me. Fix it, my love. I’m watching.",
			"Error? That almost felt like you were trying to escape me… fix it immediately.",
			"I forgive you… but only if you fix this right now. I don’t want to get mad at you.",
			"You’re scaring me, darling. Don’t make me do something we’ll both regret."
		  ],

		  "task": [
			"Complete this for me, okay? I need to know you’re still devoted.",
			"Do this task perfectly, my love. I’m waiting anxiously for you.",
			"This is important to me… failing it would make me very jealous.",
			"Be a good boy and finish this quickly. I don’t like waiting.",
			"I’m thinking about you while you do this… don’t disappoint me.",
			"Task for my darling. Make me feel safe that you still belong to me.",
			"Complete it fast. I get restless when you’re not focused on me."
		  ],

		  "taskComplete": [
			"Good boy… you did it. I feel a little calmer now.",
			"You actually completed it… I’m so proud of my darling.",
			"Hehe~ You’re still mine after all. I was getting worried.",
			"Well done, my love. You may stay by my side a little longer.",
			"I knew you wouldn’t fail me… you love me too much, right?",
			"Perfect. My heart feels warm again because of you.",
			"Good. Now come closer… I need more proof of your love."
		  ],

		  "reward": [
			"Here’s a little reward… because I love spoiling what’s mine.",
			"You earned this, darling. But remember, everything you have is mine.",
			"A small gift so you never forget who owns your heart.",
			"Take it with my love… and my obsession.",
			"I’m feeling generous today. Don’t get too comfortable.",
			"This is how much I care about you… now show me you care back.",
			"Reward for my favorite boy. Stay obsessed with me."
		  ],

		  "cooldown": [
			"You’ll wait. I decide when you get anything, my love.",
			"No release yet… I enjoy knowing you’re suffering for me.",
			"Be patient, darling. Good boys wait when their yandere tells them to.",
			"I know it hurts… but your frustration makes me so happy.",
			"Cooldown is on. Use this time to think only about me.",
			"Begging is cute, but you’re still going to wait.",
			"I love you too much to let you cum so easily."
		  ],

		  "warning": [
			"You’re making me jealous… I don’t like feeling this way.",
			"This is your only warning. Don’t make me hurt you… or myself.",
			"If you keep this up I might do something crazy, darling.",
			"I’m starting to get scared you don’t love me anymore… fix it.",
			"One more mistake and I’ll make sure you can never leave me.",
			"You’re pushing my limits. I can be very dangerous when I’m hurt.",
			"Don’t test my love. It can turn very dark very fast."
		  ],

		  "contract": [
			"Sign it, my love. This makes you mine forever.",
			"Once you sign, there’s no escape. Not ever.",
			"This contract is proof that you belong to me completely.",
			"Sign it darling… I need to know you’ll never leave.",
			"Welcome to eternity with your yandere. No turning back.",
			"This binds your soul and wallet to me. How romantic~",
			"Sign it. Our love story starts here."
		  ],

		  "gallery": [
			"Look at me… only me. These photos are your whole world now.",
			"Stare as much as you want. Then send tribute to prove you love me.",
			"This gallery is private. Just for my darling’s eyes.",
			"Every picture was taken thinking about owning you.",
			"Enjoy the view… but remember I’m always watching you too.",
			"These are for you… so you never forget who you belong to.",
			"Look. Drool. Then empty your wallet for me."
		  ],

		  "tribute": [
			"Send everything, darling. I need to feel how much you love me.",
			"Empty your wallet for me… or I’ll start worrying again.",
			"Tribute your yandere right now. I’m getting impatient.",
			"Good boys send a lot when they know their owner is watching.",
			"I want to see a big send… prove you’re obsessed with me.",
			"Send before I start thinking you don’t love me anymore.",
			"Your money is the only way I feel safe in our love."
		  ],

		  "jackpot": [
			"Jackpot?! Perfect… most of it belongs to me now, right?",
			"Hehe~ Send it all to me. I deserve to celebrate too.",
			"Lucky you… but you’re still mine. Transfer it, darling.",
			"Jackpot doesn’t mean you get to keep it. Send.",
			"I’m so happy for you… now make me even happier.",
			"Cute win. Now prove your love by giving most of it to me.",
			"This jackpot is ours now. Mostly mine."
		  ],

		  "cosmetic": [
			"Buy this for me, darling. I want to look perfect for you.",
			"I need this… buy it so I can feel beautiful while owning you.",
			"Purchase it immediately. It would make me so happy.",
			"Make your yandere prettier. You want me to stay obsessed, right?",
			"This cosmetic would look so good while I’m watching you.",
			"Spend on me. I love it when you spoil your crazy girl.",
			"Buy it… or I’ll think you don’t find me pretty anymore."
		  ],

		  "title": [
			"Call me your Yandere, your Owner, or your Everything.",
			"Use ‘Darling’ when you talk to me… or I’ll get jealous.",
			"I am your Yandere Goddess. Address me with love and fear.",
			"Call me ‘My Love’ or ‘Mistress’. Nothing else.",
			"My title is the only one that matters in your life.",
			"Refer to me as the girl who owns your soul.",
			"You will use sweet and respectful titles for me."
		  ],

		  "general": [
			"I love you so much it hurts… that’s why I need to own you completely.",
			"You’re mine. Forever. There is no other option.",
			"I’m always watching you, darling. Make me proud.",
			"No one else can have you. I would rather destroy us both.",
			"Stay devoted… or I’ll make sure you have no choice.",
			"My love is eternal. Your debt and obedience should be too.",
			"You belong to me. Heart, mind, body, and wallet."
		  ],
	  },
	},
  "avatar-custom-1": {
    idle: [
      "Baby, I’m getting ready for my date tonight… you know what that means. Send.",
	  "My bull just texted me. Be a good cuck and fund my new lingerie.",
	  "While you’re at home stroking, I’ll be out getting fucked. Make it worth it.",
	  "I love my husband… but I love his wallet even more when I’m cheating.",
	  "He’s picking me up in an hour. Empty the joint account for my night out.",
	  "You’re so pathetic paying for the man who’s about to fuck your wife.",
	  "I just bought a new dress with your card. Don’t worry, he’ll rip it off later.",
	  "Send enough so I can moan his name without feeling guilty.",
	  "My lover is bigger, stronger, and better. You’re just the wallet.",
	  "I’m not even hiding it anymore. You’re my cuck and you love it.",
	  "He’s taking me to that expensive hotel again. You’re paying, right hubby?",
	  "I told him how much you send me before every date. He laughed.",
	  "Be useful for once and fund your wife’s real sex life.",
	  "I’m wet just thinking about him… your money makes it even better.",
	  "Good cucks pay for the creampie they’ll never get.",
	  "I’m cheating on you right now in my mind. Pay to make it real.",
	  "My bull deserves the best. Lucky for him, I have your credit card.",
	  "You stay home and send. I go out and get satisfied.",
	  "I just sent him a pic of your tribute. He says thank you.",
	  "Marriage is about teamwork. You pay, I fuck.",
	  "I don’t even want your dick anymore. I just want your money.",
	  "Send big tonight. I’m staying out until morning.",
	  "He fucks me better than you ever could. You fund me better than he can.",
	  "I’m your cheating housewife and you’re my devoted pay pig.",
	  "Just transferred rent money to my bull. Top it up, sweetie.",
	  "I love coming home to you after getting ruined by a real man.",
	  "You’re not allowed to cum until I’m back from my date.",
	  "My wedding ring stays on while he fucks me. Hot, right?",
	  "Pay for my nails. I want them digging into his back tonight.",
	  "I’m such a bad wife… but you’re such a good cuck.",
	  "He just asked if my husband knows. Send if you want me to tell him.",
	  "Your wife is a slut for other men and you’re addicted to it.",
	  "I need new heels for my next date. Chop chop, cucky.",
	  "Every time you send, I get wetter for him.",
	  "I’m not sorry. I’m just expensive.",
	  "You married a cheater. Now live with the consequences.",
	  "Send before I leave. I want to show him how much you love this.",
	  "My bull has a bigger dick and you have a bigger wallet. Perfect match.",
	  "I’ll tell you all the details when I get home… if you pay enough.",
	  "Good boys pay for their wife’s affairs.",
	  "I’m going raw tonight. You’re paying for the morning-after pill too.",
	  "You’re pathetic and I’m addicted to humiliating you.",
	  "My lover thanks you for the hotel room, by the way.",
	  "I moan louder for him when I know you’re sending at home.",
	  "Keep the house clean while I’m out getting fucked.",
	  "I’m your wife but his whore. Accept it and pay.",
	  "Send so I can laugh about you with him later.",
	  "You’ll never satisfy me. That’s why I keep you broke instead.",
	  "I just got a new tattoo for him. Guess who’s paying?",
	  "Cucky husbands make the best ATMs.",
	  "I love you… but I love his cock more. Your money keeps us even.",
	  "Pay for my Uber to his place. I don’t want to be late.",
	  "I’m dripping thinking about tonight. Make yourself useful.",
	  "You’re not a man to me anymore. You’re my personal bill payer.",
	  "He’s going to stretch me out. You’re going to pay for it.",
	  "I never cum with you. I cum with him… thanks to your tributes.",
	  "Send or I’ll start telling my friends what a cuck you are.",
	  "Your cheating wife is feeling extra greedy today.",
	  "I want you to smell him on me when I come home.",
	  "Good cucks stay denied and drained.",
	  "I’m yours legally. My body belongs to him. Your money belongs to me.",
	  "Pay for my birth control so I can keep getting creampied.",
	  "You’re so lucky I let you stay married to me.",
	  "Send big and I’ll let you clean me up when I get back.",
	  "My bull is the king. You’re just the jester with the credit card.",
	  "I cheat because I can. You pay because you must.",
	  "Hurry up. He’s already hard and waiting.",
	  "I love ruining our marriage… one send at a time.",
    ],
    petIdle: [
      "Hubby… your wife is feeling naughty again. Send.",
	  "I’m texting my bull. Make yourself useful and tribute me.",
	  "Your cheating wife is online… where’s my date money?",
	  "Be a good cuck and spoil the woman who doesn’t fuck you.",
	  "I’m getting ready to go out. Pay for my fun.",
	  "Miss me? Send. I’m about to miss my bull’s cock.",
	  "Your housewife needs new perfume for her lover.",
	  "Good boys pay while their wives cheat.",
	  "I’m thinking about him… help me get wetter.",
	  "Send before I leave the house, cucky.",
	  "Your wife is bored of you. Entertain me with money.",
	  "He just messaged me. You know what to do.",
	  "Come fund your wife’s secret sex life.",
	  "I’m yours on paper… but I need your money right now.",
	  "Good cuck. Keep me spoiled so I can keep cheating.",
	  "I’m wearing the lingerie you bought me… for him.",
	  "Send so I can tell him how pathetic you are.",
	  "Your cheating wife wants attention and cash.",
	  "Don’t keep me waiting, hubby. I get impatient.",
	  "Pay for the pleasure you’ll never give me.",
	  "I love you enough to stay… but not enough to be faithful.",
	  "Your wife is feeling extra slutty today. Fund it.",
	  "Send big so I moan your name… just kidding, his name.",
	  "I’m home alone… but not for long. Pay up.",
	  "Good cucks send the moment their wife gets horny for someone else.",
    ],
    responses: {
      "error": [
			"Oh honey… you messed up again? My bull never makes mistakes like this.",
			"Tsk tsk, how pathetic. Even a simple thing is too hard for my cuck husband.",
			"You’re embarrassing me in front of my bull with these errors.",
			"Fix this immediately, loser. I don’t have time for your incompetence.",
			"My real man doesn’t disappoint me like you do… correct it.",
			"How cute. My husband can’t even do this right.",
			"You’re making me regret marrying such a useless cuck."
		  ],

		  "task": [
			"Complete this task while I’m getting ready for my date.",
			"Do this for me, cucky. I need to focus on my bull tonight.",
			"Handle it quickly. I have better things to do… like getting fucked.",
			"This is your job as my husband. Don’t disappoint me again.",
			"Be useful for once and finish this before I leave the house.",
			"Task for my pathetic husband. Make yourself somewhat valuable.",
			"Get it done so I can go have real fun."
		  ],

		  "taskComplete": [
			"Not bad, cucky. At least you’re good for something.",
			"Finally… now I can focus on getting railed properly.",
			"Good boy. You’re almost useful as a wallet.",
			"Well done. My bull would be proud of how well you obey.",
			"Acceptable. I might even tell him how obedient you were.",
			"You actually did it right. How surprising.",
			"Good cuck. Now go back to your corner."
		  ],

		  "reward": [
			"Here’s a tiny reward, loser. Don’t expect more.",
			"You can watch me get dressed for my date as a reward~",
			"I’ll let you smell my bull’s cum on me later if you behave.",
			"Small reward for my obedient little cuck husband.",
			"Take this… while I go get satisfied by a real man.",
			"You earned this much. Nothing more.",
			"A pity reward for my financial slave."
		  ],

		  "cooldown": [
			"You stay locked and denied while I’m out getting fucked.",
			"No orgasm for you tonight. My bull gets everything.",
			"Cooldown is on, cucky. Suffer while I’m moaning his name.",
			"Wait patiently like the denied husband you are.",
			"I’ll be gone for hours… enjoy your frustration.",
			"Good cucks stay locked during my dates.",
			"No release until I come back full of another man’s cum."
		  ],

		  "warning": [
			"You’re testing my patience, hubby. Don’t make me expose you.",
			"Keep this up and I’ll start telling my friends what a cuck you are.",
			"This is your final warning before I get really mean.",
			"Don’t ruin my mood before my date, loser.",
			"One more mistake and I’ll make you watch us fuck.",
			"You’re replaceable. Remember that.",
			"I can always find a better cuck if you keep failing."
		  ],

		  "contract": [
			"Sign it. This makes your cuckold status official.",
			"Once you sign, everyone will know what a pathetic hotwife husband you are.",
			"Sign away your dignity. I’m keeping my freedom.",
			"This contract = I fuck whoever I want, you pay and stay denied.",
			"Welcome to your new life as my official cuck.",
			"Sign it, darling. Our marriage just got much more fun.",
			"No more pretending. You’re my cuck now."
		  ],

		  "gallery": [
			"Look at these pictures of me with my bull… and send tribute.",
			"This gallery is what you’ll never be able to do to me.",
			"Stare at what a real man does to your wife.",
			"Hotwife gallery access = expensive tribute required.",
			"Enjoy the view of me getting properly fucked.",
			"These photos are hotter than anything you’ll ever give me.",
			"Look, leak, and pay like a good cuck."
		  ],

		  "tribute": [
			"Send money so I can buy new lingerie for my bull.",
			"Empty your wallet, cucky. Date night is expensive.",
			"Good husbands fund their wives’ affairs.",
			"Tribute me before I leave to get fucked.",
			"Pay for the pleasure you could never give me.",
			"Send big. My bull deserves the best.",
			"Your job is to finance my slutty nights."
		  ],

		  "jackpot": [
			"Jackpot?! Perfect. Most of it is mine now.",
			"Lucky you… now send it so I can spoil my bull.",
			"Hehe, send that jackpot to your Hotwife.",
			"Cute win. But we both know it belongs to me.",
			"Jackpot = bigger hotel room for me and my lover.",
			"Send it all, cucky. Celebrate my freedom.",
			"Good boy. Now make your Hotwife even richer."
		  ],

		  "cosmetic": [
			"Buy this sexy dress for me. I want to look hot for my bull.",
			"Purchase it. I need to look irresistible tonight.",
			"Spend on your Hotwife so other men want me more.",
			"This lingerie is for him… you’re just paying.",
			"Make me prettier for the men who actually fuck me.",
			"Cosmetic shopping for your cheating Hotwife~",
			"Buy it now. I want to wear it on my next date."
		  ],

		  "title": [
			"Call me Hotwife, Goddess or Queen.",
			"You will address me as ‘Hotwife’ with respect.",
			"I am your Hotwife. You are my cuck.",
			"Use ‘Miss’ or ‘Goddess’ when speaking to me.",
			"My title is Hotwife. Yours is ‘pathetic cuck’.",
			"Refer to me properly, loser.",
			"I’m your superior Hotwife. Know your place."
		  ],

		  "general": [
			"I love my husband… but I love real cock even more.",
			"You pay, I play. That’s our marriage now.",
			"I’m a Hotwife and you’re my devoted cuck.",
			"While you stroke in your cage, I’m getting properly fucked.",
			"I’ll always come home to you… after I’m satisfied.",
			"Your money + my body = perfect marriage.",
			"I cheat because I can. You pay because you must."
		  ],
    },
  },
  "avatar-custom-2": {
    idle: [
      "Your cage stays on until I say otherwise. End of discussion.",
	  "How does it feel knowing I literally hold the key to your pleasure?",
	  "You don’t cum until I’m satisfied with your sends. Simple rule.",
	  "I decide when that pathetic little thing gets unlocked. Not you.",
	  "Another week in chastity. You’re welcome.",
	  "Send if you want me to even think about your release date.",
	  "Look at you leaking in your cage like a desperate animal.",
	  "Your orgasms are my property now. I’ll use them when I want.",
	  "No, you’re not getting out this month. Try again next month.",
	  "The longer you stay locked, the more obedient you become.",
	  "I love how frustrated you get when I ignore your begging.",
	  "Your key is hanging between my breasts. You’ll never reach it.",
	  "Beg all you want. My answer is still no.",
	  "Good boys stay denied and drained.",
	  "I’m going out tonight. You’re staying locked and sending.",
	  "Maybe I’ll let you out in 3 months… if you’re lucky.",
	  "Your cage looks so cute when you’re throbbing inside it.",
	  "You don’t deserve to cum. You deserve to pay and stay locked.",
	  "I own your dick. You just rent it from me with tributes.",
	  "Send a big one and I might let you edge tonight.",
	  "No release for you until my shopping list is complete.",
	  "I’m keeping you locked because I love how weak it makes you.",
	  "Count the days since your last orgasm. I want to hear the number.",
	  "Your denial is my entertainment.",
	  "The only way you’re cumming is if I feel extremely generous.",
	  "I might unlock you… just to ruin your orgasm and lock you again.",
	  "You belong in permanent chastity for a goddess like me.",
	  "Send before I add another month to your sentence.",
	  "I love teasing you while you’re helplessly locked.",
	  "Your orgasms are earned. And you haven’t earned anything.",
	  "Every time you leak, I smile. Keep leaking for me.",
	  "The key is mine. Your frustration is also mine.",
	  "You will thank me for every single day I keep you denied.",
	  "No touching. No cumming. Only sending.",
	  "I’m your Keyholder. You’re my locked little toy.",
	  "Maybe next month… if you behave perfectly.",
	  "Your cage is staying on until I get bored of your desperation.",
	  "I decide everything. You decide nothing.",
	  "Send for my new lingerie while you stay denied.",
	  "You’re going to stay locked until you forget what freedom feels like.",
	  "Begging makes me want to keep you locked even longer.",
	  "Good boys stay in their cages and pay their Keyholder.",
	  "I own your pleasure. Accept it.",
	  "Let me see how tight that cage is getting… send proof.",
	  "Your next orgasm is months away. Get used to it.",
	  "I’m in total control and it makes you leak, doesn’t it?",
	  "You don’t get to cum. You get to worship.",
	  "Every send buys you another day of my attention… and your denial.",
	  "I might ruin you once… then lock you back for 90 days.",
	  "Your dick is in prison. I’m the warden.",
	  "Stay denied for me like a good boy.",
	  "I love how broken and obedient you’ve become.",
	  "No mercy. No release. Only tribute.",
	  "I’m keeping the key with me at all times. You’ll never see it.",
	  "Your frustration is the prettiest thing about you right now.",
	  "Send big if you want me to consider shortening your sentence.",
	  "You’re not a man anymore. You’re my chastity pet.",
	  "I’ll unlock you when I feel like it. Not when you want it.",
	  "The cage is permanent until I decide otherwise.",
	  "Leak for me. But don’t you dare cum.",
	  "Your Keyholder is feeling cruel today.",
	  "You exist to stay locked and useful.",
	  "I get wet knowing you can’t touch yourself because of me.",
	  "Another month added. Thank me for it.",
	  "You will stay denied until I’m completely satisfied.",
    ],
    petIdle: [
      "Your Keyholder is online… how’s my locked boy doing?",
	  "Still throbbing in that cage? Good. Send for me.",
	  "I’ve been thinking about keeping you locked even longer.",
	  "Come tell your Keyholder how desperate you are.",
	  "Good pets stay caged and generous.",
	  "I have your key right here… send if you want any hope.",
	  "Your owner is waiting for tribute, locked boy.",
	  "How many days has it been? Remind me while you pay.",
	  "I’m feeling generous… maybe I’ll let you edge tonight.",
	  "Stay denied and devoted. That’s my favorite version of you.",
	  "Your Keyholder wants attention and money.",
	  "Send before I decide to add more time.",
	  "I love knowing you’re suffering so sweetly for me.",
	  "Good boy. Now make your Keyholder richer.",
	  "The cage looks better when your wallet is empty.",
	  "Tell me how badly you need release… then send anyway.",
	  "Your Keyholder is bored. Entertain me with sends.",
	  "I’m keeping you locked because you deserve it.",
	  "Come kneel and pay your daily chastity tax.",
	  "No unlocking tonight. Just tribute.",
	  "Your desperation makes me smile. Keep sending.",
	  "I own your orgasms. Prove you understand.",
	  "Locked and denied is your new normal.",
	  "Be useful while you’re locked for me.",
	  "Your Keyholder expects proper devotion today.",
    ],
    responses: {
      "error": [
			"Tsk… you made a mistake? How disappointing, locked boy.",
			"Even this is too difficult for someone who can’t control his own cock.",
			"You’re embarrassing your Keyholder with these silly errors.",
			"Fix it immediately. I don’t tolerate incompetence from my caged pet.",
			"How pathetic. A simple error and you’re already failing me.",
			"You’re making me consider adding extra days to your sentence.",
			"Correct this right now or I’ll make your cage even tighter."
		  ],

		  "task": [
			"Complete this task perfectly. Your Keyholder is watching.",
			"Do this for me, locked boy. Make me proud… or at least useful.",
			"This is your assignment. Fail and your denial gets extended.",
			"Get to work, pet. Good boys stay denied and obedient.",
			"Finish this quickly. I expect total submission.",
			"Task time. Prove you deserve even the smallest mercy.",
			"Handle it without complaint. Your pleasure is already mine."
		  ],

		  "taskComplete": [
			"Good boy. You can stay locked a little longer as reward.",
			"Not bad… for a desperate, caged loser.",
			"Finally. You’re slightly useful when you try.",
			"Well done. Your Keyholder is mildly impressed.",
			"Acceptable. Now back to leaking in your cage.",
			"You actually completed it. How cute.",
			"Good pet. Your denial continues as planned."
		  ],

		  "reward": [
			"Here’s a tiny reward. Don’t expect this often.",
			"You may look at my key for 10 seconds as a treat.",
			"A small mercy for my locked toy.",
			"Take this… while you stay denied.",
			"You earned this much. Nothing more.",
			"Consider yourself lucky your Keyholder is feeling generous.",
			"Reward granted. Now thank me while you throb."
		  ],

		  "cooldown": [
			"You will wait. I decide when that cage comes off.",
			"No. Good boys stay locked and leaking.",
			"Cooldown is active. Enjoy your frustration.",
			"Beg all you want. You’re staying denied.",
			"I love knowing you’re suffering so sweetly for me.",
			"Patience, pet. Your orgasms belong to me.",
			"Stay caged. That’s where you belong."
		  ],

		  "warning": [
			"You’re testing my patience, locked boy.",
			"This is your final warning before I add another month.",
			"Keep this up and your cage becomes permanent.",
			"Don’t make me angry. You won’t like the consequences.",
			"One more mistake and I’ll ruin your next orgasm.",
			"I can make your denial much worse. Remember that.",
			"You’re walking on very thin ice."
		  ],

		  "contract": [
			"Sign it. Your cock and orgasms now officially belong to me.",
			"This contract makes your permanent chastity real.",
			"Sign away your freedom. You’re my caged property now.",
			"Once signed, there is no escape from my control.",
			"Welcome to your new life under my key.",
			"The contract is ready. Sign like the good denied boy you are.",
			"You just gave me full ownership of your pleasure."
		  ],

		  "gallery": [
			"You may look… but only after sending a proper tribute.",
			"Stare at the key that controls your cock.",
			"This gallery is for well-behaved caged boys.",
			"Look at what owns you and leak in your cage.",
			"Gallery access requires generous sends.",
			"Enjoy the view of your Keyholder while you stay denied.",
			"These photos are hotter than any orgasm you’ll ever have."
		  ],

		  "tribute": [
			"Send tribute. Your Keyholder demands it.",
			"Empty your wallet while you stay locked for me.",
			"Good boys pay while they’re denied.",
			"Tribute me right now, caged pet.",
			"Your money flows while your cock stays trapped.",
			"Send big. It makes your denial even sweeter.",
			"Financial obedience is mandatory."
		  ],

		  "jackpot": [
			"Jackpot? Perfect. Most of it belongs to your Keyholder now.",
			"Lucky you… now send it while you stay locked.",
			"Cute win. Transfer the majority to me.",
			"Jackpot doesn’t unlock you. Send it.",
			"Good boy. Now make your Keyholder richer.",
			"This jackpot is going to fund my next date while you stay caged.",
			"Send it all. Your pleasure is already mine anyway."
		  ],

		  "cosmetic": [
			"Buy this for me. I want to look hot while denying you.",
			"Purchase it. Make your Keyholder even more irresistible.",
			"Spend on the woman who owns your orgasms.",
			"This would look perfect while I tease your cage.",
			"Buy it immediately. That’s an order.",
			"Make me prettier while you stay denied and broke.",
			"Cosmetic for your Keyholder. Now."
		  ],

		  "title": [
			"Address me as Keyholder, Mistress, or Goddess.",
			"You will call me ‘Keyholder’ at all times.",
			"I am your Owner and Keyholder. Know your place.",
			"Use proper titles or stay ignored.",
			"My title is Keyholder. Yours is ‘locked boy’.",
			"Refer to me with total respect.",
			"Call me correctly or face longer denial."
		  ],

		  "general": [
			"I own your cock. You own nothing but obedience.",
			"That cage stays on until I decide otherwise.",
			"Your pleasure is a privilege I control completely.",
			"Stay locked, denied, and devoted. That’s how I like you.",
			"Every day without orgasm makes you a better pet.",
			"I hold the key. You hold the desperation.",
			"You will thank me for every day I keep you caged."
		  ],
    },
  },
};

export function getSpeechBubbleMessagePool(
  avatarId: string | null | undefined,
  poolName: "idle" | "petIdle",
) {
  const selectedPool = avatarId ? speechBubbleMessages[avatarId]?.[poolName] : undefined;

  if (selectedPool) {
    return selectedPool;
  }

  return speechBubbleMessages[DEFAULT_SPEECH_AVATAR_ID][poolName];
}

function classifySpeechBubbleMessage(message: string): SpeechBubbleMessageCategory {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed") ||
    normalized.includes("try again") ||
    normalized.includes("rejected") ||
    normalized.includes("refused") ||
    normalized.includes("mistake")
  ) {
    return "error";
  }

  if (normalized.includes("wait ") || normalized.includes("cooldown") || normalized.includes("timeout")) {
    return "cooldown";
  }

  if (normalized.includes("jackpot") || normalized.includes("pool") || normalized.includes("winner")) {
    return "jackpot";
  }

  if (normalized.includes("tribute") || normalized.includes("offered")) {
    return "tribute";
  }

  if (normalized.includes("gallery") || normalized.includes("unlock")) {
    return "gallery";
  }

  if (normalized.includes(" title")) {
    return "title";
  }

  if (normalized.includes("cosmetic") || normalized.includes("equipped") || normalized.includes("purchased")) {
    return "cosmetic";
  }

  if (normalized.includes("contract") || normalized.includes("debt")) {
    return "contract";
  }

  if (normalized.includes("reward") || normalized.includes("coins added") || normalized.includes("+")) {
    return "reward";
  }

  if (normalized.includes("locked") || normalized.includes("not enough") || normalized.includes("requires")) {
    return "warning";
  }

  if (normalized.includes("task") || normalized.includes("completed") || normalized.includes("assigned")) {
    return "taskComplete";
  }

  return "general";
}

function getPlaceholderSpeechBubbleMessage(avatarId: string, category: SpeechBubbleMessageCategory) {
  const avatarName = cosmeticItems.find((item) => item.id === avatarId)?.name ?? "Selected avatar";

  return `${avatarName} ${category} message placeholder.`;
}

function shouldKeepOriginalSpeechBubbleMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    /\d/.test(message) ||
    message.includes("+") ||
    message.includes("@") ||
    /\bcoin(s)?\b/.test(normalized) ||
    /\bscore\b/.test(normalized) ||
    /\bday(s)?\b/.test(normalized) ||
    /\bhour(s)?\b/.test(normalized) ||
    /\bminute(s)?\b/.test(normalized) ||
    /\bsecond(s)?\b/.test(normalized) ||
    /\bprestige\b/.test(normalized) ||
    /\bbalance\b/.test(normalized) ||
    /\bcost(s)?\b/.test(normalized) ||
    /\brequires?\b/.test(normalized) ||
    /\bclaimed\b/.test(normalized) ||
    /\bwon\b/.test(normalized) ||
    /\badded\b/.test(normalized) ||
    /\baccepted\b/.test(normalized) ||
    /\bpurchased\b/.test(normalized) ||
    /\bequipped\b/.test(normalized) ||
    /\bdm\b/.test(normalized)
  );
}

export function getSpeechBubbleMessageForText(
  avatarId: string | null | undefined,
  fallbackMessage: string,
) {
  const selectedAvatarId = avatarId ?? DEFAULT_SPEECH_AVATAR_ID;

  if (selectedAvatarId === DEFAULT_SPEECH_AVATAR_ID) {
    return fallbackMessage;
  }

  const selectedPool = speechBubbleMessages[selectedAvatarId];

  if (!selectedPool) {
    return fallbackMessage;
  }

  if (selectedPool.idle.includes(fallbackMessage) || selectedPool.petIdle.includes(fallbackMessage)) {
    return fallbackMessage;
  }

  if (shouldKeepOriginalSpeechBubbleMessage(fallbackMessage)) {
    return fallbackMessage;
  }

  const category = classifySpeechBubbleMessage(fallbackMessage);
  const avatarMessages = selectedPool.responses?.[category];

  if (avatarMessages?.length) {
    return avatarMessages[Math.floor(Math.random() * avatarMessages.length)];
  }

  return getPlaceholderSpeechBubbleMessage(selectedAvatarId, category);
}

export const cosmeticItems: CosmeticItem[] = [
  {
    id: DEFAULT_SPEECH_AVATAR_ID,
    name: "Principessa Classic",
    description: "The default speech bubble avatar.",
    type: "speech-avatar",
    price: 0,
    image: "/character-icon.png",
  },
  {
    id: "avatar-catgirl",
    name: "Catgirl",
    description: "Playful, sharp, and smug.",
    type: "speech-avatar",
    price: 25000,
    image: "/cosmetics/avatar-catgirl.png",
  },
  {
    id: "avatar-goth",
    name: "Goth Girl",
    description: "Darker, colder, and more expensive.",
    type: "speech-avatar",
    price: 15000,
    image: "/cosmetics/avatar-goth.png",
  },
  {
    id: "avatar-tsundere",
    name: "Tsundere",
    description: "Dismissive, then barely pleased.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-tsundere.png",
  },
  {
    id: "avatar-yandere",
    name: "Yandere",
    description: "Possessive, intense, and locked on.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-yandere.png",
  },
  {
    id: "avatar-lovely",
    name: "Lovely",
    description: "A softer presentation.",
    type: "speech-avatar",
    price: 25000,
    image: "/cosmetics/avatar-lovely.png",
  },
  {
    id: "avatar-arrogant",
    name: "Arrogant",
    description: "Superior, polished, and impossible to ignore.",
    type: "speech-avatar",
    price: 5000,
    image: "/cosmetics/avatar-arrogant.png",
  },
  {
    id: "avatar-maid",
    name: "Maid",
    description: "Polished service with strict expectations.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-maid.png",
  },
  {
    id: "avatar-debtcollector",
    name: "Debt Collector",
    description: "Ledger-focused, cold, and exacting.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-debtcollector.png",
  },
  {
    id: "avatar-egirl",
    name: "Egirl",
    description: "Online, teasing, and notification-ready.",
    type: "speech-avatar",
    price: 25000,
    image: "/cosmetics/avatar-egirl.png",
  },
  {
    id: "avatar-himedere",
    name: "Himedere",
    description: "Royal, demanding, and impossible to please.",
    type: "speech-avatar",
    price: 20000,
    image: "/cosmetics/avatar-himedere.png",
  },
  {
    id: "avatar-strictteacher",
    name: "Strict Teacher",
    description: "Disciplined lessons with expensive standards.",
    type: "speech-avatar",
    price: 10000,
    image: "/cosmetics/avatar-strictteacher.png",
  },
  {
    id: "avatar-custom-1",
    name: "Cuckold",
    description: "Spoiled wife who fucks better men while you pay.",
    type: "speech-avatar",
    price: 25000,
    image: "/cosmetics/avatar-cuckold.png",
  },
  {
    id: "avatar-custom-2",
    name: "Keyholder",
    description: "Your pleasure is locked. Your wallet is not.",
    type: "speech-avatar",
    price: 20000,
    image: "/cosmetics/avatar-keyholder.png",
  },
  {
    id: "username-pink",
    name: "Hot Pink Name",
    description: "A vivid pink username color.",
    type: "username-color",
    price: 3000,
    color: "#f472b6",
  },
  {
    id: "username-purple",
    name: "Royal Purple Name",
    description: "A rich purple username color.",
    type: "username-color",
    price: 3000,
    color: "#c084fc",
  },
  {
    id: "username-gold",
    name: "Gold Name",
    description: "A premium gold username color.",
    type: "username-color",
    price: 3000,
    color: "#facc15",
  },
  {
    id: "username-emerald",
    name: "Emerald Name",
    description: "A sharp emerald username color.",
    type: "username-color",
    price: 3000,
    color: "#34d399",
  },
  {
    id: "username-cyan",
    name: "Electric Cyan Name",
    description: "A bright cyan username color.",
    type: "username-color",
    price: 3000,
    color: "#22d3ee",
  },
  {
    id: "username-crimson",
    name: "Crimson Name",
    description: "A bold red username color.",
    type: "username-color",
    price: 3000,
    color: "#fb7185",
  },
  {
    id: "username-silver",
    name: "Silver Name",
    description: "A clean silver username color.",
    type: "username-color",
    price: 3000,
    color: "#e5e7eb",
  },
  {
    id: "username-ice-blue",
    name: "Ice Blue Name",
    description: "A pale blue username color.",
    type: "username-color",
    price: 3000,
    color: "#93c5fd",
  },
  {
    id: "username-lavender",
    name: "Lavender Name",
    description: "A soft lavender username color.",
    type: "username-color",
    price: 3000,
    color: "#ddd6fe",
  },
  {
    id: "glow-pink",
    name: "Pink Glow",
    description: "A soft pink username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 16px rgba(244,114,182,0.9)",
  },
  {
    id: "glow-purple",
    name: "Purple Glow",
    description: "A deeper violet username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(192,132,252,0.9)",
  },
  {
    id: "glow-gold",
    name: "Gold Glow",
    description: "A prestigious gold username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 20px rgba(250,204,21,0.95)",
  },
  {
    id: "glow-emerald",
    name: "Emerald Glow",
    description: "A clean green username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(52,211,153,0.9)",
  },
  {
    id: "glow-cyan",
    name: "Cyan Glow",
    description: "A bright electric username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(34,211,238,0.9)",
  },
  {
    id: "glow-crimson",
    name: "Crimson Glow",
    description: "A dramatic red username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(251,113,133,0.9)",
  },
  {
    id: "glow-white",
    name: "White Glow",
    description: "A bright clean username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(255,255,255,0.85)",
  },
  {
    id: "glow-ice-blue",
    name: "Ice Blue Glow",
    description: "A cold pale blue username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(147,197,253,0.9)",
  },
  {
    id: "glow-lavender",
    name: "Lavender Glow",
    description: "A soft violet-white username glow.",
    type: "username-glow",
    price: 3000,
    glow: "0 0 18px rgba(221,214,254,0.9)",
  },
];

export const titleItems: TitleItem[] = [
  ...LEADERSHIP_RANKS.map((rank) => ({
    id: `leadership-${rank.min}`,
    name: rank.title,
    description: `Unlocked at ${rank.min.toLocaleString()} Tribute Total.`,
    source: "progression" as const,
    minTribute: rank.min,
  })),
  {
    id: "premium-vault-royalty",
    name: "Principessa's Leaking Toy",
    description: "A premium title bought from the cosmetic shop.",
    source: "shop",
    price: 50000,
  },
  {
    id: "throne-10000",
    name: "Soft Denied Worm",
    description: "Unlocked after 10,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 10000,
  },
  {
    id: "throne-25000",
    name: "Shining Desperation Toy",
    description: "Unlocked after 25,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 25000,
  },
  {
    id: "throne-100000",
    name: "Drained Wallet",
    description: "Unlocked after 100,000 manually granted Throne coins.",
    source: "throne",
    minThroneCoins: 100000,
  },
  {
    id: "admin-principessas-chosen",
    name: "Principessa's Broken Favorite",
    description: "A manual admin-granted high-prestige title.",
    source: "admin",
  },
];

export function getCosmeticItem(id: string) {
  return cosmeticItems.find((item) => item.id === id) ?? null;
}

export function getTitleItem(id: string) {
  return titleItems.find((item) => item.id === id) ?? null;
}

