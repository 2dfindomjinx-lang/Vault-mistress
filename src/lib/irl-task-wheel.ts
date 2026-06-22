import { getGmt3DateKey } from "@/lib/time";

export const IRL_TASK_WHEEL_COST = 2000;
export const IRL_TASK_APPROVAL_AFFECTION_GAIN = 10;
export const IRL_FREE_FRIDAY_MARKER_REASON = "free_task_friday:irl-task-wheel";

export const irlTaskWheelTasks = [
  {
    title: "Rebrand Yourself for Principessa",
    description: "DM @VMPrincipessa and get your materials. Become a board for Principessa.",
  },
  {
    title: "Property Marking",
    description: "Write “Property of Principessa” visibly on your body (chest, thigh, or stomach). Add today’s date. Send clear timestamped proof.",
  },
  {
    title: "Kneeling Begging Video",
    description: "Get on your knees, put your hands behind your back, and record a video begging: “I’m a worthless paypig for Principessa.”.",
  },
  {
    title: "Send 5$ on Throne",
    description: "Send $5 tribute on Throne right now. After sending, write “Thank you for taking my money, Principessa” and send proof.",
  },
  {
    title: "Self Degradation",
    description: "Record a video while crushing your balls/genitalia 5 times with a fist",
  },
  {
    title: "Crossdress",
    description: "Wear female underwear or lingerie. If impossible, send $5 on Throne instead.",
  },
  {
    title: "Name Calling",
    description: "Write “Loser” or “Paypig” on your hand with a pen. Take a clear photo and send it with today’s date.",
  },
  {
    title: "Sock Task",
    description: "Kiss your own sock or shoe and say “I am below Principessa’s feet.” Record a 10-second video.",
  },
  {
    title: "Countdown",
    description: "Count backwards from 50 to 1 while kneeling. Send the voice recording.",
  },
  {
    title: "Send 10$ on Throne",
    description: "Send $10 tribute on Throne immediately. No excuses. Send proof afterwards.",
  },
  {
    title: "Ownership Affirmation",
    description: "Write and send a short paragraph (3-5 sentences) explaining why your finances and obedience belong to Principessa. Include today’s date and your username.",
  },
  {
    title: "Edge & Deny Report",
    description: "Edge yourself for a minimum of 10 minutes without orgasm, then send a detailed report of how desperate you felt and who controls your pleasure.",
  },
  {
    title: "Loyalty Caption",
    description: "Create an original short caption (1-2 sentences) showing your devotion to Principessa and send it as a message with a timestamp.",
  },
  {
    title: "Humiliation Confession",
    description: "Write a short confession about why you’re addicted to being drained and controlled by Principessa.",
  },
  {
    title: "Coin Loss",
    description: "DM @VMPrincipessa and beg her for drain your coins.",
  },
  {
    title: "Ballbusting Goon",
    description: "Goon to ballbusting videos only. Watch it on X and repost at least 2 of them. You can delete it after approval.",
  },
  {
    title: "Porn Denial Loop",
    description: "Go to a porn site and open 4 different videos. Edge to each one for exactly 3 minutes without cumming. Send a report of which video made you feel the weakest.",
  },
  {
    title: "Send 1$ on Throne",
    description: "Send 1$ tribute on Throne immediately. No excuses. Send proof afterwards.",
  },
  {
    title: "Intentional Fail",
    description: "Intentionally fail at least 4 tasks.",
  },
  {
    title: "Repost Task",
    description: "Visit @VMPrincipessa on X and repost at least 5 posts.",
  },
];

export const irlTaskWheelSegments = irlTaskWheelTasks;

export const freeFridayIrlTaskWheelSegments = [
  {
    title: "Self Degradation",
    description: "Record a video while crushing your balls/genitalia 5 times with a fist",
  },
  {
    title: "Property Marking",
    description: "Write 'Property of Principessa' visibly on your body (chest, thigh, or stomach). Add today’s date. Send clear timestamped proof.",
  },
  {
    title: "Kneeling Begging Video",
    description: "Get on your knees, put your hands behind your back, and record a video begging: I'm a worthless paypig for Principessa.",
  },
  {
    title: "Self Degradation",
    description: "Record a video while crushing your balls/genitalia 5 times with a fist",
  },
  {
    title: "Sock Task",
    description: "Kiss your own sock or shoe and say “I am below Principessa’s feet.” Record a 10-second video.",
  },
  {
    title: "Name Calling",
    description: "Write “Loser” or “Paypig” on your hand with a pen. Take a clear photo and send it with today’s date.",
  },
  {
    title: "Sock Task",
    description: "Kiss your own sock or shoe and say â€œI am below Principessaâ€™s feet.â€ Record a 10-second video.",
  },
  {
    title: "Ballbusting Goon",
    description: "Goon to ballbusting videos only. Watch it on X and repost at least 2 of them. You can delete it after approval.",
  },
  {
    title: "Porn Denial Loop",
    description: "Go to a porn site and open 4 different videos. Edge to each one for exactly 3 minutes without cumming. Send a report of which video made you feel the weakest.",
  },
  {
    title: "Ball Slaps",
    description: "Slap your balls 20 times (not too hard) and send a short video of you doing it while saying “Thank you Principessa”.",
  },
  {
    title: "Ice Play",
    description: "Hold an ice cube on your balls for 60 seconds and send a video of your reaction.",
  },
  {
    title: "Nipple Torture",
    description: "Pinch and twist your nipples for 2 minutes straight. Send a short video showing it.",
  },
  {
    title: "Denial Task",
    description: "Stroke your cock for 15 minutes but stop every time you get close. Send a video of the final minute of the session.",
  },
  {
    title: "Toy Tease",
    description: "If you have a dildo/plug: suck it for 2 minutes and send video. (No toy? Use your finger and tell me.)",
  },
  {
    title: "Clothed Quick Shower",
    description: "Take a 20-second shower with all your clothes on (t-shirt, pants, underwear). Send me clear photos of your fully wet clothes from front and back.",
  },
  {
    title: "Pet Play Crawl",
    description: "Crawl on all fours around your room for 1 minute and barking. Send video.",
  },
] as const;

export function getIrlTaskWheelSegments(isFreeFridayEvent = false) {
  return isFreeFridayEvent ? freeFridayIrlTaskWheelSegments : irlTaskWheelSegments;
}

export function isFreeTaskFriday(date: Date | number | string = new Date()) {
  const gmt3Date = new Date(`${getGmt3DateKey(date)}T00:00:00.000Z`);

  return gmt3Date.getUTCDay() === 5;
}

export function getFreeTaskFridayKey(date: Date | number | string = new Date()) {
  return getGmt3DateKey(date);
}

export function getRandomIrlTaskDurationMinutes() {
  return 24 * 60;
}

export function getRandomIrlTaskPenaltyMinutes() {
  return Math.floor(Math.random() * 91) + 30;
}
