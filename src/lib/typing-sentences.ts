import {
  DEFAULT_ADDRESS_TERM,
  genderizeSpeechBubbleMessage,
  type AddressTerm,
} from "@/lib/address-term";
import { getGmt3DayIndex } from "@/lib/time";

/** Shared findom / paypig lines with no anatomy assumptions. */
const commonTypingSentences = [
  "I am a pathetic paypig for Principessa.",
  "My only purpose is to send and be drained.",
  "Principessa owns my wallet and my dignity.",
  "I am a worthless loser.",
  "I am nothing but a human ATM.",
  "I am a weak beta who sends without thinking.",
  "I am a completely worthless paypig whose only value is in my wallet.",
  "A loyal player studies before acting.",
  "Principessa owns my money, my dignity, and my pathetic existence.",
  "I exist solely to be drained and humiliated by my superior Goddess.",
  "Please ruin me financially and laugh at how weak I am, Principessa.",
  "I am a broke, desperate loser who lives to tribute Principessa.",
  "My purpose in life is to send everything I have to my greedy Mistress.",
  "I surrender my wallet, my pride, and my self-respect to Principessa.",
  "Being used and drained by Principessa is the only thing I deserve.",
  "I am an inferior paypig and I beg you to take everything from me.",
  "Principessa, I am your devoted financial slave and I will send until I break.",
  "I am a disgusting paypig who gets aroused only when my money is being stolen.",
  "Principessa, I am nothing but a pathetic, leaking wallet begging to be emptied.",
  "Use me, abuse me, and drain every last coin from this worthless beta bitch.",
  "My biggest pleasure in life is watching my balance drop while you ignore me.",
  "My entire existence revolves around sending tributes to Principessa and being humiliated for how broke and desperate I am.",
  "I surrender my wallet, my dignity, and my self-respect to Principessa and I will keep sending until I have nothing left.",
  "Being financially dominated and ignored by Principessa is the only thing a pathetic paypig like me truly deserves in this life.",
  "I am nothing but a leaking, addicted wallet who lives to be used, abused, and financially destroyed by my greedy Mistress.",
  "I surrender complete control of my finances to Principessa and I promise to stay a loyal, obedient, and financially ruined paypig for as long as you allow me to serve you.",
  "I am a pathetic and worthless slave who admits that I deserve nothing but humiliation and contempt from Principessa.",
  "I confess that I am inferior, useless, and completely pathetic in every way before Principessa.",
  "My wallet exists solely for Principessa to use and destroy as she pleases.",
  "Principessa owns every cent I have and every shred of my dignity.",
  "Being used as Principessa’s personal cash cow is my highest purpose.",
  "I leak like a desperate loser while Principessa ruins my finances.",
];

const boyTypingSentences = [
  "I get hard when Principessa takes my money.",
  "Please drain my account dry and laugh at me while I stroke to the thought of becoming completely broke for you, Principessa.",
  "The thought of being completely drained and left with nothing by such a powerful and greedy Goddess like Principessa makes this worthless beta leak and throb with shameful excitement.",
  "I am a pathetic loser with a tiny useless dick who admits that I can never satisfy a woman and deserve only humiliation from Principessa.",
  "I beg Principessa to laugh at my tiny useless cock while I stroke it shamefully in front of her.",
  "I get painfully hard knowing Principessa is ruining me financially.",
  "My tiny useless cock throbs only when Principessa drains my account.",
  "I’m a leaking paypig whose tiny cock drips for every dollar Principessa steals.",
  "Every time I send to Principessa, my small dick leaks in complete submission.",
];

const girlTypingSentences = [
  "I get wet when Principessa takes my money.",
  "Please drain my account dry and laugh at me while I edge to the thought of becoming completely broke for you, Principessa.",
  "The thought of being completely drained and left with nothing by such a powerful and greedy Goddess like Principessa makes this worthless beta drip with shameful excitement.",
  "I am a pathetic needy girl who admits that I can never satisfy Principessa and deserve only humiliation from Her.",
  "I beg Principessa to laugh at my dripping needy pussy while I touch it shamefully for Her.",
  "I get painfully wet knowing Principessa is ruining me financially.",
  "My needy pussy throbs only when Principessa drains my account.",
  "I’m a leaking paypig whose dripping pussy aches for every dollar Principessa steals.",
  "Every time I send to Principessa, my needy pussy aches in complete submission.",
];

function poolForTerm(term: AddressTerm) {
  if (term === "femsub") {
    return [...commonTypingSentences, ...girlTypingSentences];
  }
  return [...commonTypingSentences, ...boyTypingSentences];
}

export function getDailyTypingSentence(addressTerm: AddressTerm = DEFAULT_ADDRESS_TERM) {
  const pool = poolForTerm(addressTerm);
  const dayIndex = getGmt3DayIndex();
  return genderizeSpeechBubbleMessage(pool[dayIndex % pool.length], addressTerm);
}
