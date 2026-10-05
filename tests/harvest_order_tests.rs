use aniimax::data::{load_all_data, parse_season, season_raw_ingredients};
use aniimax::exact::{check_plan, net_rates, solve_exact, to_production_plan, Goal};
use aniimax::models::{FacilityCounts, ModuleLevels, ProductionItem};
use std::path::Path;
use std::time::Duration;

const RAW: [&str; 6] = ["apple", "fresh_water", "moondew_radish", "sea_salt", "sugarcane", "waxing_moon_pepper"];

fn raw(name: &str, facility: &str) -> ProductionItem {
    ProductionItem {
        name: name.into(), facility: facility.into(), raw_materials: None, required_amount: None,
        cost: None, sell_currency: "coins".into(), sell_value: 100.0, production_time: 100.0,
        yield_amount: 8, energy: None, facility_level: 1, module_requirement: None, workload: None,
        byproduct: None, environment: None, season: None, crew: None,
    }
}

fn fixture(extra: u32) -> (Vec<ProductionItem>, FacilityCounts) {
    let items = vec![raw("apple", "Woodland"), raw("fresh_water", "Well"),
        raw("moondew_radish", "Farmland"), raw("sea_salt", "Tidewhisper Sandcastle"),
        raw("sugarcane", "Farmland"), raw("waxing_moon_pepper", "Farmland")];
    let mut counts = FacilityCounts::only(&[("Farmland", 3 + extra, 1), ("Woodland", 1, 1),
        ("Well", 1, 1), ("Tidewhisper Sandcastle", 1, 1), ("Blazing Stove", 1, 1)]);
    counts.set_season_limits(None, 0).set_harvest_order_items(RAW.iter().map(|name| (*name).into()).collect());
    (items, counts)
}

fn solve(items: &[ProductionItem], counts: &FacilityCounts) -> aniimax::exact::ExactPlan {
    let plan = solve_exact(items, "coins", counts, &ModuleLevels::default(), Goal::Earn { floors: &[] },
        Some(Duration::from_secs(10)), None).expect("raw stock plan");
    check_plan(&plan, items, "coins", counts, &ModuleLevels::default(), None).expect("independent check");
    plan
}

#[test]
fn screenshots_confirm_recipe_dependencies_and_workloads() {
    let mut items = load_all_data(Path::new("data")).unwrap();
    items.extend(parse_season(include_str!("../data/harvest_moon_festival.csv")).unwrap());
    assert_eq!(season_raw_ingredients(&items).unwrap(), RAW);
    // All eight screenshots supplied on 2026-10-05; use denominators, not current inventory.
    let observed = [
        ("umbral_pickle", "Pickling Jar", 1, 203.0, vec!["moondew_radish", "waxing_moon_pepper", "cider_vinegar"], vec![8, 8, 1]),
        ("cider_vinegar", "Pickling Jar", 2, 68.0, vec!["apple"], vec![8]),
        ("umbral_hot_pot", "Blazing Stove", 1, 203.0, vec!["moondew_radish", "waxing_moon_pepper", "fresh_water"], vec![8, 8, 8]),
        ("moondew_radish_slices", "Blazing Stove", 1, 203.0, vec!["moondew_radish", "rock_candy"], vec![8, 1]),
        ("rock_candy", "Simmering Pot", 3, 135.0, vec!["sugarcane", "fresh_water"], vec![6, 8]),
        ("umbral_sweet_and_spicy_sauce", "Simmering Pot", 1, 243.0, vec!["moondew_radish", "waxing_moon_pepper", "sea_salt"], vec![8, 8, 23]),
        ("roasted_waxing_moon_pepper", "Claw Game Cooker", 1, 162.0, vec!["waxing_moon_pepper", "sea_salt"], vec![8, 23]),
        ("harvest_platter", "Crafting Table", 1, 405.0, vec!["roasted_waxing_moon_pepper", "moondew_radish_slices"], vec![1, 1]),
    ];
    for (name, facility, level, workload, ingredients, amounts) in observed {
        let recipe = items.iter().find(|item| item.name == name).unwrap();
        assert_eq!(recipe.facility, facility, "{name}");
        assert_eq!(recipe.facility_level, level, "{name}");
        assert_eq!(recipe.workload, Some(workload), "{name}");
        assert_eq!(recipe.raw_materials.as_ref().unwrap(), &ingredients, "{name}");
        assert_eq!(recipe.required_amount.as_ref().unwrap(), &amounts, "{name}");
    }
    // Future bad recipe data must fail explicitly rather than omit ingredients.
    let mut broken = raw("festival", "Blazing Stove");
    broken.season = Some(aniimax::models::SeasonTerms { points: 1.0, seed_cost: 0.0 });
    broken.raw_materials = Some(vec!["festival".into()]);
    assert!(season_raw_ingredients(&[broken.clone()]).unwrap_err().contains("cycle"));
    broken.raw_materials = Some(vec!["missing".into()]);
    assert!(season_raw_ingredients(&[broken]).unwrap_err().contains("Missing"));
}

