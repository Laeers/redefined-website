// Forklaringer på handling.meta-felter (dansk) + hvilke felter "topfart" rører.
// Bruges til klikbare tooltips på bil-tuning-siden.

export interface HandlingTerm {
  key: string; // kolonne i vehicle_tuning
  meta: string; // handling.meta-felt
  label: string;
  unit?: string;
  explain: string;
  affectsTopSpeed?: boolean;
}

export const HANDLING_TERMS: Record<string, HandlingTerm> = {
  flat_vel: {
    key: "flat_vel",
    meta: "fInitialDriveMaxFlatVel",
    label: "Topfart-cap",
    explain:
      "Den hårde øvre fartgrænse motoren kan trække bilen til. Hæves = højere mulig topfart. Den faktiske km/t afhænger også af drag og motorkraft.",
    affectsTopSpeed: true,
  },
  drive_force: {
    key: "drive_force",
    meta: "fInitialDriveForce",
    label: "Motorkraft / accel",
    explain:
      "Hvor hårdt motoren skubber. Højere = hurtigere acceleration OG hjælper bilen med at nå sin topfart-cap. Skaleres automatisk når du ændrer topfart.",
    affectsTopSpeed: true,
  },
  drive_inertia: {
    key: "drive_inertia",
    meta: "fDriveInertia",
    label: "Motor-inerti",
    explain:
      "Hvor hurtigt motoren spinder op i omdrejninger. Lav = snappy/hurtigt gasrespons, høj = tungere/langsommere opspin.",
  },
  gears: {
    key: "gears",
    meta: "nInitialDriveGears",
    label: "Antal gear",
    explain:
      "Antal gear. Flere gear = jævnere kraftlevering og typisk lidt højere topfart-potentiale.",
    affectsTopSpeed: true,
  },
  drive_bias_front: {
    key: "drive_bias_front",
    meta: "fDriveBiasFront",
    label: "Træk (for/bag)",
    explain:
      "Hvordan kraften fordeles: 0.0 = baghjulstræk (RWD), 1.0 = forhjulstræk (FWD), 0.5 = firehjulstræk (AWD). Påvirker hjulspin og hvordan bilen styrer under acceleration.",
  },
  brake_force: {
    key: "brake_force",
    meta: "fBrakeForce",
    label: "Bremsekraft",
    explain: "Hvor kraftigt bilen bremser. Højere = kortere bremselængde.",
  },
  brake_bias_front: {
    key: "brake_bias_front",
    meta: "fBrakeBiasFront",
    label: "Bremsebalance",
    explain:
      "Fordeling af bremsekraft for/bag (0.5 = lige). Over 0.5 = mere foran (stabilt), under = mere bagpå (kan låse baghjul/dreje).",
  },
  handbrake_force: {
    key: "handbrake_force",
    meta: "fHandBrakeForce",
    label: "Håndbremse",
    explain: "Styrken af håndbremsen — relevant for drift/skarpe sving.",
  },
  traction_max: {
    key: "traction_max",
    meta: "fTractionCurveMax",
    label: "Vejgreb (maks)",
    explain:
      "Maksimalt sidegreb i sving ved optimal fart. Højere = bedre kurvegreb og mindre udskridning.",
  },
  traction_curve_min: {
    key: "traction_curve_min",
    meta: "fTractionCurveMin",
    label: "Vejgreb (høj fart)",
    explain:
      "Greb ved høj fart (over optimum). Tæt på maks = bilen holder grebet i høje hastigheder.",
  },
  traction_bias_front: {
    key: "traction_bias_front",
    meta: "fTractionBiasFront",
    label: "Grebsbalance",
    explain:
      "Grebsfordeling for/bag (0.5 = neutral). Over 0.5 = mere greb foran (understyring), under = mere bagpå (overstyring/hækken slår ud).",
  },
  steering_lock: {
    key: "steering_lock",
    meta: "fSteeringLock",
    label: "Ratudslag",
    explain: "Hvor langt forhjulene kan dreje. Højere = skarpere styring.",
  },
  traction_loss_mult: {
    key: "traction_loss_mult",
    meta: "fTractionLossMult",
    label: "Grebstab (underlag)",
    explain:
      "Hvor meget greb tabes på dårligt underlag (græs/grus/vådt). Lavere = bilen klarer sig bedre off-road.",
  },
  low_speed_traction_loss: {
    key: "low_speed_traction_loss",
    meta: "fLowSpeedTractionLossMult",
    label: "Hjulspin (lav fart)",
    explain:
      "Hvor meget hjulspin ved lav fart / udkørsel. Højere = mere spin når man giver gas fra stilstand.",
  },
  drag: {
    key: "drag",
    meta: "fInitialDragCoeff",
    label: "Luftmodstand (drag)",
    explain:
      "Aerodynamisk modstand. Højere drag = bilen når en lavere reel topfart selv med samme cap. Bruges i omregningen fra topfart til cap.",
    affectsTopSpeed: true,
  },
  mass: {
    key: "mass",
    meta: "fMass",
    label: "Vægt (kg)",
    unit: "kg",
    explain:
      "Bilens masse. Tungere = langsommere accel og bremsning, men vinder kollisioner og er mere stabil.",
  },
};

export const TOP_SPEED_EXPLAINER =
  'Når du ændrer "Topfart (km/t)" og trykker Apply, beregner Claude en ny ' +
  "fInitialDriveMaxFlatVel (topfart-cap) = km/t × √drag ÷ 3.572, og skalerer " +
  "fInitialDriveForce (motorkraft) tilsvarende, så bilen faktisk kan nå farten. " +
  "Luftmodstand (drag) bestemmer hvor høj cap der kræves. Gear, inerti og vægt " +
  "påvirker hvor hurtigt den når derop, men ændres ikke automatisk.";

export const HANDLING_FIELD_ORDER: string[] = [
  "flat_vel",
  "drive_force",
  "drive_inertia",
  "gears",
  "drive_bias_front",
  "brake_force",
  "brake_bias_front",
  "handbrake_force",
  "traction_max",
  "traction_curve_min",
  "traction_bias_front",
  "steering_lock",
  "traction_loss_mult",
  "low_speed_traction_loss",
  "drag",
  "mass",
];
