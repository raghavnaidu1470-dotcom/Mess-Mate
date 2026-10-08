import type { Item } from './portal-domain';
// USDA FoodData Central SR Legacy, verified 2026-09-15. Values are per 100 g,
// not measurements of this caterer's portion or recipe. Do not fuzzy-match mixed dishes.
const reference:Record<string,{id:number;calories:number;protein:number;carbs:number;fat:number}>={
 'white rice':{id:168930,calories:130,protein:2.38,carbs:28.6,fat:.21},
 'boiled egg':{id:173424,calories:155,protein:12.6,carbs:1.12,fat:10.6},
 'milk':{id:171265,calories:61,protein:3.15,carbs:4.8,fat:3.25},
};
export function withNutrition(item:Item):Item{
 if(item.nutrition)return item;
 const data=reference[item.name.trim().toLowerCase()];if(!data)return item;
 const {id,...nutrition}=data;
 return {...item,portion:'100 g · generic USDA estimate',nutrition:{...nutrition,source:`https://fdc.nal.usda.gov/food-details/${id}/nutrients`}};
}
