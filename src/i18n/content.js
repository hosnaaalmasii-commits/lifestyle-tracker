// Translations for *content* (not UI chrome): the task labels seeded from
// the transformation plan and the companions' stage names. Same order as
// i18n/index.js: nl, en, fr, de, es. Anything not listed here (meals,
// exercises, tasks the user typed) goes through the cached AI translation
// in useContentT().

export const TASK_LABELS = {
  'Ontbijt': ['Ontbijt', 'Breakfast', 'Petit-déjeuner', 'Frühstück', 'Desayuno'],
  'Snack 1 + IJzer-supplement': ['Snack 1 + ijzersupplement', 'Snack 1 + iron supplement', 'Collation 1 + supplément de fer', 'Snack 1 + Eisenpräparat', 'Snack 1 + suplemento de hierro'],
  'Lunch': ['Lunch', 'Lunch', 'Déjeuner', 'Mittagessen', 'Almuerzo'],
  'Snack 2': ['Snack 2', 'Snack 2', 'Collation 2', 'Snack 2', 'Snack 2'],
  'Diner': ['Diner', 'Dinner', 'Dîner', 'Abendessen', 'Cena'],
  'Training: Lower Body A (glutes/hamstrings) + 15min cardio': [
    'Training: onderlichaam A (billen/hamstrings) + 15 min cardio',
    'Workout: Lower Body A (glutes/hamstrings) + 15 min cardio',
    'Entraînement : bas du corps A (fessiers/ischios) + 15 min de cardio',
    'Training: Unterkörper A (Po/Beinbeuger) + 15 Min. Cardio',
    'Entreno: tren inferior A (glúteos/isquios) + 15 min de cardio',
  ],
  'Training: Upper Body & Core + 15min cardio': [
    'Training: bovenlichaam & core + 15 min cardio',
    'Workout: Upper Body & Core + 15 min cardio',
    'Entraînement : haut du corps & gainage + 15 min de cardio',
    'Training: Oberkörper & Core + 15 Min. Cardio',
    'Entreno: tren superior y core + 15 min de cardio',
  ],
  'Training: Lower Body B (glutes/quads)': [
    'Training: onderlichaam B (billen/quadriceps)',
    'Workout: Lower Body B (glutes/quads)',
    'Entraînement : bas du corps B (fessiers/quadriceps)',
    'Training: Unterkörper B (Po/Oberschenkel)',
    'Entreno: tren inferior B (glúteos/cuádriceps)',
  ],
  'Training: Full Body/Upper + 20min cardio': [
    'Training: full body/bovenlichaam + 20 min cardio',
    'Workout: Full Body/Upper + 20 min cardio',
    'Entraînement : corps complet/haut + 20 min de cardio',
    'Training: Ganzkörper/Oberkörper + 20 Min. Cardio',
    'Entreno: cuerpo completo/superior + 20 min de cardio',
  ],
  'Training: Cardio + glutes-circuit (lang)': [
    'Training: cardio + billencircuit (lang)',
    'Workout: Cardio + glute circuit (long)',
    'Entraînement : cardio + circuit fessiers (long)',
    'Training: Cardio + Po-Zirkel (lang)',
    'Entreno: cardio + circuito de glúteos (largo)',
  ],
  'Cardio (ochtend, 30-40min)': ['Cardio (ochtend, 30-40 min)', 'Cardio (morning, 30-40 min)', 'Cardio (matin, 30-40 min)', 'Cardio (morgens, 30-40 Min.)', 'Cardio (mañana, 30-40 min)'],
  'Cardio + Mobility & Pilates': ['Cardio + mobiliteit & pilates', 'Cardio + mobility & Pilates', 'Cardio + mobilité & Pilates', 'Cardio + Mobilität & Pilates', 'Cardio + movilidad y pilates'],
  'Stretchroutine 10-15min': ['Stretchroutine 10-15 min', 'Stretching routine 10-15 min', 'Étirements 10-15 min', 'Dehnroutine 10-15 Min.', 'Estiramientos 10-15 min'],
  'Supplement: Zink': ['Supplement: zink', 'Supplement: zinc', 'Complément : zinc', 'Nahrungsergänzung: Zink', 'Suplemento: zinc'],
  'Supplement: Magnesium': ['Supplement: magnesium', 'Supplement: magnesium', 'Complément : magnésium', 'Nahrungsergänzung: Magnesium', 'Suplemento: magnesio'],
  'Supplement: Zink + Magnesium': ['Supplement: zink + magnesium', 'Supplement: zinc + magnesium', 'Complément : zinc + magnésium', 'Nahrungsergänzung: Zink + Magnesium', 'Suplemento: zinc + magnesio'],
  'Diner (voor flexijob)': ['Diner (voor flexijob)', 'Dinner (before side job)', 'Dîner (avant le job)', 'Abendessen (vor dem Nebenjob)', 'Cena (antes del trabajo)'],
  'Flexijob 18:00-22:00': ['Flexijob 18:00-22:00', 'Side job 18:00-22:00', 'Job 18:00-22:00', 'Nebenjob 18:00-22:00', 'Trabajo 18:00-22:00'],
  'Zelfzorg: massage/verzorging/meditatie': ['Zelfzorg: massage/verzorging/meditatie', 'Self-care: massage/grooming/meditation', 'Soin de soi : massage/soins/méditation', 'Selbstfürsorge: Massage/Pflege/Meditation', 'Autocuidado: masaje/cuidado/meditación'],
  'Zelfzorg / vrije tijd': ['Zelfzorg / vrije tijd', 'Self-care / free time', 'Soin de soi / temps libre', 'Selbstfürsorge / Freizeit', 'Autocuidado / tiempo libre'],
}

