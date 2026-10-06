use aniimax::exact::{check_plan, net_rates, solve_exact, Goal, LevelUp, PACE_UNIT};
use aniimax::models::{FacilityCounts, ModuleLevels, ProductionItem, SeasonTerms, SEASON_POINTS};
use std::time::Duration;

fn item(name: &str, facility: &str, time: f64, value: f64) -> ProductionItem {
    ProductionItem { name: name.into(), facility: facility.into(), raw_materials: None, required_amount: None,
        cost: None, sell_currency: "coins".into(), sell_value: value, production_time: time, yield_amount: 1,
        energy: None, facility_level: 1, module_requirement: None, workload: None, byproduct: None,
        environment: None, season: None, crew: None }
}

#[test]
fn variety_retains_real_net_output_at_rv_pace_without_double_counting_variants() {
    let wheat = item("wheat", "Farmland", 10.0, 1.0);
    let quick = item("quick_wheat", "Farmland", 5.0, 1.0);
    let mut flour = item("flour", "Carousel Mill", 1.0, 10.0);
    flour.raw_materials = Some(vec!["wheat".into()]); flour.required_amount = Some(vec![1]);
    let mut bread = flour.clone(); bread.name = "bread".into(); bread.sell_value = 9.0;
    let items = vec![wheat, quick, flour, bread];
    let modules = ModuleLevels::default();
    let cost = LevelUp { cost: vec![("coins".into(), 100.0)], stock: vec![] };
    for (machines, expected) in [(2, 3), (1, 2)] {
        let counts = FacilityCounts::only(&[("Farmland", 1, 1), ("Carousel Mill", machines, 1)]);
        let run = |goal| solve_exact(&items, "coins", &counts, &modules, goal, Some(Duration::from_secs(5)), None).unwrap();
        let fastest = run(Goal::LevelUp(&cost));
        let pace = fastest.pace.unwrap() * 0.95;
        let broad = run(Goal::OrderVariety { level_up: Some((&cost, pace)), minimum: None });
        assert_eq!(broad.order_stock.len(), expected);
        assert!(!broad.order_stock.contains_key("quick_wheat"));
        let final_plan = run(Goal::OrderVariety { level_up: Some((&cost, pace)), minimum: Some(expected as u32) });
        check_plan(&final_plan, &items, "coins", &counts, &modules, Some(&cost)).unwrap();
        assert!(final_plan.pace.unwrap() >= pace * 0.9998);
        let net = net_rates(&final_plan, &items);
        assert!(net.values().all(|v| *v >= -1e-6));
        for rate in final_plan.order_stock.values() { assert!((rate * PACE_UNIT - 1.0).abs() < 1e-6); }
        let mut forged = final_plan.clone();
        forged.order_stock.insert("wheat".into(), 100.0);
        assert!(check_plan(&forged, &items, "coins", &counts, &modules, Some(&cost)).is_err());
    }
}

#[test]
fn festival_floor_survives_coin_first_goals_and_is_checked_independently() {
    let mut event = item("event_crop", "Farmland", 100.0, 1.0);
    event.season = Some(SeasonTerms { points: 1.0, seed_cost: 4.0 });
    let items = vec![event, item("profitable_crop", "Farmland", 100.0, 100.0)];
    let mut counts = FacilityCounts::only(&[("Farmland", 2, 1)]);
    counts.set_season_limits(Some(4000.0), 0).set_season_points_per_day(100.0);
    let modules = ModuleLevels::default();
    let plan = solve_exact(&items, "coins", &counts, &modules, Goal::Earn { floors: &[] },
        Some(Duration::from_secs(5)), None).unwrap();
    check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap();
    assert!(aniimax::exact::target_rate(&plan, &items, SEASON_POINTS) * PACE_UNIT >= 100.0 - 1e-6);
    let mut forged = plan.clone(); forged.sold.remove("event_crop");
    assert!(check_plan(&forged, &items, "coins", &counts, &modules, None).unwrap_err().contains("minimum Harvest"));
    counts.set_season_points_per_day(2000.0);
    assert!(solve_exact(&items, "coins", &counts, &modules, Goal::Earn { floors: &[] },
        Some(Duration::from_secs(5)), None).is_none());
}
