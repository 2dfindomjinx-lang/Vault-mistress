export const IRL_TASK_WHEEL_COST = 1000;
export const IRL_TASK_APPROVAL_AFFECTION_GAIN = 10;

export const irlTaskWheelTasks = [
  "Placeholder Task 01",
  "Placeholder Task 02",
  "Placeholder Task 03",
  "Placeholder Task 04",
  "Placeholder Task 05",
  "Placeholder Task 06",
  "Placeholder Task 07",
  "Placeholder Task 08",
  "Placeholder Task 09",
  "Placeholder Task 10",
];

export const irlTaskWheelSegments = irlTaskWheelTasks.flatMap((task) => [
  task,
  task,
]);

export function getRandomIrlTaskDurationMinutes() {
  return Math.floor(Math.random() * 121) + 60;
}

export function getRandomIrlTaskPenaltyMinutes() {
  return Math.floor(Math.random() * 91) + 30;
}
