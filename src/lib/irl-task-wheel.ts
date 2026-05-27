export const IRL_TASK_WHEEL_COST = 1000;
export const IRL_TASK_APPROVAL_AFFECTION_GAIN = 10;

export const irlTaskWheelTasks = [
  {
    title: "Rebrand Yourself for Principessa",
    description: "DM @Principessa2dfd and get your materials. Become a board for Principessa.",
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
];

export const irlTaskWheelSegments = irlTaskWheelTasks.flatMap((task) => [
  task,
  task,
]);

export function getRandomIrlTaskDurationMinutes() {
  return 24 * 60;
}

export function getRandomIrlTaskPenaltyMinutes() {
  return Math.floor(Math.random() * 91) + 30;
}
