use aniimax::data::add_e_mode_variants;
use aniimax::exact::{check_plan, solve_exact, Goal};
use aniimax::models::{Crew, FacilityCounts, ModuleLevels, ProductionItem, RosterAniimo, SeasonTerms};
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
fn e_mode_loader_adds_fixed_timer_variant() {
    let mut items = vec![item("widget", "Crafting Table", 100.0, 100.0)];
    let added = add_e_mode_variants(
        &mut items,
        "name,production_time\nwidget,10\nnot_in_this_release,5\n",
    )
    .expect("valid E-Mode data");
    assert_eq!(added, 1);
    let electric = items.iter().find(|i| i.name == "widget__electric").expect("electric variant");
    assert_eq!(electric.production_time, 10.0);
    assert!(electric.workload.is_none());
    assert!(electric.crew.is_none());
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

    assert!(plan.recipe_rates.contains_key("widget__electric"));
    assert!(!plan.recipe_rates.contains_key("widget"));
    assert_eq!(plan.power_used, 75); // 15 power x actual Crafting Table Lv.5.
    assert_eq!(plan.power_capacity, 600);
    assert_eq!(plan.generators_used, 1);
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
fn harvest_moon_keeps_two_plots_of_each_mutation_crop_when_unprofitable() {
    let items = vec![
        item("moondew_radish", "Farmland", 100.0, 0.0),
        item("waxing_moon_pepper", "Farmland", 100.0, 0.0),
        item("profitable_crop", "Farmland", 100.0, 1_000.0),
    ];
    let counts = FacilityCounts::only(&[("Farmland", 6, 1)]);
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


fn lightning_crew(level: u32) -> Crew {
    Crew {
        members: vec![RosterAniimo {
            count: 1,
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
    assert!(!weak_plan.recipe_rates.contains_key("widget__electric"));
    assert_eq!(weak_plan.generators_used, 0);

    let mut suitable = FacilityCounts::only(&[
        ("Crafting Table", 1, 3),
        ("Crackle Generator", 1, 3),
    ]);
    suitable.set_crew(lightning_crew(3));
    let powered = solve(&items, &suitable, &modules);
    assert!(powered.recipe_rates.contains_key("widget__electric"));
    assert_eq!(powered.generators_used, 1);
    assert!(powered.staffing.iter().any(|(building, member, share)|
        building == "Crackle Generator Lv.3" && *member == 0 && (*share - 1.0).abs() < 1e-9));
}
