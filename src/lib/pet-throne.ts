export const PET_THRONE_TASK_ID = "pet-throne-tribute";

export const PET_THRONE_AMOUNTS = [1, 5, 10, 15, 25, 50, 75, 100, 250, 500] as const;

export const PET_THRONE_URL =
  process.env.NEXT_PUBLIC_PET_THRONE_URL?.trim() || "https://throne.com/principessa2dfd";

export function getPetThroneReceiveAmount(amount: number) {
  return Math.round(amount * 125) / 100;
}

export function formatPetThroneAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