export const STAGE_NAMES = {
  fire: [['Vonk', 'Spark', 'Étincelle', 'Funke', 'Chispa'], ['Aanwakkeren', 'Kindle', 'Braise', 'Glut', 'Brasa'], ['Opvlammen', 'Rise', 'Flamme', 'Auflodern', 'Llama'], ['Laaiend', 'Flourish', 'Brasier', 'Lodern', 'Hoguera'], ['Stralend', 'Radiant', 'Rayonnant', 'Strahlend', 'Radiante']],
  moon: [['Nieuwe maan', 'New Moon', 'Nouvelle lune', 'Neumond', 'Luna nueva'], ['Wassende sikkel', 'Waxing Crescent', 'Premier croissant', 'Zunehmende Sichel', 'Creciente'], ['Eerste kwartier', 'First Quarter', 'Premier quartier', 'Erstes Viertel', 'Cuarto creciente'], ['Wassende maan', 'Waxing Gibbous', 'Lune gibbeuse', 'Zunehmender Mond', 'Gibosa creciente'], ['Volle maan', 'Full Moon', 'Pleine lune', 'Vollmond', 'Luna llena']],
  warrior: [['Ruw staal', 'Raw Steel', 'Acier brut', 'Rohstahl', 'Acero bruto'], ['Gesmeed', 'Forged', 'Forgé', 'Geschmiedet', 'Forjado'], ['Gehard', 'Tempered', 'Trempé', 'Gehärtet', 'Templado'], ['Geslepen', 'Honed', 'Aiguisé', 'Geschliffen', 'Afilado'], ['Meesterwerk', 'Masterwork', "Chef-d'œuvre", 'Meisterwerk', 'Obra maestra']],
  nature: [['Kiemplant', 'Seedling', 'Semis', 'Keimling', 'Plántula'], ['Jong boompje', 'Sapling', 'Jeune arbre', 'Setzling', 'Arbolito'], ['Uitlopend', 'Sprouting', 'Bourgeonnant', 'Austreibend', 'Brotando'], ['Bloeiend', 'Flourishing', 'Florissant', 'Blühend', 'Floreciente'], ['Eeuwenoud', 'Ancient Growth', 'Arbre ancien', 'Uralter Baum', 'Árbol ancestral']],
  robot: [['Slapend', 'Dormant', 'En veille', 'Ruhend', 'En reposo'], ['In opbouw', 'Assembling', 'Assemblage', 'Im Aufbau', 'Ensamblando'], ['Kalibreren', 'Calibrating', 'Calibrage', 'Kalibrierung', 'Calibrando'], ['Online', 'Online', 'En ligne', 'Online', 'En línea'], ['Volledig geladen', 'Fully Charged', 'Pleine charge', 'Voll geladen', 'Carga completa']],
  animal: [['Welp', 'Kit', 'Renardeau', 'Welpe', 'Cachorro'], ['Jonkie', 'Cub', 'Petit', 'Jungtier', 'Cría'], ['Eenjarige', 'Yearling', "D'un an", 'Jährling', 'De un año'], ['Volwassen', 'Grown', 'Adulte', 'Ausgewachsen', 'Adulto'], ['Alfa', 'Alpha', 'Alpha', 'Alpha', 'Alfa']],
  plant: [['Zaadje', 'Seed', 'Graine', 'Samen', 'Semilla'], ['Scheut', 'Sprout', 'Pousse', 'Spross', 'Brote'], ['Knop', 'Bud', 'Bouton', 'Knospe', 'Capullo'], ['Bloesem', 'Blossom', 'Fleur', 'Blüte', 'Flor'], ['Volle bloei', 'Full Bloom', 'Pleine floraison', 'Volle Blüte', 'Plena floración']],
  dragon: [['Ei', 'Egg', 'Œuf', 'Ei', 'Huevo'], ['Kuiken', 'Hatchling', 'Nouveau-né', 'Schlüpfling', 'Recién nacido'], ['Jonge draak', 'Fledgling', 'Jeune dragon', 'Jungdrache', 'Dragón joven'], ['Tiener', 'Adolescent', 'Adolescent', 'Heranwachsend', 'Adolescente'], ['Oeroude draak', 'Elder Wyrm', 'Dragon ancestral', 'Uralter Drache', 'Dragón ancestral']],
  spirit: [['Flikkering', 'Flicker', 'Lueur', 'Flackern', 'Parpadeo'], ['Dwaallicht', 'Wisp', 'Feu follet', 'Irrlicht', 'Fuego fatuo'], ['Glinstering', 'Glimmer', 'Scintillement', 'Schimmer', 'Destello'], ['Aura', 'Aura', 'Aura', 'Aura', 'Aura'], ['Lichtend', 'Luminous', 'Lumineux', 'Leuchtend', 'Luminoso']],
  athlete: [['Eerste pas', 'First Stride', 'Premier pas', 'Erster Schritt', 'Primer paso'], ['Tempo opbouwen', 'Building Pace', 'Prise de rythme', 'Tempo aufbauen', 'Cogiendo ritmo'], ['Volle pas', 'Full Stride', 'Pleine foulée', 'Voller Schritt', 'Zancada plena'], ['Sprint', 'Sprint', 'Sprint', 'Sprint', 'Sprint'], ['Topvorm', 'Peak Form', 'Forme optimale', 'Höchstform', 'Forma máxima']],
}
