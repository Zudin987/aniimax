//! Regression facts read from the entire 2026-10-03 recording; timestamps in
//! docs/game-evidence-2026-10-03.md identify each in-game screen.

use aniimax::{data, exact::{check_plan, solve_exact, Goal}, models::{
    crew_variants, facility_family, Crew, FacilityCounts, GrowerSteps, ModuleLevels, RosterAniimo,
}};
use std::path::Path;

#[test]
fn production_tooltips_match_prices_yields_workloads_and_requirements() {
    let items = data::load_all_data(Path::new("data")).unwrap();
    let reqs = data::load_aniimo_requirements(Path::new("data")).unwrap();
    let unverified = data::load_unverified(Path::new("data")).unwrap();
    // Recipe cards, not remaining cycle countdowns. Fresh Water's 30-minute card is E-Mode.
    for (name, facility, level, price, output, workload, module, environment) in [
        ("quick_wool", "Nimbus Bed", 2, 140.0, 6, 2700.0, Some(("resource_detector", 5)), None),
        ("quick_sea_salt", "Tidewhisper Sandcastle", 2, 16.0, 23, 2250.0, Some(("resource_detector", 2)), None),
        ("quick_aromathyst", "Dewy House", 2, 56.0, 12, 2700.0, Some(("resource_detector", 3)), None),
        ("quick_fresh_water", "Well", 3, 46.0, 17, 2700.0, Some(("resource_detector", 4)), None),
        ("star", "Starfall Hammock", 1, 390.0, 2, 2700.0, None, Some("Cool")),
    ] {
        let item = items.iter().find(|i| i.name == name && i.facility == facility).unwrap();
        assert_eq!(item.facility_level, level, "{name}");
        assert_eq!(item.sell_value, price, "{name}");
        assert_eq!(item.yield_amount, output, "{name}");
        assert_eq!(item.workload, Some(workload), "{name}");
        assert_eq!(item.module_requirement.as_ref().map(|(m, l)| (m.as_str(), *l)), module, "{name}");
        assert_eq!(item.environment.as_deref(), environment, "{name}");
        assert!(!unverified.iter().any(|(n, _)| n == name), "{name} has now been verified");
        assert!(reqs.get(name).is_some());
    }
    let mut electric = items.clone();
    data::add_e_mode_variants(&mut electric, include_str!("../data/e_mode.csv")).unwrap();
    assert_eq!(electric.iter().find(|i| i.name == "quick_fresh_water__electric").unwrap().production_time, 1800.0);
    assert!(unverified.iter().any(|(name, _)| name == "scales"), "Floral Windmill production stats were not shown");
}

fn member(family: Option<&str>, leisure: u32) -> RosterAniimo {
    RosterAniimo { count: 1, family: family.map(str::to_string),
        abilities: [("Leisure".into(), leisure)].into_iter().collect(), personalities: vec![] }
}

#[test]
fn a_leisure_ability_or_nickname_cannot_replace_the_required_family() {
    let items = data::load_all_data(Path::new("data")).unwrap();
    let reqs = data::load_aniimo_requirements(Path::new("data")).unwrap();
    let families = ["Susuta", "Dewy", "Nimbi", "Celestis"];
    let crew = Crew { members: families.iter().map(|f| member(Some(f), 4))
        .chain([member(None, 4), member(Some("Nimbi"), 1), member(Some("other"), 4)]).collect(), ..Crew::default() };
    let variants = crew_variants(items.clone(), &crew, &reqs, &GrowerSteps::default());
    for (facility, family) in [("Tidewhisper Sandcastle", "Susuta"), ("Dewy House", "Dewy"),
        ("Nimbus Bed", "Nimbi"), ("Starfall Hammock", "Celestis")] {
        assert_eq!(facility_family(facility), Some(family));
        let workers: Vec<_> = variants.iter().filter(|v| v.facility == facility).filter_map(|v| v.crew).collect();
        assert!(!workers.is_empty(), "{facility}");
        assert!(workers.iter().all(|&i| crew.members[i].family.as_deref() == Some(family)), "{facility}: {workers:?}");
        let recipe = items.iter().find(|i| i.facility == facility).unwrap();
        assert!(crew.worker(4, recipe, &reqs).is_none(), "an unspecified family cannot work {facility}");
    }
    assert!(member(None, 4).can_work_at("Well"), "older rosters can still work ordinary jobs");
    assert_eq!(facility_family("Floral Windmill"), None, "do not guess an unseen family");
    assert!(!variants.iter().any(|i| i.facility == "Nimbus Bed" && i.crew == Some(5)), "correct family still needs enough Leisure");
}

#[test]
fn exact_planning_and_independent_recheck_enforce_family() {
    let reqs = data::load_aniimo_requirements(Path::new("data")).unwrap();
    let wool = data::load_all_data(Path::new("data")).unwrap().into_iter().find(|i| i.name == "quick_wool").unwrap();
    let crew = Crew { members: vec![member(Some("Celestis"), 4), member(Some("Nimbi"), 3)],
        residents: ["Nimbus Bed".into()].into_iter().collect(), ..Crew::default() };
    let items = crew_variants(vec![wool], &crew, &reqs, &GrowerSteps::default());
    let mut counts = FacilityCounts::only(&[("Nimbus Bed", 1, 2)]);
    counts.set_crew(crew.clone());
    let modules = ModuleLevels { resource_detector: 5, ..ModuleLevels::default() };
    let plan = solve_exact(&items, "coins", &counts, &modules, Goal::Earn { floors: &[] }, None, None).unwrap();
    assert_eq!(plan.units.get("quick_wool__by1"), Some(&1));
    assert!(!plan.units.contains_key("quick_wool__by0"));
    check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap();
    let mut changed = crew;
    changed.members[1].family = Some("Dewy".into());
    counts.set_crew(changed);
    let error = check_plan(&plan, &items, "coins", &counts, &modules, None).unwrap_err();
    assert!(error.contains("requires the Nimbi family"), "{error}");
}

#[test]
fn web_and_native_station_families_stay_in_sync() {
    let js = std::fs::read_to_string("web/facility-config.js").unwrap();
    let mut found = 0;
    for entry in js.split("name: '").skip(1) {
        let facility = entry.split('\'').next().unwrap();
        let entry = entry.split("\n    }").next().unwrap();
        let family = entry.split("family: '").nth(1).and_then(|s| s.split('\'').next());
        assert_eq!(facility_family(facility), family, "{facility}");
        if family.is_some() { found += 1; }
    }
    assert_eq!(found, 4);
}