#[test]
fn a_single_unit_of_each_raw_is_retained_and_not_processed_or_sold() {
    let (mut items, counts) = fixture(0);
    let mut dish = raw("dish", "Blazing Stove");
    dish.raw_materials = Some(vec!["moondew_radish".into()]);
    dish.required_amount = Some(vec![8]);
    dish.sell_value = 100_000.0;
    dish.yield_amount = 1;
    items.push(dish);
    let plan = solve(&items, &counts);
    let net = net_rates(&plan, &items);
    for name in RAW {
        assert_eq!(plan.units[name], 1, "{name}");
        assert_eq!(plan.harvest_reserve_units[name], 1, "{name}");
        assert!(net[name] >= 0.08 - 1e-8, "{name}");
        assert!(!plan.sold.contains_key(name), "reserved {name} must not earn income");
    }
    assert!(!plan.recipe_rates.contains_key("dish"), "do not pre-craft from reserved output");
    assert_eq!(plan.rate_per_second, 0.0);
    let shown = to_production_plan(&plan, &items, "coins", &counts);
    assert!(shown.income_streams.is_empty());
    assert!(shown.coin_items.iter().filter(|row| row.item_name.is_some())
        .all(|row| row.reason.contains("Keep 1 unit's output raw")));
}

#[test]
fn extra_output_can_follow_priorities_without_consuming_order_stock() {
    let (mut items, counts) = fixture(1);
    let mut dish = raw("dish", "Blazing Stove");
    dish.raw_materials = Some(vec!["moondew_radish".into()]);
    dish.required_amount = Some(vec![8]);
    dish.sell_value = 100_000.0;
    dish.yield_amount = 1;
    dish.production_time = 1.0;
    items.push(dish);
    let plan = solve(&items, &counts);
    assert_eq!(plan.units["moondew_radish"], 2);
    assert!(plan.recipe_rates["dish"] > 0.0);
    assert!(net_rates(&plan, &items)["moondew_radish"] >= 0.08 - 1e-8);
    let original = plan.clone();
    let mut sold_reserve = plan;
    sold_reserve.sold.insert("moondew_radish".into(), 0.08);
    assert!(check_plan(&sold_reserve, &items, "coins", &counts, &ModuleLevels::default(), None)
        .unwrap_err().contains("kept raw"));
    let mut missing = original;
    missing.harvest_reserve_units.remove("apple");
    assert!(check_plan(&missing, &items, "coins", &counts, &ModuleLevels::default(), None)
        .unwrap_err().contains("apple"));
}

#[test]
fn quick_dispatch_variants_keep_one_whole_unit_of_their_actual_output() {
    let (mut items, mut counts) = fixture(0);
    let mut quick = raw("quick_fresh_water", "Well");
    quick.yield_amount = 17;
    quick.production_time = 50.0;
    items.push(quick);
    counts.set("Well", 2, 1);
    let plan = solve(&items, &counts);
    // Whichever recipe is chosen for stock, the floor is its actual full-unit throughput.
    let kept: f64 = plan.harvest_reserve_units.iter().filter_map(|(name, &units)| {
        let recipe = items.iter().find(|item| item.name == *name)?;
        (recipe.facility == "Well").then_some(units as f64 * recipe.yield_amount as f64 / recipe.production_time)
    }).sum();
    assert!(kept >= 0.08 - 1e-8);
    assert!(net_rates(&plan, &items)["fresh_water"] >= kept - 1e-8);
    assert!(plan.sold.get("fresh_water").copied().unwrap_or(0.0) > 0.0, "the second unit can sell extra water");
}

#[test]
fn order_stock_survives_the_rv_pace_and_coin_refinement_solves() {
    let (items, mut counts) = fixture(1);
    counts.set("Woodland", 2, 1);
    let level_up = aniimax::exact::LevelUp { cost: vec![("coins".into(), 100.0)], stock: vec![] };
    let pace = solve_exact(&items, "coins", &counts, &ModuleLevels::default(), Goal::LevelUp(&level_up),
        Some(Duration::from_secs(10)), None).unwrap().pace.unwrap();
    let plan = solve_exact(&items, "coins", &counts, &ModuleLevels::default(),
        Goal::EarnWhileLevelingUp(&level_up, pace), Some(Duration::from_secs(10)), None).unwrap();
    check_plan(&plan, &items, "coins", &counts, &ModuleLevels::default(), Some(&level_up)).unwrap();
    assert_eq!(plan.harvest_reserve_units.len(), 6);
    for name in RAW {
        assert!(net_rates(&plan, &items)[name] >= 0.08 - 1e-8);
    }
}
