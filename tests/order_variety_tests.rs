use aniimax::exact::{check_plan, net_rates, solve_exact, Goal, LevelUp, OrderCore, PACE_UNIT};
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
    for (machines, expected) in [(2, 2), (1, 1)] {
        let counts = FacilityCounts::only(&[("Farmland", 1, 1), ("Carousel Mill", machines, 1)]);
        let run = |goal| solve_exact(&items, "coins", &counts, &modules, goal, Some(Duration::from_secs(5)), None).unwrap();
        let fastest = run(Goal::LevelUp(&cost));
        let pace = fastest.pace.unwrap() * 0.95;
        let broad = run(Goal::OrderVariety { level_up: Some((&cost, pace)), minimum: None, core: None });
        assert_eq!(broad.order_stock.len(), expected);
        assert!(!broad.order_stock.contains_key("wheat"), "ingredients do not compete with crafted variety");
        assert!(!broad.order_stock.contains_key("quick_wheat"));
        let final_plan = run(Goal::OrderVariety { level_up: Some((&cost, pace)), minimum: Some(expected as u32), core: None });
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
fn raw_order_stock_requires_a_spare_unit_after_crafted_goods_and_rv_gathering() {
    let wheat = item("wheat", "Farmland", 10.0, 1.0);
    let quick = item("quick_wheat", "Farmland", 5.0, 1.0);
    let carrot = item("carrot", "Farmland", 10.0, 1.0);
    let mut flour = item("flour", "Carousel Mill", 1.0, 10.0);
    flour.raw_materials = Some(vec!["wheat".into()]); flour.required_amount = Some(vec![1]);
    let items = vec![wheat, quick, carrot, flour];
    let modules = ModuleLevels::default();
    let cost = LevelUp { cost: vec![("coins".into(), 100.0)], stock: vec![] };
    for (plots, raw_expected) in [(1, 0), (2, 1), (3, 2)] {
        let counts = FacilityCounts::only(&[("Farmland", plots, 1), ("Carousel Mill", 1, 1)]);
        let core = OrderCore { gatherer_units: [("quick_wheat".into(), 1)].into(),
            processed_stock: vec!["flour".into()], minimum_raw: None };
        let goal = Goal::OrderVariety { level_up: Some((&cost, 1.0)), minimum: Some(1), core: Some(&core) };
        let plan = solve_exact(&items, "coins", &counts, &modules, goal, Some(Duration::from_secs(5)), None).unwrap();
        check_plan(&plan, &items, "coins", &counts, &modules, Some(&cost)).unwrap();
        assert_eq!(plan.order_stock.len(), raw_expected + 1);
        assert!(plan.order_stock.contains_key("flour"));
        assert!(plan.units["quick_wheat"] >= 1);
        if plots == 1 {
            // This one ingredient unit has enormous surplus, but still has no spare physical slot.
            let mut forged = plan.clone();
            forged.order_stock.insert("wheat".into(), 1.0 / PACE_UNIT);
            assert!(check_plan(&forged, &items, "coins", &counts, &modules, Some(&cost)).unwrap_err().contains("spare unit"));
        }
        let mut forged = plan.clone();
        forged.order_stock.remove("flour");
        assert!(check_plan(&forged, &items, "coins", &counts, &modules, Some(&cost)).unwrap_err().contains("crafted order stock"));
        let final_core = OrderCore { minimum_raw: Some(raw_expected as u32), ..core };
        let income = solve_exact(&items, "coins", &counts, &modules,
            Goal::OrderVariety { level_up: Some((&cost, 1.0)), minimum: Some(1), core: Some(&final_core) },
            Some(Duration::from_secs(5)), None).unwrap();
        check_plan(&income, &items, "coins", &counts, &modules, Some(&cost)).unwrap();
        assert_eq!(income.order_stock.len(), raw_expected + 1, "income refinement must preserve both stock goals");
        if raw_expected > 0 {
            let mut forged = income.clone();
            forged.order_stock.retain(|name, _| name == "flour");
            assert!(check_plan(&forged, &items, "coins", &counts, &modules, Some(&cost)).unwrap_err().contains("spare-unit stock"));
        }
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
