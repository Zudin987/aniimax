//! Future Magical Wonder Night dataset, transcribed from 2026-10-29 in-game
//! screenshots supplied by the player. This does not enable the season in the live app.

use aniimax::data::{load_all_data, parse_season, season_raw_ingredients};
use std::{collections::HashSet, path::Path};

#[test]
fn wonder_night_crop_and_product_cards_match_supplied_evidence() {
    let recipes = parse_season(include_str!("../data/magical_wonder_night.csv")).unwrap();
    assert_eq!(recipes.len(), 11, "two crops plus nine craftables");
    let find = |name: &str| recipes.iter().find(|r| r.name == name)
        .unwrap_or_else(|| panic!("missing {name}"));

    for name in ["magic_pumpkin", "memory_lanternfruit"] {
        let crop = find(name);
        assert_eq!(crop.facility, "Farmland");
        assert_eq!(crop.facility_level, 5);
        assert_eq!(crop.production_time, 1800.0);
        assert_eq!(crop.yield_amount, 8);
        assert_eq!(crop.sell_value, 61.0);
        assert_eq!(crop.energy, Some(1350.0));
        assert_eq!(crop.environment.as_deref(), Some("Adequate"));
        assert_eq!(crop.season.unwrap().seed_cost, 4.0);
        assert_eq!(crop.season.unwrap().points, 1.0);
    }
    // (Name, facility, level, ingredients, per-batch quantities, coins, points, workload)
    for (name, facility, level, ingredients, amounts, coins, points, workload) in [
        ("sea_salt_roasted_pumpkin", "Claw Game Cooker", 4,
            "magic_pumpkin;sea_salt", "8;23", 1180.0, 8.0, 135.0),
        ("magic_pumpkin_cake", "Blazing Stove", 2,
            "magic_pumpkin;wheatmeal", "8;1", 1120.0, 10.0, 135.0),
        ("magic_pumpkin_lantern", "Crafting Table", 4,
            "magic_pumpkin", "8", 650.0, 8.0, 68.0),
        ("candied_lanternfruit", "Pickling Jar", 2,
            "memory_lanternfruit;rock_candy", "8;1", 2260.0, 8.0, 203.0),
        ("gleam_fruit_nectar", "Bouncy Brew Keg", 2,
            "memory_lanternfruit;fresh_water", "8;8", 1180.0, 10.0, 135.0),
        ("golden_lantern_pumpkin_soup", "Simmering Pot", 3,
            "magic_pumpkin;memory_lanternfruit;fresh_water", "8;8;8", 1830.0, 20.0, 203.0),
        ("memory_lantern", "Crafting Table", 4,
            "memory_lanternfruit;cotton_thread", "8;1", 1220.0, 8.0, 135.0),
        ("honey_glazed_pumpkin_cup", "Blazing Stove", 2,
            "sea_salt_roasted_pumpkin;candied_lanternfruit", "1;1", 4430.0, 4.0, 338.0),
        ("glowfruit_lantern_set", "Crafting Table", 5,
            "memory_lantern;magic_pumpkin_lantern", "1;1", 2710.0, 4.0, 243.0),
    ] {
        let r = find(name);
        assert_eq!(r.facility, facility, "{name}");
        assert_eq!(r.facility_level, level, "{name}");
        assert_eq!(r.sell_value, coins, "{name}");
        assert_eq!(r.season.unwrap().points, points, "{name}");
        assert_eq!(r.workload, Some(workload), "{name}");
        assert_eq!(r.raw_materials.as_ref().unwrap().join(";"), ingredients, "{name}");
        assert_eq!(r.required_amount.as_ref().unwrap().iter().map(u32::to_string)
            .collect::<Vec<_>>().join(";"), amounts, "{name}");
    }
    for (name, energy) in [
        ("sea_salt_roasted_pumpkin", 25920.0),
        ("magic_pumpkin_cake", 30190.0),
        ("candied_lanternfruit", 86250.0),
    ] {
        assert_eq!(find(name).energy, Some(energy), "{name}");
    }
}

#[test]
fn wonder_night_ingredients_exist_and_have_no_cycles() {
    let seasonal = parse_season(include_str!("../data/magical_wonder_night.csv")).unwrap();
    let mut items = load_all_data(Path::new("data")).unwrap();
    items.extend(seasonal.clone());
    let names: HashSet<_> = items.iter().map(|item| item.name.as_str()).collect();
    for item in &seasonal {
        for ingredient in item.raw_materials.iter().flatten() {
            assert!(names.contains(ingredient.as_str()),
                "{} has an unknown ingredient: {}", item.name, ingredient);
        }
    }
    let raw = season_raw_ingredients(&items).expect("no circular/missing dependencies");
    assert!(raw.iter().any(|s| s == "magic_pumpkin"));
    assert!(raw.iter().any(|s| s == "memory_lanternfruit"));
    assert!(raw.iter().any(|s| s == "sea_salt"));
    // Keep the older CSV backwards-compatible: it has no environment column.
    let previous = parse_season(include_str!("../data/harvest_moon_festival.csv")).unwrap();
    assert!(previous.iter().all(|i| i.environment.is_none()));
}
