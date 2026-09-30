// App language (Settings → Taal / Language). Every translatable string is
// one key with its five versions, always in the order nl, en, fr, de, es.
// Components call t('key', { vars }) from the useT() hook; dates use the
// matching Intl locale. Missing keys fall back to Dutch, then the key.
//
// Coverage: tab pages, menu, coach, companion, settings basics. Menu
// sub-pages that aren't wired to t() yet still show their original text.

export const LANGUAGES = [
  { code: 'nl', label: 'Nederlands', locale: 'nl-NL', aiName: 'Dutch' },
  { code: 'en', label: 'English', locale: 'en-GB', aiName: 'English' },
  { code: 'fr', label: 'Français', locale: 'fr-FR', aiName: 'French' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE', aiName: 'German' },
  { code: 'es', label: 'Español', locale: 'es-ES', aiName: 'Spanish' },
]
const ORDER = LANGUAGES.map((l) => l.code)
export const DEFAULT_LANGUAGE = 'nl'

export function languageInfo(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0]
}

const S = {
  // ---- common
  'common.save': ['Opslaan', 'Save', 'Enregistrer', 'Speichern', 'Guardar'],
  'common.delete': ['Verwijderen', 'Delete', 'Supprimer', 'Löschen', 'Eliminar'],
  'common.clear': ['Wissen', 'Clear', 'Effacer', 'Leeren', 'Borrar'],
  'common.back': ['Terug', 'Back', 'Retour', 'Zurück', 'Atrás'],

  // ---- tabs
  'tab.overview': ['Vandaag', 'Today', "Aujourd'hui", 'Heute', 'Hoy'],
  'tab.water': ['Water', 'Water', 'Eau', 'Wasser', 'Agua'],
  'tab.sleep': ['Slaap', 'Sleep', 'Sommeil', 'Schlaf', 'Sueño'],
  'tab.workouts': ['Training', 'Training', 'Sport', 'Training', 'Entreno'],
  'tab.voeding': ['Voeding', 'Food', 'Repas', 'Essen', 'Comida'],

  // ---- greeting / overview
  'greet.morning': ['Goedemorgen', 'Good morning', 'Bonjour', 'Guten Morgen', 'Buenos días'],
  'greet.afternoon': ['Goedemiddag', 'Good afternoon', 'Bon après-midi', 'Guten Tag', 'Buenas tardes'],
  'greet.evening': ['Goedenavond', 'Good evening', 'Bonsoir', 'Guten Abend', 'Buenas noches'],
  'ov.trainingDay': ['trainingsdag', 'training day', "jour d'entraînement", 'Trainingstag', 'día de entreno'],
  'ov.restDay': ['rustdag', 'rest day', 'jour de repos', 'Ruhetag', 'día de descanso'],
  'ov.dayScore': ['Dagscore', 'Day score', 'Score du jour', 'Tagesscore', 'Puntuación del día'],
  'ov.tasksOf': ['{done} van {total} taken', '{done} of {total} tasks', '{done} sur {total} tâches', '{done} von {total} Aufgaben', '{done} de {total} tareas'],
  'ov.noTasks': ['Geen taken vandaag', 'No tasks today', "Pas de tâches aujourd'hui", 'Heute keine Aufgaben', 'Sin tareas hoy'],
  'ov.streakDays': ['{n} dagen op rij', '{n} days in a row', '{n} jours de suite', '{n} Tage in Folge', '{n} días seguidos'],
  'ov.streakDay': ['{n} dag op rij', '{n} day in a row', '{n} jour de suite', '{n} Tag in Folge', '{n} día seguido'],
  'ov.startStreak': ['Start je reeks', 'Start your streak', 'Lance ta série', 'Starte deine Serie', 'Empieza tu racha'],
  'ov.reachForStreak': ['Haal {pct}% voor je reeks', 'Reach {pct}% for your streak', 'Atteins {pct} % pour ta série', 'Schaffe {pct} % für deine Serie', 'Llega al {pct} % para tu racha'],
  'ov.speak': ['Inspreken', 'Speak', 'Parler', 'Sprechen', 'Hablar'],
  'ov.insights': ['Inzichten', 'Insights', 'Analyses', 'Einblicke', 'Perspectivas'],
  'ov.allInsights': ['Alle inzichten', 'All insights', 'Toutes les analyses', 'Alle Einblicke', 'Ver todas'],
  'ov.microHabit': ['Micro-gewoonte van vandaag', "Today's micro-habit", 'Micro-habitude du jour', 'Mini-Gewohnheit von heute', 'Microhábito de hoy'],
  'ov.chipAppt': ['+ Afspraak', '+ Appointment', '+ Rendez-vous', '+ Termin', '+ Cita'],
  'ov.chipMenu': ['Menu', 'Menu', 'Menu', 'Menü', 'Menú'],
  'ov.askCoach': ['Vraag je coach iets…', 'Ask your coach…', 'Demande à ton coach…', 'Frag deinen Coach…', 'Pregunta a tu coach…'],
  'ov.ask': ['Vraag', 'Ask', 'Demander', 'Fragen', 'Preguntar'],
  'stat.water': ['Water', 'Water', 'Eau', 'Wasser', 'Agua'],
  'stat.sleep': ['Slaap', 'Sleep', 'Sommeil', 'Schlaf', 'Sueño'],
  'stat.protein': ['Eiwit', 'Protein', 'Protéines', 'Eiweiß', 'Proteína'],
  'stat.of': ['van {x}', 'of {x}', 'sur {x}', 'von {x}', 'de {x}'],
  'stat.goal': ['doel {x}', 'goal {x}', 'objectif {x}', 'Ziel {x}', 'meta {x}'],
  'unit.h': ['u', 'h', 'h', 'Std', 'h'],

  // ---- tasks card
  'tasks.title': ['Vandaag', 'Today', "Aujourd'hui", 'Heute', 'Hoy'],
  'tasks.none': ['Nog geen taken ingesteld.', 'No tasks set up yet.', 'Aucune tâche configurée.', 'Noch keine Aufgaben eingerichtet.', 'Aún no hay tareas.'],
  'tasks.setup': ['Schema instellen', 'Set up schedule', 'Configurer', 'Plan einrichten', 'Configurar'],
  'tasks.showAll': ['Toon alle {n}', 'Show all {n}', 'Tout afficher ({n})', 'Alle {n} anzeigen', 'Ver las {n}'],
  'tasks.showLess': ['Minder tonen', 'Show less', 'Moins', 'Weniger anzeigen', 'Ver menos'],

  // ---- companion tile + page
  'comp.eyebrow': ['JE METGEZEL', 'YOUR COMPANION', 'TON COMPAGNON', 'DEIN BEGLEITER', 'TU COMPAÑERO'],
  'comp.phase': ['Fase {n} van {total} · {stage}', 'Stage {n} of {total} · {stage}', 'Phase {n} sur {total} · {stage}', 'Phase {n} von {total} · {stage}', 'Fase {n} de {total} · {stage}'],
  'comp.vitality': ['Vitaliteit: {x}', 'Vitality: {x}', 'Vitalité : {x}', 'Vitalität: {x}', 'Vitalidad: {x}'],
  'comp.pointsLeft': ['Nog {n} punten tot {next}', '{n} points to {next}', 'Encore {n} points avant {next}', 'Noch {n} Punkte bis {next}', 'Faltan {n} puntos para {next}'],
  'comp.fullyGrown': ['Volgroeid — hou het vol', 'Fully grown — keep it going', 'Pleinement grandi — continue', 'Ausgewachsen — bleib dran', 'Totalmente crecido — sigue así'],
  'comp.feeds': ['Wat {name} vandaag voedt', 'What feeds {name} today', "Ce qui nourrit {name} aujourd'hui", 'Was {name} heute nährt', 'Lo que alimenta a {name} hoy'],
  'comp.done': ['gedaan ✓', 'done ✓', 'fait ✓', 'erledigt ✓', 'hecho ✓'],
  'comp.planned': ['gepland {t}', 'planned {t}', 'prévu {t}', 'geplant {t}', 'previsto {t}'],
  'comp.notLogged': ['nog niet gelogd', 'not logged yet', 'pas encore noté', 'noch nicht erfasst', 'aún sin registrar'],
  'comp.meals': ['{a} / {b} maaltijden', '{a} / {b} meals', '{a} / {b} repas', '{a} / {b} Mahlzeiten', '{a} / {b} comidas'],
  'comp.logged': ['{n} gelogd', '{n} logged', '{n} notés', '{n} erfasst', '{n} registradas'],
  'comp.food': ['Voeding', 'Food', 'Repas', 'Essen', 'Comida'],
  'comp.change': ['Ander figuurtje kiezen', 'Choose another companion', 'Choisir un autre compagnon', 'Anderen Begleiter wählen', 'Elegir otro compañero'],
  'comp.chooseFirst': ['Kies eerst je figuurtje op Vandaag.', 'Choose your companion on Today first.', "Choisis d'abord ton compagnon sur Aujourd'hui.", 'Wähle zuerst deinen Begleiter unter Heute.', 'Primero elige tu compañero en Hoy.'],
  'comp.tap': ['Tik om te bekijken', 'Tap to view', 'Touche pour voir', 'Tippen zum Ansehen', 'Toca para ver'],

  // ---- food page
  'food.week': ['WEEK {w}', 'WEEK {w}', 'SEMAINE {w}', 'WOCHE {w}', 'SEMANA {w}'],
  'food.title': ['Jouw menu', 'Your menu', 'Ton menu', 'Dein Menü', 'Tu menú'],
  'food.carbs': ['Koolh.', 'Carbs', 'Glucides', 'Kohlenh.', 'Carbos'],
  'food.fat': ['Vet', 'Fat', 'Lipides', 'Fett', 'Grasa'],
  'food.slot.ontbijt': ['Ontbijt', 'Breakfast', 'Petit-déjeuner', 'Frühstück', 'Desayuno'],
  'food.slot.lunch': ['Lunch', 'Lunch', 'Déjeuner', 'Mittagessen', 'Almuerzo'],
  'food.slot.diner': ['Diner', 'Dinner', 'Dîner', 'Abendessen', 'Cena'],
  'food.slot.snack': ['Snack', 'Snack', 'Collation', 'Snack', 'Snack'],
  'food.swapped': ['GEWISSELD', 'SWAPPED', 'REMPLACÉ', 'GETAUSCHT', 'CAMBIADO'],
  'food.eatenTag': ['GEGETEN', 'EATEN', 'MANGÉ', 'GEGESSEN', 'COMIDO'],
  'food.estimating': ['Voedingswaarde schatten…', 'Estimating nutrition…', 'Estimation en cours…', 'Nährwerte werden geschätzt…', 'Estimando valores…'],
  'food.inHouse': ['In huis', 'In stock', 'À la maison', 'Zu Hause', 'En casa'],
  'food.missing': ['Mist {n}', 'Missing {n}', 'Manque {n}', 'Fehlt {n}', 'Faltan {n}'],
  'food.noShop': ['Niet naar de winkel?', "Can't go shopping?", 'Pas de courses ?', 'Nicht einkaufen?', '¿Sin ir a comprar?'],
  'food.shopping': ['Boodschappen', 'Shopping list', 'Courses', 'Einkaufsliste', 'Lista de compra'],
  'food.noMenu': ['Geen menu gepland voor deze dag.', 'No menu planned for this day.', 'Aucun menu prévu ce jour-là.', 'Für diesen Tag ist kein Menü geplant.', 'No hay menú para este día.'],
  'food.eat': ['Gegeten', 'Eaten', 'Mangé', 'Gegessen', 'Comido'],
  'food.notEaten': ['Toch niet gegeten', 'Not eaten after all', 'Finalement pas mangé', 'Doch nicht gegessen', 'Al final no comido'],
  'food.swap': ['Wisselen met iets uit mijn voorraad', 'Swap for something I have at home', "Remplacer par ce que j'ai", 'Mit etwas aus dem Vorrat tauschen', 'Cambiar por algo que tengo'],
  'food.allHome': ['Alles in huis', 'Everything in stock', 'Tout est à la maison', 'Alles zu Hause', 'Todo en casa'],
  'food.missingList': ['Mist nog: {x}', 'Still missing: {x}', 'Il manque : {x}', 'Es fehlt noch: {x}', 'Falta: {x}'],
  'food.noEstimate': ['Nog geen voedingswaarde bekend.', 'No nutrition estimate yet.', 'Pas encore de valeurs nutritionnelles.', 'Noch keine Nährwerte.', 'Aún sin valores nutricionales.'],
  'food.estimated': ['geschat', 'estimated', 'estimé', 'geschätzt', 'estimado'],

  // ---- training
  'tr.title': ['Training', 'Training', 'Entraînement', 'Training', 'Entrenamiento'],
  'tr.week': ['WEEK {n}', 'WEEK {n}', 'SEMAINE {n}', 'WOCHE {n}', 'SEMANA {n}'],
  'tr.phase1': ['OPBOUWFASE', 'BUILD PHASE', 'PHASE DE BASE', 'AUFBAUPHASE', 'FASE DE BASE'],
  'tr.phase2': ['PROGRESSIEFASE', 'PROGRESSION PHASE', 'PHASE DE PROGRESSION', 'PROGRESSIONSPHASE', 'FASE DE PROGRESIÓN'],
  'tr.phase3': ['INTENSIVERINGSFASE', 'INTENSITY PHASE', "PHASE D'INTENSITÉ", 'INTENSITÄTSPHASE', 'FASE DE INTENSIDAD'],
  'tr.thisWeekEyebrow': ['DEZE WEEK', 'THIS WEEK', 'CETTE SEMAINE', 'DIESE WOCHE', 'ESTA SEMANA'],
  'tr.prep': ['VOORBEREIDING', 'PREPARATION', 'PRÉPARATION', 'VORBEREITUNG', 'PREPARACIÓN'],
  'tr.today': ['Vandaag', 'Today', "Aujourd'hui", 'Heute', 'Hoy'],
  'tr.restChip': ['Vandaag · rustdag', 'Today · rest day', "Aujourd'hui · repos", 'Heute · Ruhetag', 'Hoy · descanso'],
  'tr.doneTag': ['gedaan ✓', 'done ✓', 'fait ✓', 'erledigt ✓', 'hecho ✓'],
  'tr.recovery': ['Herstel', 'Recovery', 'Récupération', 'Erholung', 'Recuperación'],
  'tr.recoveryText': ['Herstel hoort ook bij het plan.', 'Recovery is part of the plan too.', 'La récupération fait partie du plan.', 'Erholung gehört zum Plan.', 'Descansar también es parte del plan.'],
  'tr.min': ['{n} min', '{n} min', '{n} min', '{n} Min', '{n} min'],
  'tr.exercisesN': ['{n} oefeningen', '{n} exercises', '{n} exercices', '{n} Übungen', '{n} ejercicios'],
  'tr.start': ['Start', 'Start', 'Commencer', 'Start', 'Empezar'],
  'tr.view': ['Bekijk', 'View', 'Voir', 'Ansehen', 'Ver'],
  'tr.finishShort': ['Afronden', 'Finish', 'Terminer', 'Abschließen', 'Terminar'],
  'tr.doneBtn': ['Gedaan ✓', 'Done ✓', 'Fait ✓', 'Erledigt ✓', 'Hecho ✓'],
  'tr.minutes': ['minuten', 'minutes', 'minutes', 'Minuten', 'minutos'],
  'tr.kcal': ['kcal', 'kcal', 'kcal', 'kcal', 'kcal'],
  'tr.thisWeek': ['deze week', 'this week', 'cette semaine', 'diese Woche', 'esta semana'],
  'tr.weekTitle': ['Deze week', 'This week', 'Cette semaine', 'Diese Woche', 'Esta semana'],
  'tr.inARow': ['{n} op rij', '{n} in a row', '{n} de suite', '{n} in Folge', '{n} seguidos'],
  'tr.exercises': ['Oefeningen', 'Exercises', 'Exercices', 'Übungen', 'Ejercicios'],
  'tr.addExercise': ['+ Oefening toevoegen', '+ Add exercise', '+ Ajouter un exercice', '+ Übung hinzufügen', '+ Añadir ejercicio'],
  'tr.finish': ['Training afronden', 'Finish workout', "Terminer l'entraînement", 'Training abschließen', 'Terminar entreno'],
  'tr.finished': ['Afgerond', 'Completed', 'Terminé', 'Abgeschlossen', 'Completado'],
  'tr.version': ['Versie', 'Version', 'Version', 'Version', 'Versión'],
  'tr.tier.full': ['Volledig', 'Full', 'Complet', 'Voll', 'Completo'],
  'tr.tier.short': ['Kort', 'Short', 'Court', 'Kurz', 'Corto'],
  'tr.tier.survival': ['Mini', 'Mini', 'Mini', 'Mini', 'Mini'],
  'tr.feelBody': ['Hoe voelt je lichaam vandaag?', "How's your body feeling today?", 'Comment va ton corps aujourd\'hui ?', 'Wie fühlt sich dein Körper heute an?', '¿Cómo está tu cuerpo hoy?'],
  'tr.flagged': ['Aangegeven: {x}', 'Flagged: {x}', 'Signalé : {x}', 'Markiert: {x}', 'Marcado: {x}'],
  'tr.lowMotivation': ['Weinig motivatie vandaag', 'Low on motivation today', 'Peu de motivation aujourd\'hui', 'Heute wenig Motivation', 'Poca motivación hoy'],
  'tr.calendar': ['Agenda vandaag: {x}', "Today's calendar: {x}", "Agenda du jour : {x}", 'Kalender heute: {x}', 'Agenda de hoy: {x}'],
  'tr.cal.packed': ['vol', 'packed', 'chargé', 'voll', 'lleno'],
  'tr.cal.busy': ['druk', 'busy', 'occupé', 'beschäftigt', 'ocupado'],
  'tr.cal.light': ['rustig', 'light', 'léger', 'ruhig', 'tranquilo'],
  'tr.restTimer': ['Rusttimer starten', 'Start rest timer', 'Lancer le minuteur', 'Pausentimer starten', 'Iniciar descanso'],
  'tr.logWeight': ['Gewicht loggen', 'Log weight', 'Noter le poids', 'Gewicht erfassen', 'Registrar peso'],
  'tr.otherExercise': ['Andere oefening', 'Different exercise', 'Autre exercice', 'Andere Übung', 'Otro ejercicio'],
  'tr.rest': ['rust {x}', 'rest {x}', 'repos {x}', 'Pause {x}', 'descanso {x}'],
  'tr.best': ['beste {x}', 'best {x}', 'record {x}', 'Bestwert {x}', 'mejor {x}'],

  // ---- coach
  'coach.title': ['Je coach', 'Your coach', 'Ton coach', 'Dein Coach', 'Tu coach'],
  'coach.sub': ['Kent je schema, voeding en slaap', 'Knows your schedule, food and sleep', 'Connaît ton planning, tes repas et ton sommeil', 'Kennt deinen Plan, Essen und Schlaf', 'Conoce tu plan, comida y sueño'],
  'coach.hello': [
    'Hoi! Vraag me alles over je dag, je voeding of je training. Ik ken je schema, je voorraad en hoe je slaapt.',
    "Hi! Ask me anything about your day, food or training. I know your schedule, what's in your kitchen and how you sleep.",
    'Salut ! Pose-moi tes questions sur ta journée, tes repas ou ton entraînement. Je connais ton planning, tes provisions et ton sommeil.',
    'Hallo! Frag mich alles über deinen Tag, dein Essen oder dein Training. Ich kenne deinen Plan, deinen Vorrat und deinen Schlaf.',
    '¡Hola! Pregúntame lo que quieras sobre tu día, tu comida o tu entreno. Conozco tu plan, tu despensa y cómo duermes.',
  ],
  'coach.noKey': [
    'Hoi! Om met mij te kunnen chatten en praten heb ik je Claude-sleutel nodig. Plak hem hieronder — dat hoeft maar één keer op dit apparaat.',
    'Hi! To chat and talk with me I need your Claude key. Paste it below — only once on this device.',
    'Salut ! Pour discuter avec moi, il me faut ta clé Claude. Colle-la ci-dessous — une seule fois sur cet appareil.',
    'Hallo! Zum Chatten und Reden brauche ich deinen Claude-Schlüssel. Füge ihn unten ein — nur einmal auf diesem Gerät.',
    '¡Hola! Para hablar conmigo necesito tu clave de Claude. Pégala abajo — solo una vez en este dispositivo.',
  ],
  'coach.toSettings': ['Naar Instellingen', 'Go to Settings', 'Aller aux Réglages', 'Zu den Einstellungen', 'Ir a Ajustes'],
  'coach.thinking': ['Coach denkt na…', 'Coach is thinking…', 'Le coach réfléchit…', 'Coach denkt nach…', 'El coach está pensando…'],
  'coach.q.replan': ['Pas mijn dag aan', 'Adjust my day', 'Adapter ma journée', 'Tag anpassen', 'Ajustar mi día'],
  'coach.q.focus': ['Mijn focus vandaag', "Today's focus", 'Mon focus du jour', 'Mein Fokus heute', 'Mi enfoque de hoy'],
  'coach.q.focusAsk': ['Wat is vandaag mijn belangrijkste focus?', 'What should I focus on most today?', "Sur quoi dois-je me concentrer aujourd'hui ?", 'Worauf sollte ich mich heute konzentrieren?', '¿En qué debo centrarme hoy?'],
  'coach.q.week': ['Hoe gaat mijn week?', "How's my week going?", 'Comment se passe ma semaine ?', 'Wie läuft meine Woche?', '¿Cómo va mi semana?'],
  'coach.q.weekAsk': ['Hoe gaat mijn week tot nu toe?', 'How is my week going so far?', "Comment se passe ma semaine jusqu'ici ?", 'Wie läuft meine Woche bisher?', '¿Cómo va mi semana hasta ahora?'],
  'coach.q.snack': ['Snack-idee', 'Snack idea', 'Idée de collation', 'Snack-Idee', 'Idea de snack'],
  'coach.q.snackAsk': ['Welke snack past vandaag bij mijn doel en wat ik in huis heb?', 'Which snack fits my goal today with what I have at home?', "Quelle collation correspond à mon objectif avec ce que j'ai ?", 'Welcher Snack passt heute zu meinem Ziel und meinem Vorrat?', '¿Qué snack encaja hoy con mi objetivo y lo que tengo en casa?'],
  'coach.placeholder': ['Typ of spreek je bericht…', 'Type or speak your message…', 'Écris ou dicte ton message…', 'Nachricht tippen oder sprechen…', 'Escribe o dicta tu mensaje…'],
  'coach.send': ['Stuur', 'Send', 'Envoyer', 'Senden', 'Enviar'],
  'coach.talk': ['Praat met je coach', 'Talk to your coach', 'Parler à ton coach', 'Mit dem Coach sprechen', 'Habla con tu coach'],
  'coach.voiceOn': ['Coach praat terug: aan', 'Coach speaks replies: on', 'Le coach répond à voix haute : activé', 'Coach spricht Antworten: an', 'El coach responde en voz alta: activado'],
  'coach.voiceOff': ['Coach praat terug: uit', 'Coach speaks replies: off', 'Le coach répond à voix haute : désactivé', 'Coach spricht Antworten: aus', 'El coach responde en voz alta: desactivado'],
  'coach.readAloud': ['Voorlezen', 'Read aloud', 'Lire à voix haute', 'Vorlesen', 'Leer en voz alta'],
  'coach.listening': ['Ik luister…', "I'm listening…", "J'écoute…", 'Ich höre zu…', 'Te escucho…'],
  'coach.speaking': ['Coach praat… tik om te onderbreken', 'Coach is speaking… tap to interrupt', 'Le coach parle… touche pour interrompre', 'Coach spricht… tippen zum Unterbrechen', 'El coach habla… toca para interrumpir'],
  'coach.tapToTalk': ['Tik op de bol en praat', 'Tap the orb and talk', 'Touche la bulle et parle', 'Tippe auf die Kugel und sprich', 'Toca la esfera y habla'],
  'coach.stopTalk': ['Gesprek stoppen', 'End conversation', 'Terminer la conversation', 'Gespräch beenden', 'Terminar conversación'],

  // ---- water
  'water.title': ['Blijf gehydrateerd', 'Stay hydrated', 'Reste hydraté·e', 'Bleib hydriert', 'Mantente hidratado'],
  'water.of': ['van {goal} ml', 'of {goal} ml', 'sur {goal} ml', 'von {goal} ml', 'de {goal} ml'],
  'water.undo': ['Laatste ongedaan', 'Undo last', 'Annuler le dernier', 'Letztes rückgängig', 'Deshacer último'],
  'water.editGoal': ['Doel aanpassen', 'Edit goal', "Modifier l'objectif", 'Ziel ändern', 'Cambiar meta'],
  'water.clearToday': ['Vandaag wissen', 'Clear today', "Effacer aujourd'hui", 'Heute leeren', 'Borrar hoy'],
  'water.autopilot': ['Autopiloot', 'Autopilot', 'Pilote auto', 'Autopilot', 'Piloto automático'],
  'water.adjusted': ['Aangepast doel voor vandaag', "Today's adjusted target", 'Objectif ajusté du jour', 'Angepasstes Tagesziel', 'Meta ajustada de hoy'],
  'water.status.likely_low': ['Waarschijnlijk te weinig', 'Likely low', 'Probablement bas', 'Wahrscheinlich zu wenig', 'Probablemente bajo'],
  'water.status.slightly_low': ['Iets te weinig', 'Slightly low', 'Un peu bas', 'Etwas wenig', 'Algo bajo'],
  'water.status.on_track': ['Op schema', 'On track', 'En bonne voie', 'Im Plan', 'En camino'],
  'water.status.well_hydrated': ['Goed gehydrateerd', 'Well hydrated', 'Bien hydraté·e', 'Gut hydriert', 'Bien hidratado'],
  'water.status.overhydration': ['Rustig aan', 'Easy does it', 'Doucement', 'Langsam', 'Con calma'],
  'water.left': ['Nog {ml} ml te gaan vandaag — een glas nu helpt.', '{ml} ml to go today — a glass now helps.', "Encore {ml} ml aujourd'hui — un verre maintenant aide.", 'Noch {ml} ml heute — ein Glas jetzt hilft.', 'Faltan {ml} ml hoy — un vaso ahora ayuda.'],
  'water.reached': ['Doel gehaald — goed bezig!', 'Goal reached — nice work!', 'Objectif atteint — bravo !', 'Ziel erreicht — gut gemacht!', '¡Meta alcanzada, buen trabajo!'],
  'water.thisWeek': ['Deze week', 'This week', 'Cette semaine', 'Diese Woche', 'Esta semana'],
  'water.goalTitle': ['Dagelijks waterdoel', 'Daily water goal', "Objectif d'eau quotidien", 'Tägliches Wasserziel', 'Meta diaria de agua'],
  'water.goalLabel': ['Doel (ml)', 'Goal (ml)', 'Objectif (ml)', 'Ziel (ml)', 'Meta (ml)'],
  'water.saveGoal': ['Doel opslaan', 'Save goal', "Enregistrer l'objectif", 'Ziel speichern', 'Guardar meta'],
  'water.clearTitle': ['Water van vandaag wissen?', "Clear today's water?", "Effacer l'eau d'aujourd'hui ?", 'Heutiges Wasser leeren?', '¿Borrar el agua de hoy?'],
  'water.clearMsg': ['Het totaal van vandaag gaat terug naar 0 ml.', "This resets today's total to 0 ml.", "Le total du jour repasse à 0 ml.", 'Die heutige Menge wird auf 0 ml gesetzt.', 'El total de hoy vuelve a 0 ml.'],

  // ---- sleep
  'sleep.title': ['Rust & herstel', 'Rest & recovery', 'Repos & récupération', 'Ruhe & Erholung', 'Descanso y recuperación'],
  'sleep.ofGoal': ['van {h}u doel', 'of {h}h goal', 'sur {h} h', 'von {h} Std Ziel', 'de {h} h de meta'],
  'sleep.quality': ['Kwaliteit', 'Quality', 'Qualité', 'Qualität', 'Calidad'],
  'sleep.q1': ['Zwaar', 'Rough', 'Difficile', 'Schlecht', 'Mala'],
  'sleep.q2': ['Matig', 'Poor', 'Moyenne', 'Mäßig', 'Regular'],
  'sleep.q3': ['Oké', 'Okay', 'Correcte', 'Okay', 'Normal'],
  'sleep.q4': ['Goed', 'Good', 'Bonne', 'Gut', 'Buena'],
  'sleep.q5': ['Top', 'Great', 'Excellente', 'Super', 'Genial'],
  'sleep.log': ['Afgelopen nacht loggen', 'Log last night', 'Noter la nuit dernière', 'Letzte Nacht erfassen', 'Registrar anoche'],
  'sleep.edit': ['Afgelopen nacht aanpassen', 'Edit last night', 'Modifier la nuit dernière', 'Letzte Nacht bearbeiten', 'Editar anoche'],
  'sleep.sheetTitle': ['Slaap — {date}', 'Sleep — {date}', 'Sommeil — {date}', 'Schlaf — {date}', 'Sueño — {date}'],
  'sleep.hours': ['Uren geslapen', 'Hours slept', 'Heures dormies', 'Geschlafene Stunden', 'Horas dormidas'],
  'sleep.deleteEntry': ['Invoer verwijderen', 'Delete entry', "Supprimer l'entrée", 'Eintrag löschen', 'Eliminar registro'],
  'sleep.deleteTitle': ['Slaap van afgelopen nacht verwijderen?', "Delete last night's sleep?", 'Supprimer la nuit dernière ?', 'Letzte Nacht löschen?', '¿Eliminar el sueño de anoche?'],
  'sleep.deleteMsg': ['Je kunt het altijd opnieuw loggen.', 'You can log it again any time.', 'Tu peux la noter à nouveau à tout moment.', 'Du kannst sie jederzeit neu erfassen.', 'Puedes registrarlo de nuevo cuando quieras.'],
  'sleep.goalTitle': ['Slaapdoel', 'Sleep goal', 'Objectif de sommeil', 'Schlafziel', 'Meta de sueño'],
  'sleep.perNight': ['Uren per nacht', 'Hours per night', 'Heures par nuit', 'Stunden pro Nacht', 'Horas por noche'],

  // ---- streak badge
  'streak.none': ['Nog geen reeks', 'No streak yet', 'Pas encore de série', 'Noch keine Serie', 'Aún sin racha'],
  'streak.days': ['op rij', 'day streak', 'jours de suite', 'Tage in Folge', 'días seguidos'],

  // ---- menu
  'menuSection.0': ['Coach & begeleiding', 'Coach & guidance', 'Coach & conseils', 'Coach & Begleitung', 'Coach y guía'],
  'menuSection.1': ['Transformatieplan', 'Transformation plan', 'Plan de transformation', 'Transformationsplan', 'Plan de transformación'],
  'menuSection.2': ['Gezondheid & lichaam', 'Health & body', 'Santé & corps', 'Gesundheit & Körper', 'Salud y cuerpo'],
  'menuSection.3': ['Leven', 'Life', 'Vie', 'Leben', 'Vida'],
  'menuSection.4': ['Account', 'Account', 'Compte', 'Konto', 'Cuenta'],
  'menu.coach': ['Coach', 'Coach', 'Coach', 'Coach', 'Coach'],
  'menu.gps': ['Lifestyle GPS', 'Lifestyle GPS', 'GPS lifestyle', 'Lifestyle-GPS', 'GPS de estilo de vida'],
  'menu.contracts': ['Gewoontecontracten', 'Habit contracts', "Contrats d'habitudes", 'Gewohnheitsverträge', 'Contratos de hábitos'],
  'menu.insights': ['Inzichten', 'Insights', 'Analyses', 'Einblicke', 'Perspectivas'],
  'menu.dailyschedule': ['Dagschema & menu', 'Daily schedule & menu', 'Planning & menu', 'Tagesplan & Menü', 'Horario y menú'],
  'menu.pantry': ['Voorraad & menu', 'Pantry & menu', 'Provisions & menu', 'Vorrat & Menü', 'Despensa y menú'],
  'menu.weeklyprogress': ['Voortgang', 'Progress', 'Progrès', 'Fortschritt', 'Progreso'],
  'menu.companion': ['Je figuurtje', 'Your companion', 'Ton compagnon', 'Dein Begleiter', 'Tu compañero'],
  'menu.photos': ["Voortgangsfoto's", 'Progress photos', 'Photos de progrès', 'Fortschrittsfotos', 'Fotos de progreso'],
  'menu.weight': ['Gewicht', 'Weight', 'Poids', 'Gewicht', 'Peso'],
  'menu.mood': ['Stemming', 'Mood', 'Humeur', 'Stimmung', 'Ánimo'],
  'menu.nutrition': ['Voedingslog', 'Nutrition log', 'Journal alimentaire', 'Ernährungslog', 'Registro de comidas'],
  'menu.recipes': ['Recepten', 'Recipes', 'Recettes', 'Rezepte', 'Recetas'],
  'menu.cycle': ['Cyclus', 'Cycle', 'Cycle', 'Zyklus', 'Ciclo'],
  'menu.alcohol': ['Alcohol', 'Alcohol', 'Alcool', 'Alkohol', 'Alcohol'],
  'menu.budget': ['Budget', 'Budget', 'Budget', 'Budget', 'Presupuesto'],
  'menu.schedule': ['Planning', 'Schedule', 'Agenda', 'Termine', 'Agenda'],
  'menu.notes': ['Notities', 'Notes', 'Notes', 'Notizen', 'Notas'],
  'menu.badges': ['Badges & level', 'Badges & level', 'Badges & niveau', 'Abzeichen & Level', 'Insignias y nivel'],
  'menu.coachsettings': ['Je coach instellen', 'Your coach', 'Ton coach', 'Dein Coach', 'Tu coach'],
  'menu.settings': ['Instellingen', 'Settings', 'Réglages', 'Einstellungen', 'Ajustes'],

  // ---- settings
  'set.title': ['Instellingen', 'Settings', 'Réglages', 'Einstellungen', 'Ajustes'],
  'set.language': ['Taal', 'Language', 'Langue', 'Sprache', 'Idioma'],
  'set.color': ['Kleur', 'Colour', 'Couleur', 'Farbe', 'Color'],
  'set.name': ['Je naam', 'Your name', 'Ton prénom', 'Dein Name', 'Tu nombre'],
  'set.namePh': ['Voor de begroeting op Vandaag', 'For the greeting on Today', "Pour le message d'accueil", 'Für die Begrüßung unter Heute', 'Para el saludo en Hoy'],
  'theme.paars': ['Paars', 'Purple', 'Violet', 'Lila', 'Morado'],
  'theme.warm': ['Warm', 'Warm', 'Chaud', 'Warm', 'Cálido'],
  'theme.neon': ['Neon', 'Neon', 'Néon', 'Neon', 'Neón'],
}

