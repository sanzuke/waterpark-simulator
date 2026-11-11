/** Prices, food and energy numbers. Tweak here; nothing else hardcodes them. */
export const START_COINS = 150;
export const TICKET_PRICE = 50;

export const ENERGY = {
  max: 100,
  swimPerMin: 3,
  floatPerMin: 0.5,
  lazyPerMin: 1,
  runPerMin: 2,
  slideCost: 5,
  restPerMin: 6,
  tiers: [
    { min: 70, name: "Full of energy", speed: 1, tip: "" },
    { min: 40, name: "Getting tired", speed: 0.95, tip: "A little tired? A snack or a rest would feel great!" },
    { min: 20, name: "Needs rest", speed: 0.88, tip: "Time for a break! Try the food court or a lounger." },
    { min: 0, name: "Very tired", speed: 0.78, tip: "So sleepy... sit on a lounger or grab a juice!" },
  ],
};

export type FoodId = "burger" | "pizza" | "fries" | "icecream" | "juice" | "water";
export interface Food { id: FoodId; name: string; icon: string; price: number; energy: number; seconds: number; drink: boolean; desc: string }

export const FOODS: Record<FoodId, Food> = {
  burger: { id: "burger", name: "Burger", icon: "🍔", price: 20, energy: 25, seconds: 4.5, drink: false, desc: "Big and juicy" },
  pizza: { id: "pizza", name: "Pizza", icon: "🍕", price: 25, energy: 30, seconds: 5, drink: false, desc: "Cheesy slice" },
  fries: { id: "fries", name: "French Fries", icon: "🍟", price: 12, energy: 15, seconds: 3.5, drink: false, desc: "Crispy and golden" },
  icecream: { id: "icecream", name: "Ice Cream", icon: "🍦", price: 10, energy: 10, seconds: 3.5, drink: false, desc: "Cool and sweet" },
  juice: { id: "juice", name: "Orange Juice", icon: "🍊", price: 8, energy: 15, seconds: 3, drink: true, desc: "Fresh and fruity" },
  water: { id: "water", name: "Mineral Water", icon: "💧", price: 5, energy: 10, seconds: 2.5, drink: true, desc: "Cold and clear" },
};

export interface ShopDef { id: string; name: string; icon: string; menu: FoodId[] }
export const SHOPS: ShopDef[] = [
  { id: "burgers", name: "Burger Shop", icon: "🍔", menu: ["burger"] },
  { id: "pizza", name: "Pizza Shop", icon: "🍕", menu: ["pizza"] },
  { id: "snacks", name: "Snack Shop", icon: "🍟", menu: ["fries"] },
  { id: "icecream", name: "Ice Cream Shop", icon: "🍦", menu: ["icecream"] },
  { id: "juice", name: "Juice Bar", icon: "🍊", menu: ["juice", "water"] },
];
