//! High-level production cards supplied by the player on 29 October 2026.
use aniimax::{data, exact::{solve_exact, Goal}, models::{FacilityCounts, ModuleLevels}};
use std::{path::Path, time::Duration};

#[test]
fn screenshot_prices_recipes_yields_and_workloads_load() {
    let items = data::load_all_data(Path::new("data")).unwrap();
    let requirements = data::load_aniimo_requirements(Path::new("data")).unwrap();
    let get = |name: &str| items.iter().find(|i| i.name == name).unwrap_or_else(|| panic!("missing {name}"));
    let ore = get("silver_ore");
    assert_eq!((ore.facility_level, ore.sell_value, ore.yield_amount, ore.workload), (7, 1155.0, 2, Some(2700.0)));
    assert_eq!(ore.byproduct, Some(("Mineral Sand".into(), 165)));
    let spring = get("snowmelt_cold_spring");
    assert_eq!((spring.facility_level, spring.sell_value, spring.yield_amount, spring.workload), (6, 385.0, 6, Some(2700.0)));
    let quick = get("quick_snowmelt_cold_spring");
    assert_eq!((quick.facility_level, quick.sell_value, quick.yield_amount, quick.workload), (6, 385.0, 9, Some(2700.0)));
    assert_eq!(quick.module_requirement, Some(("resource_detector".into(), 10)));
    for (name, facility, level, price, workload, ingredients, amounts) in [
        ("bright_silver_powder", "Carousel Mill", 7, 3140.0, 81.0, "silver_ore", "2"),
        ("star_diamond", "Crafting Table", 8, 3990.0, 162.0, "gem;star", "2;2"),
        ("quicksilver_springstone", "Crafting Table", 9, 6430.0, 162.0, "silver_ore;snowmelt_cold_spring", "2;6"),
        ("glitter_powder", "Crafting Table", 9, 11560.0, 243.0, "gold_dust;bright_silver_powder;scales", "1;1;12"),
        ("potato_starch", "Simmering Pot", 7, 6280.0, 162.0, "premium_potato;snowmelt_cold_spring", "6;6"),
        ("shredded_coconut_cake", "Blazing Stove", 6, 10480.0, 243.0, "potato_starch;shredded_coconut", "1;1"),
    ] {
        let item = get(name);
        assert_eq!((item.facility.as_str(), item.facility_level, item.sell_value, item.workload), (facility, level, price, Some(workload)), "{name}");
        assert_eq!(item.raw_materials.as_ref().unwrap().join(";"), ingredients, "{name}");
        assert_eq!(item.required_amount.as_ref().unwrap().iter().map(u32::to_string).collect::<Vec<_>>().join(";"), amounts, "{name}");
        assert_eq!(item.yield_amount, 1, "{name}");
        assert!(requirements.get(name).is_some(), "{name}");
    }
    let mut powered = items.clone();
    data::add_e_mode_variants(&mut powered, include_str!("../data/e_mode.csv")).unwrap();
    for (name, seconds) in [("bright_silver_powder__electric", 54.0), ("star_diamond__electric", 108.0), ("shredded_coconut_cake__electric", 162.0)] {
        assert!(powered.iter().any(|i| i.name == name && i.production_time == seconds), "{name}");
    }
}

#[test]
fn exact_planner_does_not_create_missing_ingredients() {
    let mut items = data::load_all_data(Path::new("data")).unwrap();
    items.retain(|i| ["silver_ore", "snowmelt_cold_spring", "bright_silver_powder",
        "glitter_powder", "potato_starch", "shredded_coconut_cake"].contains(&i.name.as_str()));
    let counts = FacilityCounts::only(&[("Mine", 1, 7), ("Well", 1, 6), ("Carousel Mill", 1, 7),
        ("Crafting Table", 1, 9), ("Simmering Pot", 1, 7), ("Blazing Stove", 1, 6)]);
    let plan = solve_exact(&items, "coins", &counts, &ModuleLevels::default(), Goal::Earn { floors: &[] },
        Some(Duration::from_secs(30)), None).expect("plan");
    assert!(plan.rate_per_second > 0.0);
    for name in ["glitter_powder", "potato_starch", "shredded_coconut_cake"] {
        assert!(!plan.recipe_rates.get(name).is_some_and(|rate| *rate > 1e-9), "{name} has no complete input chain");
    }
}
