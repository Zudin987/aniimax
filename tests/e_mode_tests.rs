use aniimax::data::add_e_mode_variants;
use aniimax::exact::{check_plan, solve_exact, Goal};
use aniimax::models::{FacilityCounts, ModuleLevels, ProductionItem};
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
