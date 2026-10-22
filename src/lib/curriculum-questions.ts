/**
 * Ethiopian MoE Curriculum-Specific Question Bank
 * Subject-specific, grade-appropriate multiple-choice questions
 * aligned with the official textbooks and learning outcomes.
 */

export type QuestionTemplate = {
  prompt: string;
  correct: string;
  distractors: [string, string, string];
  explanation: string;
};

// Subject-specific question generators keyed by subject code/name
export const SUBJECT_QUESTION_BANKS: Record<string, (topic: string, unit: string, grade: string) => QuestionTemplate[]> = {

  Mathematics: (topic, unit, grade) => [
    {
      prompt: `In the ${grade} Mathematics curriculum, which statement best describes the concept of "${topic}"?`,
      correct: `A systematic mathematical process that applies number properties, operations, or geometric reasoning to solve problems related to ${topic}.`,
      distractors: [
        `A purely memorization-based technique with no logical steps or mathematical reasoning.`,
        `A method used only in advanced university-level mathematics, not applicable to ${grade}.`,
        `An incorrect estimate that contradicts the basic axioms of arithmetic and geometry.`,
      ],
      explanation: `${topic} in ${unit} requires applying structured mathematical thinking consistent with the ${grade} Ethiopian Mathematics curriculum.`,
    },
    {
      prompt: `A student is solving a problem about "${topic}". Which approach follows the correct mathematical procedure?`,
      correct: `Identify the given values, select the appropriate formula or operation, perform calculations step by step, and verify the result against the original conditions.`,
      distractors: [
        `Guess the answer and work backwards without checking any steps.`,
        `Memorize the answer from a previous problem and apply it regardless of the new values.`,
        `Skip calculations and estimate based on intuition alone.`,
      ],
      explanation: `The systematic problem-solving approach (understand, plan, execute, verify) is the foundation of the ${grade} Mathematics curriculum for topics like ${topic}.`,
    },
    {
      prompt: `Which real-world application is most directly connected to the study of "${topic}" in ${unit}?`,
      correct: `Everyday activities such as measuring land, budgeting money (Birr/Santim), calculating distances between towns, or designing patterns, all depend on understanding ${topic}.`,
      distractors: [
        `It has no practical real-world application and is studied purely for academic purposes.`,
        `It is only useful for scientists and engineers, not for ordinary Ethiopian students.`,
        `It only applies when using expensive computer software, not in manual calculations.`,
      ],
      explanation: `The Ethiopian Mathematics curriculum at ${grade} level emphasizes real-world connections, and ${topic} is applied in daily life contexts familiar to students.`,
    },
  ],

  English: (topic, unit, grade) => [
    {
      prompt: `In the "${topic}" lesson from ${unit}, which language skill is primarily being developed?`,
      correct: `The integrated communication skill — combining listening, speaking, reading, and writing — in authentic, contextually meaningful situations related to ${topic}.`,
      distractors: [
        `Only rote memorization of word lists and grammar rules without any communicative context.`,
        `Advanced literary analysis techniques appropriate only for university-level English courses.`,
        `Translation of all content into Amharic without practicing English communication at all.`,
      ],
      explanation: `The Ethiopian English curriculum at ${grade} level uses communicative language teaching, developing integrated language skills through topics like ${topic}.`,
    },
    {
      prompt: `A teacher is teaching "${topic}" to ${grade} students. Which activity best supports active learning of this language concept?`,
      correct: `Role-play, pair-work discussions, or story retelling activities where students actively use the target language and vocabulary related to ${topic}.`,
      distractors: [
        `Having students silently copy grammar rules from the board for the entire lesson.`,
        `Playing a film in a foreign language unrelated to the lesson topic.`,
        `Testing students on advanced vocabulary words beyond the ${grade} curriculum scope.`,
      ],
      explanation: `Active, student-centered language activities promote deeper learning of English skills at the ${grade} level, making topics like ${topic} meaningful.`,
    },
    {
      prompt: `Which vocabulary or grammar point would students encounter while studying "${topic}" in ${unit}?`,
      correct: `Grade-appropriate vocabulary, sentence patterns, and communication functions specifically matched to the ${topic} context and ${grade} level proficiency expectations.`,
      distractors: [
        `Complex academic vocabulary intended for post-secondary students.`,
        `Grammar structures from a completely different language (e.g., French or German grammar).`,
        `Vocabulary from unrelated subject areas not connected to ${topic} or the unit theme.`,
      ],
      explanation: `The English textbook for ${grade} carefully sequences vocabulary and grammar tied to each unit theme, ensuring ${topic} is taught at the right level.`,
    },
  ],

  Physics: (topic, unit, grade) => [
    {
      prompt: `Which of the following best describes the principle behind "${topic}" as studied in ${grade} Physics?`,
      correct: `A measurable physical phenomenon governed by specific laws (such as Newton's Laws, conservation principles, or wave equations) that can be verified through observation and experiment.`,
      distractors: [
        `A philosophical concept that cannot be measured, tested, or verified through experiment.`,
        `A purely mathematical abstraction with no correspondence to physical reality or observable phenomena.`,
        `A historical theory completely replaced by modern quantum mechanics and no longer relevant to ${grade}.`,
      ],
      explanation: `${topic} in ${grade} Physics is a core scientific concept grounded in measurable, observable evidence and fundamental physical laws.`,
    },
    {
      prompt: `During a practical experiment on "${topic}", which step is most critical to ensure accurate results?`,
      correct: `Controlling variables: keeping all other factors constant while changing only the one being investigated, recording measurements in correct SI units, and repeating trials for reliability.`,
      distractors: [
        `Performing the experiment only once and accepting the first result without checking for errors.`,
        `Estimating all measurements visually without using any measuring instruments.`,
        `Using non-standard units of measurement and not converting to SI units at the end.`,
      ],
      explanation: `Scientific experimental design for ${topic} requires controlled variables, accurate measurements in SI units, and repeated trials to ensure validity.`,
    },
    {
      prompt: `How does understanding "${topic}" connect to real-world technology and everyday life in Ethiopia?`,
      correct: `${topic} principles are applied in engineering, construction, electricity generation (hydroelectric dams), transportation, and medical devices — all critical to Ethiopia's development.`,
      distractors: [
        `${topic} has no practical application outside of academic physics laboratories.`,
        `It is only relevant to astronauts and space scientists, not to everyday Ethiopian life.`,
        `Understanding ${topic} is useful only if students plan to study abroad in foreign universities.`,
      ],
      explanation: `Physics concepts like ${topic} underpin Ethiopia's infrastructure, energy sector, and technological development — connecting classroom learning to national progress.`,
    },
  ],

  Chemistry: (topic, unit, grade) => [
    {
      prompt: `What is the fundamental chemical principle that explains "${topic}" as covered in ${grade} Chemistry?`,
      correct: `The interaction of atoms and molecules governed by bonding, reaction energetics, periodicity, or conservation of matter — principles that explain how and why ${topic} occurs.`,
      distractors: [
        `A biological process that involves cell division, unrelated to chemical bonding or reactions.`,
        `A physical law about gravity and motion with no relevance to molecular behavior.`,
        `An economic theory about market supply and demand, incorrectly applied to chemical systems.`,
      ],
      explanation: `${topic} in ${grade} Chemistry is explained through atomic and molecular theory, bonding principles, and chemical reaction laws from the Ethiopian curriculum.`,
    },
    {
      prompt: `Which laboratory safety rule is most important when conducting an experiment involving "${topic}"?`,
      correct: `Always wear protective equipment (gloves, goggles), work in a well-ventilated area, follow MSDS guidelines for any chemicals used, and never mix chemicals without instructor supervision.`,
      distractors: [
        `It is safe to taste unknown chemicals to identify them by flavor.`,
        `Lab safety rules are optional suggestions that can be ignored by experienced students.`,
        `Using any available household containers to store concentrated chemicals is acceptable.`,
      ],
      explanation: `Laboratory safety is a cornerstone of the ${grade} Chemistry curriculum, and all experiments including those involving ${topic} require strict adherence to safety protocols.`,
    },
    {
      prompt: `If a chemical equation for "${topic}" is balanced, what does this confirm about the reaction?`,
      correct: `That the number of each type of atom is equal on both the reactant and product sides, satisfying the Law of Conservation of Mass — no atoms are created or destroyed.`,
      distractors: [
        `That the reaction is fast — balancing an equation determines only the speed of the reaction.`,
        `That all reactants are completely consumed, which is only possible in reversible reactions.`,
        `That the equation is written correctly in terms of spelling, not the number of atoms.`,
      ],
      explanation: `Balancing chemical equations, including those for ${topic}, demonstrates the Law of Conservation of Mass — a fundamental principle of ${grade} Chemistry.`,
    },
  ],

  Biology: (topic, unit, grade) => [
    {
      prompt: `Which biological principle best explains the role of "${topic}" in living organisms as studied in ${grade}?`,
      correct: `A life process or structural adaptation that enables organisms to survive, reproduce, or maintain homeostasis — reflecting how ${topic} functions within the broader system of life.`,
      distractors: [
        `A geological process related to rock formation with no connection to living organisms.`,
        `A chemical reaction that only occurs in non-living industrial processes, not in biological systems.`,
        `A mathematical theorem used for calculating financial interest, incorrectly applied to biology.`,
      ],
      explanation: `${topic} in ${grade} Biology is a core life science concept tied to life processes, cellular function, ecology, or evolution as outlined in the Ethiopian curriculum.`,
    },
    {
      prompt: `Why is "${topic}" important to understanding the health and wellbeing of Ethiopian communities?`,
      correct: `Understanding ${topic} helps explain disease prevention, nutrition, agricultural productivity, environmental conservation, and public health challenges relevant to Ethiopian communities.`,
      distractors: [
        `${topic} is irrelevant to Ethiopian daily life and only applies to exotic foreign ecosystems.`,
        `It is important only for students who want to become professional biologists, not for the general public.`,
        `Understanding ${topic} has no impact on human health, agriculture, or environmental management.`,
      ],
      explanation: `The ${grade} Biology curriculum connects ${topic} to Ethiopian public health, agriculture, and environmental sustainability.`,
    },
    {
      prompt: `When a scientist studies "${topic}" using the scientific method, which step comes immediately after forming a hypothesis?`,
      correct: `Designing and conducting a controlled experiment that tests the hypothesis by collecting measurable, observable data, while keeping all other variables constant.`,
      distractors: [
        `Immediately publishing results in a journal before collecting any experimental data.`,
        `Accepting the hypothesis as true without testing it, since it seems logical.`,
        `Asking another scientist to approve the hypothesis without any experimental evidence.`,
      ],
      explanation: `The scientific method applied to ${topic} follows: observation, question, hypothesis, experiment, data analysis, conclusion — the backbone of biological inquiry.`,
    },
  ],

  Geography: (topic, unit, grade) => [
    {
      prompt: `How does "${topic}" as studied in ${grade} Geography connect to Ethiopia's physical or human landscape?`,
      correct: `${topic} helps explain patterns of landforms, climate zones, water systems, population distribution, or economic activities that shape life in Ethiopia and the surrounding region.`,
      distractors: [
        `${topic} is only relevant to studying foreign countries and has no application to Ethiopian geography.`,
        `It is a chemistry concept accidentally included in the geography curriculum.`,
        `${topic} refers only to historical events from ancient civilizations, not modern geography.`,
      ],
      explanation: `${grade} Geography uses ${topic} to build understanding of Ethiopia's unique position — its highlands, rift valley, rivers, diverse climates, and regional connections.`,
    },
    {
      prompt: `Which map-reading or geographic skill is most essential when studying "${topic}"?`,
      correct: `Using scale, compass directions, contour lines, thematic map symbols, and geographic coordinates to interpret spatial patterns and relationships connected to ${topic}.`,
      distractors: [
        `Only memorizing the capitals of every country in the world, without any map interpretation skills.`,
        `Avoiding maps altogether and relying only on written descriptions of places.`,
        `Using maps only to find roads, ignoring thematic geographic information relevant to ${topic}.`,
      ],
      explanation: `Geographic literacy — including map reading and spatial analysis — is central to understanding ${topic} in the ${grade} Ethiopian Geography curriculum.`,
    },
  ],

  History: (topic, unit, grade) => [
    {
      prompt: `What is the historical significance of "${topic}" in the context of Ethiopian and African history at the ${grade} level?`,
      correct: `${topic} represents a pivotal event, figure, or era that shaped Ethiopia's political sovereignty, cultural identity, social structures, or role in broader African and world history.`,
      distractors: [
        `${topic} is a minor footnote in history with no lasting impact on Ethiopia or Africa.`,
        `It refers to a modern sports achievement unrelated to historical development.`,
        `${topic} is exclusively about European history with no connection to Ethiopian civilization.`,
      ],
      explanation: `The ${grade} Ethiopian History curriculum highlights ${topic} as part of Ethiopia's rich historical narrative — from ancient Aksum through to modern nation-building.`,
    },
    {
      prompt: `A historian analyzing "${topic}" would primarily use which type of evidence?`,
      correct: `Primary sources such as chronicles, manuscripts, oral traditions, archaeological artifacts, treaties, and official documents from the period in question.`,
      distractors: [
        `Only fictional novels and movies about the historical period, which are not reliable sources.`,
        `Social media posts and modern internet opinions about what happened in the past.`,
        `Only eyewitness accounts from living people, regardless of how ancient the historical event is.`,
      ],
      explanation: `Historical analysis of ${topic} relies on primary sources — the raw material of history — supplemented by secondary scholarly interpretations.`,
    },
  ],

  "General Science": (topic, unit, grade) => [
    {
      prompt: `Which scientific concept from "${topic}" in ${unit} best explains an observation students make in daily Ethiopian life?`,
      correct: `A fundamental principle of physics, chemistry, biology, or earth science that accounts for natural phenomena students encounter — such as weather patterns, plant growth, or material properties — connected to ${topic}.`,
      distractors: [
        `A philosophical opinion with no connection to measurable or observable scientific phenomena.`,
        `A social science theory about human behavior, incorrectly categorized as a natural science concept.`,
        `An engineering principle exclusive to advanced technology, beyond the scope of ${grade} General Science.`,
      ],
      explanation: `${grade} General Science integrates multiple scientific disciplines, with ${topic} providing foundational knowledge grounded in observable natural phenomena.`,
    },
    {
      prompt: `How does the scientific method help students investigate "${topic}" in the ${grade} General Science classroom?`,
      correct: `Students observe, question, form testable hypotheses, conduct simple experiments, collect and record data, analyze results, and draw evidence-based conclusions about ${topic}.`,
      distractors: [
        `Students simply read about ${topic} from the textbook and accept all statements as true without questioning.`,
        `Students guess the answer, and the teacher confirms it without any experimental verification.`,
        `Students avoid experiments entirely and only study ${topic} through memorization of facts.`,
      ],
      explanation: `The scientific method guides ${grade} students to investigate ${topic} systematically, building critical thinking and experimental skills essential to science education.`,
    },
  ],

  "Social Studies": (topic, unit, grade) => [
    {
      prompt: `How does studying "${topic}" in ${grade} Social Studies help students understand Ethiopian society?`,
      correct: `${topic} develops civic awareness, cultural appreciation, and social responsibility by exploring Ethiopia's diverse communities, governance structures, economic activities, and historical heritage.`,
      distractors: [
        `${topic} is irrelevant to Ethiopian society and only applies to Western democratic countries.`,
        `Studying ${topic} only teaches memorization of facts without developing any critical thinking skills.`,
        `It focuses exclusively on ancient history with no connection to modern Ethiopian citizenship.`,
      ],
      explanation: `${grade} Social Studies uses ${topic} to build active, informed Ethiopian citizens who understand their rights, responsibilities, and cultural heritage.`,
    },
  ],

  "Civic and Ethical Education": (topic, unit, grade) => [
    {
      prompt: `Why is understanding "${topic}" important for students to become responsible Ethiopian citizens?`,
      correct: `${topic} develops the values, rights, duties, and ethical reasoning needed for students to participate constructively in their communities, uphold the law, and respect human dignity.`,
      distractors: [
        `Civic education topics like ${topic} are purely theoretical and have no bearing on real-world citizenship.`,
        `${topic} only matters to government officials and politicians, not to ordinary students.`,
        `Understanding ${topic} means students must memorize laws without understanding their purpose or application.`,
      ],
      explanation: `Civic and Ethical Education at ${grade} level uses ${topic} to nurture values of justice, equality, responsibility, and democratic participation.`,
    },
  ],

  "Environmental Science": (topic, unit, grade) => [
    {
      prompt: `What environmental principle does "${topic}" illustrate in the ${grade} curriculum?`,
      correct: `An ecological relationship, natural cycle, or conservation principle that explains how living organisms, natural resources, climate, and human activities interact and affect Ethiopia's environment.`,
      distractors: [
        `A principle from mechanical engineering about machines, unrelated to the natural environment.`,
        `A marketing strategy for selling environmental products, not a scientific principle.`,
        `A purely historical event with no ongoing relevance to modern environmental science.`,
      ],
      explanation: `${grade} Environmental Science uses ${topic} to connect students to Ethiopia's environmental challenges — deforestation, soil erosion, water scarcity — and sustainable solutions.`,
    },
  ],

  Economics: (topic, unit, grade) => [
    {
      prompt: `How does the economic concept of "${topic}" apply to Ethiopia's national development and daily economic life?`,
      correct: `${topic} explains patterns of production, consumption, trade, resource allocation, or economic policy that directly affect Ethiopia's GDP, poverty reduction, and citizens' living standards.`,
      distractors: [
        `${topic} only applies to wealthy industrialized nations and has no relevance to Ethiopia's developing economy.`,
        `It is a biological concept accidentally placed in the economics curriculum.`,
        `${topic} relates only to the internal workings of multinational corporations, not to national economies.`,
      ],
      explanation: `${grade} Economics applies ${topic} to Ethiopia's mixed economy, exploring themes of agriculture, industry, trade, and government fiscal policy.`,
    },
  ],

  "Information Technology": (topic, unit, grade) => [
    {
      prompt: `How does the IT concept of "${topic}" support Ethiopia's digital transformation and ICT development goals?`,
      correct: `${topic} provides foundational digital literacy skills — hardware understanding, software use, internet safety, or programming basics — that prepare students for Ethiopia's growing digital economy.`,
      distractors: [
        `${topic} is outdated technology no longer used anywhere in the world.`,
        `It only applies to students who already own expensive computers and high-speed internet at home.`,
        `${topic} has no connection to Ethiopia's technology development plans or digital economy.`,
      ],
      explanation: `${grade} IT education uses ${topic} to build ICT competencies aligned with Ethiopia's Digital Ethiopia 2025 strategy and 21st century skills requirements.`,
    },
  ],
};

