use aniimax::data::add_e_mode_variants;
use aniimax::exact::{check_plan, solve_exact, to_production_plan, AniimoWork, Goal, LevelUp};
use aniimax::models::{Crew, FacilityCounts, GrowerStep, GrowerSteps, ModuleLevels, ProductionItem, RosterAniimo, SeasonTerms};
use std::time::Duration;

fn item(name: &str, facility: &str, seconds: f64, sell_value: f64) -> ProductionItem {
    ProductionItem {
        name: name.to_string(),
        facility: facility.to_string(),
        raw_materials: None,
        required_amount: None,
        cost: None,
        sell_currency: "coins".to_string(),
        sell_value,
        production_time: seconds,
        yield_amount: 1,
        energy: None,
        facility_level: 1,
        module_requirement: None,
        workload: None,
        byproduct: None,
        environment: None,
        season: None,
        crew: None,
    }
}

fn solve(items: &[ProductionItem], counts: &FacilityCounts, modules: &ModuleLevels) -> aniimax::exact::ExactPlan {
    let plan = solve_exact(
        items,
        "coins",
        counts,
        modules,
        Goal::Earn { floors: &[] },
        Some(Duration::from_secs(10)),
        None,
    )
    .expect("plan");
    check_plan(&plan, items, "coins", counts, modules, None).expect("plan re-check");
    plan
}