// Companion names/conditions — lists per language, same order as ORDER.
export const ARCHETYPE_NAMES = {
  warrior: ['Strijder', 'Warrior', 'Guerrier', 'Krieger', 'Guerrero'],
  nature: ['Natuurwezen', 'Nature spirit', 'Esprit nature', 'Naturwesen', 'Ser natural'],
  fire: ['Vuur', 'Fire', 'Feu', 'Feuer', 'Fuego'],
  moon: ['Maan', 'Moon', 'Lune', 'Mond', 'Luna'],
  robot: ['Robot', 'Robot', 'Robot', 'Roboter', 'Robot'],
  animal: ['Vos', 'Fox', 'Renard', 'Fuchs', 'Zorro'],
  plant: ['Plant', 'Plant', 'Plante', 'Pflanze', 'Planta'],
  dragon: ['Draak', 'Dragon', 'Dragon', 'Drache', 'Dragón'],
  spirit: ['Geest', 'Spirit', 'Esprit', 'Geist', 'Espíritu'],
  athlete: ['Komeet', 'Comet', 'Comète', 'Komet', 'Cometa'],
}
export const CONDITION_NAMES = {
  newbond: ['nieuwe band', 'new bond', 'nouveau lien', 'neues Band', 'nuevo vínculo'],
  depleted: ['uitgeput', 'depleted', 'épuisé', 'erschöpft', 'agotado'],
  fatigued: ['moe', 'tired', 'fatigué', 'müde', 'cansado'],
  overextended: ['overbelast', 'overextended', 'surmené', 'überlastet', 'sobrecargado'],
  roughpatch: ['zware periode', 'rough patch', 'passage difficile', 'schwere Phase', 'mala racha'],
  underhydrated: ['dorstig', 'thirsty', 'assoiffé', 'durstig', 'sediento'],
  underfueled: ['hongerig', 'underfuelled', 'affamé', 'hungrig', 'hambriento'],
  underrested: ['slaperig', 'sleepy', 'somnolent', 'schläfrig', 'somnoliento'],
  undermoved: ['stilzittend', 'restless', 'sédentaire', 'bewegungsarm', 'sedentario'],
  recovering: ['herstellend', 'recovering', 'en récupération', 'erholt sich', 'recuperándose'],
  balanced: ['in balans', 'balanced', 'équilibré', 'ausgeglichen', 'equilibrado'],
  energized: ['energiek', 'energised', 'énergique', 'energiegeladen', 'con energía'],
  thriving: ['bloeiend', 'thriving', 'épanoui', 'aufblühend', 'floreciente'],
  radiant: ['stralend', 'radiant', 'rayonnant', 'strahlend', 'radiante'],
}

export function pick(list, lang) {
  const i = ORDER.indexOf(lang)
  return list?.[i >= 0 ? i : 0] ?? list?.[0]
}

export function translate(lang, key, vars) {
  const entry = S[key]
  let text = entry ? (pick(entry, lang) ?? entry[0]) : key
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
  return text
}