/**
 * Retrieve the best-matched question bank for a given subject name.
 * Tries exact match first, then partial/fuzzy match.
 */
export function getSubjectQuestions(
  subjectName: string,
  topic: string,
  unit: string,
  grade: string,
): QuestionTemplate[] {
  // Try exact match
  const exactBank = SUBJECT_QUESTION_BANKS[subjectName];
  if (exactBank) return exactBank(topic, unit, grade);

  // Try partial match
  const normalizedSubject = subjectName.toLowerCase();
  for (const [key, bank] of Object.entries(SUBJECT_QUESTION_BANKS)) {
    if (
      normalizedSubject.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(normalizedSubject)
    ) {
      return bank(topic, unit, grade);
    }
  }

  // Keyword-based routing
  if (normalizedSubject.includes("math")) return SUBJECT_QUESTION_BANKS["Mathematics"](topic, unit, grade);
  if (normalizedSubject.includes("english") || normalizedSubject.includes("language")) return SUBJECT_QUESTION_BANKS["English"](topic, unit, grade);
  if (normalizedSubject.includes("phys")) return SUBJECT_QUESTION_BANKS["Physics"](topic, unit, grade);
  if (normalizedSubject.includes("chem")) return SUBJECT_QUESTION_BANKS["Chemistry"](topic, unit, grade);
  if (normalizedSubject.includes("bio")) return SUBJECT_QUESTION_BANKS["Biology"](topic, unit, grade);
  if (normalizedSubject.includes("geo")) return SUBJECT_QUESTION_BANKS["Geography"](topic, unit, grade);
  if (normalizedSubject.includes("hist")) return SUBJECT_QUESTION_BANKS["History"](topic, unit, grade);
  if (normalizedSubject.includes("civic") || normalizedSubject.includes("ethical")) return SUBJECT_QUESTION_BANKS["Civic and Ethical Education"](topic, unit, grade);
  if (normalizedSubject.includes("econ")) return SUBJECT_QUESTION_BANKS["Economics"](topic, unit, grade);
  if (normalizedSubject.includes("social")) return SUBJECT_QUESTION_BANKS["Social Studies"](topic, unit, grade);
  if (normalizedSubject.includes("environ")) return SUBJECT_QUESTION_BANKS["Environmental Science"](topic, unit, grade);
  if (normalizedSubject.includes("tech") || normalizedSubject.includes("it") || normalizedSubject.includes("comput")) return SUBJECT_QUESTION_BANKS["Information Technology"](topic, unit, grade);
  if (normalizedSubject.includes("science")) return SUBJECT_QUESTION_BANKS["General Science"](topic, unit, grade);

  // Final fallback
  return SUBJECT_QUESTION_BANKS["General Science"](topic, unit, grade);
}
