//! Follow-up production screenshots and documented crop-work assumptions.
use aniimax::{data, models::{crew_variants, Crew, RosterAniimo, recipe_family}};
use std::path::Path;

#[test]
fn crop_cards_and_chains_are_loaded() {
    let items = data::load_all_data(Path::new("data")).unwrap();
    let find = |name: &str| items.iter().find(|i| i.name == name).unwrap_or_else(|| panic!("missing {name}"));
    let potato = find("premium_potato");
    assert_eq!((potato.facility_level, potato.sell_value, potato.yield_amount, potato.cost), (8, 386.0, 6, Some(1.0)));
    // The 40 minute in-game card is reduced to 30 minutes by the existing two-waterings model.
    assert_eq!(potato.production_time, 1800.0);
    let cap = find("gold_speck_cap");
    assert_eq!((cap.facility_level, cap.sell_value, cap.yield_amount, cap.workload, cap.environment.as_deref()), (2, 289.0, 8, Some(2700.0), Some("Warm")));
    for (name, ingredients, amounts) in [
        ("gold_dust", "gold_speck_cap", "8"),
        ("pearl_powder", "pearl", "2"),
        ("dried_orange_flower", "orange_flower", "8"),
        ("agave_fiber", "agave", "6"),
        ("sisal_plush_mat", "agave_fiber;woolen_yarn", "1;1"),
        ("pearl_face_cream", "pearl_powder;lotion", "1;1"),
        ("orange_flower_scented_mat", "dried_orange_flower;sisal_plush_mat", "1;1"),
    ] {
        let item = find(name);
        assert_eq!(item.raw_materials.as_ref().unwrap().join(";"), ingredients, "{name}");
        assert_eq!(item.required_amount.as_ref().unwrap().iter().map(u32::to_string).collect::<Vec<_>>().join(";"), amounts, "{name}");
    }
    let uncertain = data::load_unverified(Path::new("data")).unwrap();
    assert!(uncertain.iter().any(|(name, _)| name == "premium_potato"));
    assert!(uncertain.iter().any(|(name, _)| name == "quick_agave"));
}

#[test]
fn hammock_rosters_use_product_specific_families() {
    let items = data::load_all_data(Path::new("data")).unwrap();
    let requirements = data::load_aniimo_requirements(Path::new("data")).unwrap();
    let steps = data::load_grower_steps(Path::new("data")).unwrap();
    let star = items.iter().find(|i| i.name == "star").unwrap();
    let cap = items.iter().find(|i| i.name == "gold_speck_cap").unwrap();
    let person = |family: &str| RosterAniimo { count: 1, family: Some(family.into()),
        abilities: [("Leisure".into(), 3)].into_iter().collect(), personalities: vec![] };
    let crew = Crew { members: vec![person("Celestis"), person("Coinwisp")], ..Default::default() };
    assert_eq!(recipe_family(&star.facility, &star.name), Some("Celestis"));
    assert_eq!(recipe_family(&cap.facility, &cap.name), Some("Coinwisp"));
    assert!(crew.members[0].can_work_on(star));
    assert!(!crew.members[0].can_work_on(cap));
    assert!(crew.members[1].can_work_on(cap));
    assert!(!crew.members[1].can_work_on(star));
    assert_eq!(recipe_family("Starfall Hammock", "gold_speck_cap__uncovered__by1"), Some("Coinwisp"));
    let variants = crew_variants(vec![star.clone(), cap.clone()], &crew, &requirements, &steps);
    assert!(variants.iter().any(|i| i.name == "star__by0"));
    assert!(variants.iter().any(|i| i.name == "gold_speck_cap__by1"));
    assert!(!variants.iter().any(|i| i.name == "star__by1" || i.name == "gold_speck_cap__by0"));
}