#[test]
fn forced_e_mode_runs_a_real_station_even_when_normal_is_faster() {
    let mut items = vec![item("widget", "Crafting Table", 10.0, 1_000.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,100\n").unwrap();
    let mut counts = FacilityCounts::only(&[("Crafting Table", 1, 1), ("Crackle Generator", 1, 1)]);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let normal = solve(&items, &counts, &modules);
    assert_eq!(normal.power_used, 0);
    counts.set_force_e_mode(true);
    assert!(check_plan(&normal, &items, "coins", &counts, &modules, None).unwrap_err().contains("Force E-Mode"));
    let powered = solve(&items, &counts, &modules);
    assert_eq!(powered.generators_used, 1);
    assert_eq!(powered.power_used, 15);
    assert!(powered.recipe_rates["widget__electric_boost"] > 0.0);
    assert!(powered.rate_per_second < normal.rate_per_second);
}

#[test]
fn forced_e_mode_cannot_be_satisfied_by_an_idle_generator_or_missing_worker() {
    let mut items = vec![item("widget", "Crafting Table", 10.0, 1_000.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,100\n").unwrap();
    let modules = ModuleLevels { power_module: 3, ..Default::default() };
    for (generators, lightning, recipes) in [(0, 3, &items[..]), (1, 1, &items[..]), (1, 3, &items[..1])] {
        let mut counts = FacilityCounts::only(&[("Crafting Table", 1, 3), ("Crackle Generator", generators, 3)]);
        counts.set_force_e_mode(true).set_generator_lightning_level(Some(lightning));
        assert!(solve_exact(recipes, "coins", &counts, &modules, Goal::Earn { floors: &[] },
            Some(Duration::from_secs(5)), None).is_none());
    }
}

#[test]
fn forced_rv_staffing_preserves_pace_without_hiring_for_extra_coins() {
    let mut first = item("first", "Carousel Mill", 10.0, 0.0);
    first.raw_materials = Some(vec!["raw".into()]); first.required_amount = Some(vec![1]);
    let mut last = item("last", "Crafting Table", 10.0, 0.0);
    last.raw_materials = Some(vec!["first".into()]); last.required_amount = Some(vec![1]);
    let mut items = vec![item("raw", "Farmland", 1_000.0, 0.0), first, last,
        item("extra_coins", "Mine", 1.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nfirst,100\nlast,100\n").unwrap();
    let mut counts = FacilityCounts::only(&[("Farmland", 1, 1), ("Carousel Mill", 1, 1),
        ("Crafting Table", 1, 1), ("Mine", 1, 1), ("Crackle Generator", 1, 1)]);
    counts.set_force_e_mode(true);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let cost = LevelUp { cost: vec![("last".into(), 86.4), ("coins".into(), 86_400.0)],
        stock: vec![("coins".into(), 86_400.0)] };
    let fastest = solve_exact(&items, "coins", &counts, &modules, Goal::LevelUp(&cost),
        Some(Duration::from_secs(5)), None).unwrap();
    let pace = fastest.pace.unwrap();
    let income = solve_exact(&items, "coins", &counts, &modules, Goal::EarnWhileLevelingUp(&cost, pace),
        Some(Duration::from_secs(5)), None).unwrap();
    assert!(income.recipe_rates.contains_key("extra_coins"));
    let work: Vec<_> = [("first", "Wind", false, 10.0), ("last", "Artisanship", false, 10.0),
        ("extra_coins", "Earth", true, 1.0)].into_iter().map(|(recipe, group, per_unit, seconds)|
            AniimoWork { recipe: recipe.into(), group: group.into(), per_unit, seconds }).collect();
    let freed = solve_exact(&items, "coins", &counts, &modules,
        Goal::FreeAniimo { floors: &[], level_up: Some((&cost, pace)), coins: 0.0, work: &work },
        Some(Duration::from_secs(5)), None).unwrap();
    check_plan(&freed, &items, "coins", &counts, &modules, Some(&cost)).unwrap();
    assert!(freed.pace.unwrap() >= pace * 0.9999 - 1e-8);
    assert!(!freed.recipe_rates.contains_key("extra_coins"));
    assert!(!freed.recipe_rates.contains_key("first"));
    assert!(!freed.recipe_rates.contains_key("last"));
    assert_eq!(freed.generators_used, 1);
    assert_eq!(freed.power_used, 30);
}

#[test]
fn e_mode_frees_whole_worker_slots_even_when_normal_mode_is_faster() {
    let raw = item("raw", "Farmland", 1_000.0, 0.0);
    let mut first = item("first", "Carousel Mill", 10.0, 0.0);
    first.raw_materials = Some(vec!["raw".into()]);
    first.required_amount = Some(vec![1]);
    let mut second = item("second", "Jukebox Dryer", 10.0, 0.0);
    second.raw_materials = Some(vec!["first".into()]);
    second.required_amount = Some(vec![1]);
    let mut last = item("last", "Crafting Table", 10.0, 1_000.0);
    last.raw_materials = Some(vec!["second".into()]);
    last.required_amount = Some(vec![1]);
    let mut items = vec![raw, first, second, last];
    // E-Mode is ten times slower, but still easily keeps up with the material bottleneck.
    add_e_mode_variants(&mut items, "name,production_time\nfirst,100\nsecond,100\nlast,100\n").unwrap();
    let counts = FacilityCounts::only(&[
        ("Farmland", 1, 1), ("Carousel Mill", 1, 1), ("Jukebox Dryer", 1, 1),
        ("Crafting Table", 1, 1), ("Crackle Generator", 1, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let work: Vec<AniimoWork> = ["first", "second", "last"].into_iter().map(|name| AniimoWork {
        recipe: name.into(), group: name.into(), per_unit: false, seconds: 10.0,
    }).collect();
    let plan = solve_exact(&items, "coins", &counts, &modules,
        Goal::FreeAniimo { floors: &[], level_up: None, coins: 1.0, work: &work },
        Some(Duration::from_secs(10)), None).expect("worker-saving plan");
    check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap();
    assert!(plan.rate_per_second >= 0.9999 - 1e-9);
    assert_eq!(plan.generators_used, 1);
    for name in ["first", "second", "last"] {
        assert!(!plan.recipe_rates.contains_key(name), "{name} still requires a production worker");
        assert!(plan.recipe_rates.contains_key(&format!("{name}__electric_boost")));
    }
    assert_eq!(plan.power_used, 45);
}

#[test]
fn free_aniimo_keeps_priority_floors_and_accounts_for_generator_workers() {
    let mut widget = item("widget", "Crafting Table", 10.0, 1_000.0);
    widget.raw_materials = Some(vec!["raw".into()]);
    widget.required_amount = Some(vec![1]);
    widget.byproduct = Some(("Wood Blocks".into(), 1));
    let mut items = vec![item("raw", "Farmland", 1_000.0, 0.0), widget];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,100\n").unwrap();
    let counts = FacilityCounts::only(&[("Farmland", 1, 1), ("Crafting Table", 1, 1), ("Crackle Generator", 1, 1)]);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let work = [AniimoWork { recipe: "widget".into(), group: "Artisanship".into(), per_unit: false, seconds: 10.0 }];
    let floors = [("Wood Blocks".into(), 0.001)];
    let plan = solve_exact(&items, "coins", &counts, &modules,
        Goal::FreeAniimo { floors: &floors, level_up: None, coins: 1.0, work: &work },
        Some(Duration::from_secs(10)), None).expect("worker-saving plan");
    check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap();
    // One normal worker cannot be replaced by fewer than one generator resident.
    assert_eq!(plan.generators_used, 0);
    assert!(plan.recipe_rates["widget"] >= 0.0009999 - 1e-9);
}

#[test]
fn free_aniimo_respects_personality_sharing_when_counting_saved_slots() {
    let mut a = item("a", "Claw Game Cooker", 10.0, 1_000.0);
    a.raw_materials = Some(vec!["raw".into()]); a.required_amount = Some(vec![1]);
    a.byproduct = Some(("Wood Blocks".into(), 1));
    let mut b = item("b", "Simmering Pot", 10.0, 1_000.0);
    b.raw_materials = Some(vec!["raw".into()]); b.required_amount = Some(vec![1]);
    b.byproduct = Some(("Mineral Sand".into(), 1));
    let mut items = vec![item("raw", "Farmland", 1_000.0, 0.0), a, b];
    add_e_mode_variants(&mut items, "name,production_time\na,100\nb,100\n").unwrap();
    let counts = FacilityCounts::only(&[("Farmland", 1, 1), ("Claw Game Cooker", 1, 1), ("Simmering Pot", 1, 1), ("Crackle Generator", 1, 1)]);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let floors = [("Wood Blocks".into(), 0.0005), ("Mineral Sand".into(), 0.0005)];
    for (other_personality, expected_generators) in [("Tenacious", 0), ("Nimble", 1)] {
        let work = [
            AniimoWork { recipe: "a".into(), group: "Fire:4:Practical".into(), per_unit: false, seconds: 10.0 },
            AniimoWork { recipe: "b".into(), group: format!("Fire:4:{other_personality}"), per_unit: false, seconds: 10.0 },
        ];
        let plan = solve_exact(&items, "coins", &counts, &modules,
            Goal::FreeAniimo { floors: &floors, level_up: None, coins: 1.0, work: &work },
            Some(Duration::from_secs(10)), None).unwrap();
        check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap();
        assert_eq!(plan.generators_used, expected_generators, "{other_personality}");
    }
}

#[test]
fn e_mode_loader_adds_fixed_timer_variant() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    let added = add_e_mode_variants(
        &mut items,
        "name,production_time\nwidget,10\nnot_in_this_release,5\n",
    )
    .expect("valid E-Mode data");
    assert_eq!(added, 1);
    let electric = items.iter().find(|i| i.name == "widget__electric").expect("100% electric variant");
    assert_eq!(electric.production_time, 10.0);
    assert!(electric.workload.is_none());
    assert!(electric.crew.is_none());
    let boosted = items.iter().find(|i| i.name == "widget__electric_boost").expect("120% electric variant");
    assert!((boosted.production_time - 10.0 / 1.2).abs() < 1e-9);
    assert!(boosted.workload.is_none());
    assert!(boosted.crew.is_none());
}

#[test]
fn e_mode_is_used_when_it_improves_output() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[
        ("Crafting Table", 1, 5),
        ("Crackle Generator", 1, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert!(plan.recipe_rates.contains_key("widget__electric_boost"));
    assert!(!plan.recipe_rates.contains_key("widget__electric"));
    assert!(!plan.recipe_rates.contains_key("widget"));
    assert_eq!(plan.power_used, 75); // 15 power x actual Crafting Table Lv.5.
    assert_eq!(plan.power_capacity, 600);
    assert_eq!(plan.generators_used, 1);
    assert_eq!(plan.power_efficiency, 120);
}

#[test]
fn e_mode_does_not_switch_on_unused_powered_machines() {
    let mut raw = item("raw", "Farmland", 100.0, 0.0);
    raw.yield_amount = 1;

    let mut widget = item("widget", "Crafting Table", 100.0, 1_000.0);
    widget.raw_materials = Some(vec!["raw".to_string()]);
    widget.required_amount = Some(vec![1]);

    let mut items = vec![raw, widget];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[
        ("Farmland", 1, 1),
        ("Crafting Table", 3, 1),
        ("Crackle Generator", 1, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    // The raw-material bottleneck only feeds 0.01 widget/s; one E-Mode machine has 0.1/s
    // capacity, so the other two Crafting Tables must stay unpowered rather than consuming grid.
    assert_eq!(plan.electric_machines.get("Crafting Table"), Some(&vec![(1, 1)]));
    assert_eq!(plan.power_used, 15);
    assert_eq!(plan.generators_used, 1);
}

#[test]
fn e_mode_does_not_activate_redundant_generators() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[
        ("Crafting Table", 1, 5),
        ("Crackle Generator", 2, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert_eq!(plan.power_used, 75);
    assert_eq!(plan.generators_used, 1);
    assert_eq!(plan.power_supply, 600);
}

#[test]
fn e_mode_cannot_run_without_grid_capacity() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[("Crafting Table", 1, 5)]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert!(plan.recipe_rates.contains_key("widget"));
    assert!(!plan.recipe_rates.contains_key("widget__electric"));
    assert_eq!(plan.power_used, 0);
    assert_eq!(plan.power_capacity, 0);
    assert_eq!(plan.generators_used, 0);
}

#[test]
fn independent_check_rejects_recipe_using_a_different_grid_band() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();
    let counts = FacilityCounts::only(&[("Crafting Table", 1, 5), ("Crackle Generator", 1, 1)]);
    let modules = ModuleLevels { power_module: 1, ..Default::default() };
    let mut plan = solve(&items, &counts, &modules);
    plan.power_efficiency = 100;
    let error = check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap_err();
    assert!(error.contains("uses 120% but the grid runs at 100%"), "{error}");

    // Even after renaming every powered row, low draw cannot describe a 100% grid.
    let rate = plan.recipe_rates.remove("widget__electric_boost").unwrap();
    plan.recipe_rates.insert("widget__electric".to_string(), rate / 1.2);
    let units = plan.units.remove("widget__electric_boost").unwrap();
    plan.units.insert("widget__electric".to_string(), units);
    let tiers = plan.electric_units.remove("widget__electric_boost").unwrap();
    plan.electric_units.insert("widget__electric".to_string(), tiers);
    plan.sold.insert("widget".to_string(), rate / 1.2);
    plan.rate_per_second = rate / 1.2 * 100.0;
    let error = check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap_err();
    assert!(error.contains("within the 120% band"), "{error}");
}

#[test]
fn harvest_moon_keeps_two_plots_of_each_mutation_crop_when_unprofitable() {
    let items = vec![
        item("moondew_radish", "Farmland", 100.0, 0.0),
        item("waxing_moon_pepper", "Farmland", 100.0, 0.0),
        item("profitable_crop", "Farmland", 100.0, 1_000.0),
    ];
    let mut counts = FacilityCounts::only(&[("Farmland", 6, 1)]);
    counts.set_season_limits(None, 2);
    let plan = solve(&items, &counts, &ModuleLevels::default());

    assert_eq!(plan.units.get("moondew_radish"), Some(&2));
    assert_eq!(plan.units.get("waxing_moon_pepper"), Some(&2));
    assert_eq!(plan.units.get("profitable_crop"), Some(&2));
    assert!(plan.recipe_rates["moondew_radish"] * 100.0 >= 2.0 - 1e-9);
    assert!(plan.recipe_rates["waxing_moon_pepper"] * 100.0 >= 2.0 - 1e-9);
}


#[test]
fn harvest_mutation_minimum_is_configurable() {
    let items = vec![
        item("moondew_radish", "Farmland", 100.0, 0.0),
        item("waxing_moon_pepper", "Farmland", 100.0, 0.0),
        item("profitable_crop", "Farmland", 100.0, 1_000.0),
    ];
    let mut counts = FacilityCounts::only(&[("Farmland", 7, 1)]);
    counts.set_season_limits(None, 1);
    let plan = solve(&items, &counts, &ModuleLevels::default());

    assert_eq!(plan.units.get("moondew_radish"), Some(&1));
    assert_eq!(plan.units.get("waxing_moon_pepper"), Some(&1));
    assert_eq!(plan.units.get("profitable_crop"), Some(&5));
}

#[test]
fn harvest_default_reserves_one_plot_per_crop_and_leaves_other_plots_productive() {
    let items = vec![
        item("moondew_radish", "Farmland", 100.0, 0.0),
        item("waxing_moon_pepper", "Farmland", 100.0, 0.0),
        item("profitable_crop", "Farmland", 100.0, 1_000.0),
    ];
    let counts = FacilityCounts::only(&[("Farmland", 6, 1)]);
    let plan = solve(&items, &counts, &ModuleLevels::default());
    assert_eq!(plan.units.get("moondew_radish"), Some(&1));
    assert_eq!(plan.units.get("waxing_moon_pepper"), Some(&1));
    assert_eq!(plan.units.get("profitable_crop"), Some(&4));
}

#[test]
fn harvest_mutation_reason_uses_configured_minimum() {
    let items = vec![
        item("moondew_radish", "Farmland", 100.0, 0.0),
        item("waxing_moon_pepper", "Farmland", 100.0, 0.0),
        item("profitable_crop", "Farmland", 100.0, 1_000.0),
    ];
    let mut counts = FacilityCounts::only(&[("Farmland", 7, 1)]);
    counts.set_season_limits(None, 1);
    let exact = solve(&items, &counts, &ModuleLevels::default());
    let shown = to_production_plan(&exact, &items, "coins", &counts);

    let radish = shown
        .coin_items
        .iter()
        .find(|step| step.item_name.as_deref() == Some("moondew_radish"))
        .expect("radish row");
    assert!(radish.reason.contains("at least 1 plot planted"));
    assert!(!radish.reason.contains("at least 2 plots planted"));
}

#[test]
fn harvest_moon_wheat_budget_caps_planting_rate() {
    let mut radish = item("moondew_radish", "Farmland", 100.0, 1_000.0);
    radish.season = Some(SeasonTerms { points: 1.0, seed_cost: 4.0 });
    let mut pepper = item("waxing_moon_pepper", "Farmland", 100.0, 900.0);
    pepper.season = Some(SeasonTerms { points: 1.0, seed_cost: 4.0 });
    let items = vec![radish, pepper];

    let mut counts = FacilityCounts::only(&[("Farmland", 10, 1)]);
    // 3,456 Wheat/day permits 0.01 combined batches/sec at 4 Wheat per planting.
    counts.set_season_limits(Some(3_456.0), 0);
    let plan = solve(&items, &counts, &ModuleLevels::default());

    let spend_per_day: f64 = plan
        .recipe_rates
        .iter()
        .filter_map(|(name, rate)| items.iter().find(|i| i.name == *name).map(|i| rate * i.season.unwrap().seed_cost))
        .sum::<f64>()
        * 86_400.0;
    assert!(spend_per_day <= 3_456.0 + 1e-5, "spent {spend_per_day}");
    assert!(spend_per_day >= 3_455.0, "optimizer should use almost all profitable Wheat budget");
}

#[test]
fn harvest_budget_fits_the_shown_whole_plots_without_hidden_pauses() {
    let mut radish = item("moondew_radish", "Farmland", 1_800.0, 1_000.0);
    radish.season = Some(SeasonTerms { points: 1.0, seed_cost: 4.0 });
    let mut pepper = radish.clone();
    pepper.name = "waxing_moon_pepper".into();
    pepper.sell_value = 900.0;
    let items = vec![radish, pepper];
    let mut counts = FacilityCounts::only(&[("Farmland", 10, 1)]);
    counts.set_season_limits(Some(600.0), 0);
    let plan = solve(&items, &counts, &ModuleLevels::default());
    assert_eq!(plan.units.values().sum::<u32>(), 3, "600/day fits three full plots, not a paused fourth");
    for (name, units) in &plan.units {
        assert!((plan.recipe_rates[name] * 1_800.0 - *units as f64).abs() < 1e-8);
    }
    assert!((plan.recipe_rates.values().sum::<f64>() * 4.0 * 86_400.0 - 576.0).abs() < 1e-8);
}


fn lightning_crew(level: u32) -> Crew {
    Crew {
        members: vec![RosterAniimo {
            count: 1,
            family: None,
            abilities: [("Lightning".to_string(), level)].into_iter().collect(),
            personalities: Vec::new(),
        }],
        residents: Default::default(),
        environment: Default::default(),
        personalities: Default::default(),
    }
}

#[test]
fn rated_generator_power_requires_the_recommended_lightning_level() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();
    let modules = ModuleLevels { power_module: 3, ..ModuleLevels::default() };

    let mut weak = FacilityCounts::only(&[
        ("Crafting Table", 1, 3),
        ("Crackle Generator", 1, 3),
    ]);
    weak.set_crew(lightning_crew(1));
    let weak_plan = solve(&items, &weak, &modules);
    assert!(!weak_plan.recipe_rates.keys().any(|name| aniimax::models::is_electric_item(name)));
    assert_eq!(weak_plan.generators_used, 0);

    let mut suitable = FacilityCounts::only(&[
        ("Crafting Table", 1, 3),
        ("Crackle Generator", 1, 3),
    ]);
    suitable.set_crew(lightning_crew(3));
    let powered = solve(&items, &suitable, &modules);
    assert!(powered.recipe_rates.contains_key("widget__electric_boost"));
    assert_eq!(powered.generators_used, 1);
    assert_eq!(powered.power_efficiency, 120);
    assert!(powered.staffing.iter().any(|(building, member, share)|
        building == "Crackle Generator Lv.3" && *member == 0 && (*share - 1.0).abs() < 1e-9));
}


#[test]
fn e_mode_uses_100_percent_band_when_it_beats_the_120_percent_threshold() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    // Lv.5 Crafting Tables draw 75 each. A Lv.1 Generator keeps 120% only through 500 draw,
    // so six boosted machines make 0.72/s; eight machines at 100% draw exactly 600 and make
    // 0.8/s. The optimizer must choose the 100% grid-wide band.
    let counts = FacilityCounts::only(&[
        ("Crafting Table", 8, 5),
        ("Crackle Generator", 1, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert!(plan.recipe_rates.contains_key("widget__electric"));
    assert!(!plan.recipe_rates.contains_key("widget__electric_boost"));
    assert_eq!(plan.power_used, 600);
    assert_eq!(plan.power_supply, 600);
    assert_eq!(plan.power_efficiency, 100);
}

#[test]
fn generic_best_lightning_level_gates_rated_generator_output() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();
    let modules = ModuleLevels { power_module: 3, ..ModuleLevels::default() };

    let mut weak = FacilityCounts::only(&[
        ("Crafting Table", 1, 3),
        ("Crackle Generator", 1, 3),
    ]);
    weak.set_generator_lightning_level(Some(1));
    let weak_plan = solve(&items, &weak, &modules);
    assert!(!weak_plan.recipe_rates.keys().any(|name| aniimax::models::is_electric_item(name)));
    assert_eq!(weak_plan.generators_used, 0);

    let mut suitable = weak.clone();
    suitable.set_generator_lightning_level(Some(3));
    let powered = solve(&items, &suitable, &modules);
    assert!(powered.recipe_rates.keys().any(|name| aniimax::models::is_electric_item(name)));
    assert_eq!(powered.generators_used, 1);
}

#[test]
fn grower_jobs_consume_custom_roster_time() {
    let crop = item("test_crop", "Farmland", 10.0, 100.0);
    let mut steps = GrowerSteps::default();
    steps.insert("test_crop", GrowerStep {
        step: "Reclaiming".to_string(),
        ability: "Earth".to_string(),
        min_level: 1,
        workload: 100.0,
    });

    let mut counts = FacilityCounts::only(&[("Farmland", 10, 1)]);
    counts.set_crew(Crew {
        members: vec![RosterAniimo {
            count: 1,
            family: None,
            abilities: [("Earth".to_string(), 1)].into_iter().collect(),
            personalities: Vec::new(),
        }],
        residents: Default::default(),
        environment: Default::default(),
        personalities: Default::default(),
    });
    counts.set_grower_steps(steps);

    let plan = solve(&[crop], &counts, &ModuleLevels::default());
    let rate = plan.recipe_rates.get("test_crop").copied().unwrap_or(0.0);
    assert!(rate <= 0.010001, "one Earth worker should cap 100s reclaiming work, got {rate}/s");
    assert!(!plan.grower_staffing.is_empty());
    let busy: f64 = plan.grower_staffing.iter().map(|(_, _, _, share)| *share).sum();
    assert!(busy <= 1.0 + 1e-6, "grower work used {busy} Aniimo-days per day");
}
