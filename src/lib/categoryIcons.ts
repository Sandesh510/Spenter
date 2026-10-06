/**
 * Icons a user can pick for a category. Lucide names, each registered in components/Icon.tsx.
 * Searched by label and keywords, so "fuel" finds the petrol pump.
 */
export interface CategoryIconChoice {
  name: string;
  label: string;
  keywords: string[];
}

export const CATEGORY_ICON_CHOICES: CategoryIconChoice[] = [
  { name: 'utensils', label: 'Restaurant', keywords: ['food', 'dining', 'eat', 'meal', 'lunch', 'dinner'] },
  { name: 'coffee', label: 'Coffee', keywords: ['cafe', 'tea', 'drink', 'snacks'] },
  { name: 'pizza', label: 'Takeaway', keywords: ['pizza', 'delivery', 'swiggy', 'zomato', 'order'] },
  { name: 'shopping-basket', label: 'Groceries', keywords: ['grocery', 'vegetables', 'kirana', 'supermarket', 'basket'] },
  { name: 'shopping-cart', label: 'Shopping', keywords: ['cart', 'online', 'amazon', 'store', 'mall'] },
  { name: 'shopping-bag', label: 'Shopping bag', keywords: ['bag', 'retail', 'purchase'] },
  { name: 'shirt', label: 'Clothes', keywords: ['clothing', 'fashion', 'apparel', 'dress'] },
  { name: 'gift', label: 'Gifts', keywords: ['present', 'birthday', 'wedding', 'celebration'] },
  { name: 'car', label: 'Car', keywords: ['vehicle', 'parking', 'service', 'auto'] },
  { name: 'fuel', label: 'Fuel', keywords: ['petrol', 'diesel', 'gas', 'cng', 'pump'] },
  { name: 'bus', label: 'Bus', keywords: ['transport', 'commute', 'metro', 'transit'] },
  { name: 'train-front', label: 'Train', keywords: ['rail', 'metro', 'railway', 'travel'] },
  { name: 'bike', label: 'Bike', keywords: ['two wheeler', 'scooter', 'cycle', 'ride', 'cab'] },
  { name: 'plane', label: 'Flight', keywords: ['travel', 'trip', 'airline', 'holiday', 'vacation'] },
  { name: 'hotel', label: 'Hotel', keywords: ['stay', 'lodging', 'trip', 'room'] },
  { name: 'house', label: 'Home', keywords: ['rent', 'house', 'housing', 'society', 'maintenance'] },
  { name: 'sofa', label: 'Furniture', keywords: ['furnish', 'home decor', 'sofa', 'interior'] },
  { name: 'zap', label: 'Electricity', keywords: ['power', 'bill', 'utility', 'energy'] },
  { name: 'lightbulb', label: 'Utilities', keywords: ['bill', 'light', 'water', 'gas bill'] },
  { name: 'wifi', label: 'Internet', keywords: ['broadband', 'wifi', 'data', 'bill', 'phone'] },
  { name: 'smartphone', label: 'Mobile', keywords: ['phone', 'recharge', 'prepaid', 'upi', 'paytm'] },
  { name: 'tv', label: 'Streaming', keywords: ['tv', 'netflix', 'subscription', 'ott', 'cable'] },
  { name: 'gamepad-2', label: 'Games', keywords: ['gaming', 'play', 'fun', 'entertainment'] },
  { name: 'film', label: 'Movies', keywords: ['cinema', 'movie', 'show', 'theatre', 'ticket'] },
  { name: 'music', label: 'Music', keywords: ['song', 'concert', 'spotify', 'audio'] },
  { name: 'ticket', label: 'Events', keywords: ['event', 'ticket', 'show', 'party'] },
  { name: 'party-popper', label: 'Party', keywords: ['party', 'celebration', 'drinks', 'outing'] },
  { name: 'beer', label: 'Drinks', keywords: ['alcohol', 'bar', 'wine', 'party'] },
  { name: 'heart', label: 'Health', keywords: ['health', 'wellness', 'care', 'medical'] },
  { name: 'pill', label: 'Medicine', keywords: ['pharmacy', 'medicine', 'medical', 'chemist', 'tablets'] },
  { name: 'stethoscope', label: 'Doctor', keywords: ['doctor', 'clinic', 'hospital', 'medical', 'checkup'] },
  { name: 'dumbbell', label: 'Fitness', keywords: ['gym', 'sport', 'workout', 'exercise', 'yoga'] },
  { name: 'shield', label: 'Insurance', keywords: ['policy', 'premium', 'cover', 'protection'] },
  { name: 'umbrella', label: 'Cover', keywords: ['insurance', 'protection', 'safety'] },
  { name: 'receipt', label: 'Bills', keywords: ['bill', 'invoice', 'payment', 'receipt'] },
  { name: 'credit-card', label: 'Card', keywords: ['card', 'credit card', 'cc bill', 'emi'] },
  { name: 'landmark', label: 'EMI / loan', keywords: ['emi', 'loan', 'bank', 'interest', 'mortgage'] },
  { name: 'wallet', label: 'Cash', keywords: ['cash', 'atm', 'wallet', 'withdrawal'] },
  { name: 'banknote', label: 'Cash out', keywords: ['money', 'atm', 'cash', 'rupee'] },
  { name: 'trending-up', label: 'Investment', keywords: ['sip', 'stocks', 'mutual fund', 'invest', 'shares'] },
  { name: 'piggy-bank', label: 'Savings', keywords: ['save', 'savings', 'fund', 'emergency'] },
  { name: 'graduation-cap', label: 'Education', keywords: ['school', 'college', 'course', 'fees', 'books'] },
  { name: 'book-open', label: 'Books', keywords: ['study', 'read', 'books', 'library', 'course'] },
  { name: 'baby', label: 'Kids', keywords: ['child', 'kids', 'school', 'toys', 'baby'] },
  { name: 'dog', label: 'Pets', keywords: ['pet', 'dog', 'cat', 'vet'] },
  { name: 'scissors', label: 'Salon', keywords: ['haircut', 'salon', 'barber', 'beauty', 'spa'] },
  { name: 'sparkles', label: 'Beauty', keywords: ['cosmetics', 'skincare', 'beauty', 'personal care'] },
  { name: 'wrench', label: 'Repairs', keywords: ['repair', 'service', 'fix', 'maintenance', 'plumber'] },
  { name: 'briefcase', label: 'Work', keywords: ['office', 'business', 'work', 'professional'] },
  { name: 'plug', label: 'Appliances', keywords: ['electronics', 'appliance', 'charger', 'gadget'] },
  { name: 'laptop', label: 'Gadgets', keywords: ['laptop', 'computer', 'electronics', 'device'] },
  { name: 'tag', label: 'Other', keywords: ['misc', 'miscellaneous', 'general', 'other'] },
  { name: 'shapes', label: 'Misc', keywords: ['other', 'misc', 'general'] },
];

export const DEFAULT_CATEGORY_ICON = 'tag';

/** Filters the picker by label, icon name and keywords. An empty query returns everything. */
export function searchCategoryIcons(query: string): CategoryIconChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATEGORY_ICON_CHOICES;
  return CATEGORY_ICON_CHOICES.filter(c =>
    c.label.toLowerCase().includes(q) || c.name.includes(q) || c.keywords.some(k => k.includes(q)),
  );
}
