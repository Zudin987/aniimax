use aniimax::data::{add_e_mode_variants, load_all_data};
use aniimax::exact::{check_plan, solve_exact, Goal};
use aniimax::models::{FacilityCounts, ModuleLevels, ProductionItem};
use std::path::Path;
use std::time::Duration;

fn item(name: &str, seconds: f64) -> ProductionItem {
    ProductionItem {
        name: name.to_string(),
        facility: "Crafting Table".to_string(),
        raw_materials: None,
        required_amount: None,
        cost: None,
        sell_currency: "coins".to_string(),
        sell_value: 100.0,
        production_time: seconds,
        yield_amount: 1,
        energy: None,
        facility_level: 1,
        module_requirement: None,
        workload: None,
        byproduct: None,
        environment: None,
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
    let mut items = vec![item("widget", 100.0)];
    let added = add_e_mode_variants(
        &mut items,
        "name,production_time\nwidget,10\nnot_in_this_release,5\n",
    )
    .expect("valid e-mode data");
    assert_eq!(added, 1);
    let electric = items.iter().find(|i| i.name == "widget__electric").expect("electric variant");
    assert_eq!(electric.production_time, 10.0);
    assert!(electric.workload.is_none());
}

#[test]
fn e_mode_beats_worker_mode_when_full_power_is_available() {
    let mut items = vec![item("widget", 100.0)];
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
    let mut items = vec![item("widget", 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[("Crafting Table", 1, 5)]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert!(plan.recipe_rates.contains_key("widget"));
    assert!(!plan.recipe_rates.contains_key("widget__electric"));
    assert_eq!(plan.power_used, 0);
    assert_eq!(plan.power_capacity, 0);
}

#[test]
fn grid_capacity_limits_how_many_machines_use_e_mode() {
    let mut items = vec![item("widget", 100.0)];
    add_e_mode_variants(&mut items, "name,production_time\nwidget,10\n").unwrap();

    let counts = FacilityCounts::only(&[
        ("Crafting Table", 5, 10),
        ("Crackle Generator", 1, 1),
    ]);
    let modules = ModuleLevels { power_module: 1, ..ModuleLevels::default() };
    let plan = solve(&items, &counts, &modules);

    assert_eq!(plan.power_capacity, 600);
    assert!(plan.power_used <= plan.power_capacity);
    assert_eq!(plan.power_used, 600); // four Lv.10 machines at 150 power each.
    assert_eq!(plan.electric_units["widget__electric"].iter().map(|(_, n)| *n).sum::<u32>(), 4);
}

#[test]
fn harvest_moon_chain_is_present_in_release_data() {
    let items = load_all_data(Path::new("data")).expect("game data");
    let get = |name: &str| items.iter().find(|i| i.name == name).unwrap_or_else(|| panic!("missing {name}"));

    let radish = get("moondew_radish");
    assert_eq!(radish.facility, "Farmland");
    assert_eq!(radish.yield_amount, 8);
    assert_eq!(radish.production_time, 1800.0); // existing watering model: 40 min -> 30 min.

    let platter = get("harvest_platter");
    assert_eq!(platter.facility, "Crafting Table");
    assert_eq!(platter.sell_value, 5290.0);
    assert_eq!(platter.raw_materials.as_ref().unwrap(), &vec![
        "roasted_waxing_moon_pepper".to_string(),
        "moondew_radish_slices".to_string(),
    ]);
}
