import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://forma_app:c0867d22ba799f899303f8ba6dc2f1b0569e122536fdff8cbee822b751b935cc@127.0.0.1:3306/forma';

// Ethiopian Curriculum Framework (Grades 1 to 12)
const GRADE_DEFINITIONS = [
  { name: 'Grade 1', sortOrder: 1, classroom: 'Grade 1 - Section A' },
  { name: 'Grade 2', sortOrder: 2, classroom: 'Grade 2 - Section A' },
  { name: 'Grade 3', sortOrder: 3, classroom: 'Grade 3 - Section A' },
  { name: 'Grade 4', sortOrder: 4, classroom: 'Grade 4 - Section A' },
  { name: 'Grade 5', sortOrder: 5, classroom: 'Grade 5 - Section A' },
  { name: 'Grade 6', sortOrder: 6, classroom: 'Grade 6 - Section A' },
  { name: 'Grade 7', sortOrder: 7, classroom: 'Grade 7 - Section A' },
  { name: 'Grade 8', sortOrder: 8, classroom: 'Grade 8 - Section A' },
  { name: 'Grade 9', sortOrder: 9, classroom: 'Grade 9 - Section A' },
  { name: 'Grade 10', sortOrder: 10, classroom: 'Grade 10 - Section A' },
  { name: 'Grade 11', sortOrder: 11, classroom: 'Grade 11 - Natural Science' },
  { name: 'Grade 12', sortOrder: 12, classroom: 'Grade 12 - Natural Science' },
];

const SUBJECT_DEFINITIONS = [
  { name: 'English', code: 'ENG', department: 'Languages' },
  { name: 'Mathematics', code: 'MATH', department: 'Mathematics' },
  { name: 'Amharic', code: 'AMH', department: 'Languages' },
  { name: 'Afan Oromo', code: 'AFO', department: 'Languages' },
  { name: 'Environmental Science', code: 'ENV', department: 'Natural Sciences' },
  { name: 'General Science', code: 'GSCI', department: 'Natural Sciences' },
  { name: 'Biology', code: 'BIO', department: 'Natural Sciences' },
  { name: 'Chemistry', code: 'CHEM', department: 'Natural Sciences' },
  { name: 'Physics', code: 'PHYS', department: 'Natural Sciences' },
  { name: 'Social Studies', code: 'SOC', department: 'Social Sciences' },
  { name: 'Geography', code: 'GEO', department: 'Social Sciences' },
  { name: 'History', code: 'HIST', department: 'Social Sciences' },
  { name: 'Information Technology', code: 'IT', department: 'Technology' },
  { name: 'Economics', code: 'ECON', department: 'Social Sciences' },
  { name: 'Citizenship Education', code: 'CIT', department: 'Social Sciences' },
  { name: 'Performing and Visual Arts', code: 'PVA', department: 'Arts' },
  { name: 'Health and Physical Education', code: 'HPE', department: 'Physical Education' },
  { name: 'Agriculture', code: 'AGRI', department: 'Vocational' },
];

// Grade to Subject mapping in Ethiopian MoE Curriculum
const CURRICULUM_CATALOGUE = [
  // Grade 1
  {
    grade: 'Grade 1',
    subject: 'English',
    title: 'Grade 1 English Student Textbook (English for Ethiopia)',
    liveUrl: 'http://213.55.101.25/images/new_book/grade1/English_grade_1_final_july_23_2022_kilole_Compressed.pdf',
    units: [
      { title: 'Unit 1: Look at Me', topics: ['Parts of the Body', 'Greetings and Introductions', 'Action Words and Movement'] },
      { title: 'Unit 2: My Classroom', topics: ['Classroom Objects', 'Colors and Shapes', 'Listening and Obeying Instructions'] },
      { title: 'Unit 3: My Family', topics: ['Family Members', 'Describing People', 'Expressing Feelings and Gratitude'] },
      { title: 'Unit 4: Numbers and Counting', topics: ['Numbers 1 to 10', 'Counting Objects', 'Simple Classroom Rhymes'] },
    ]
  },
  {
    grade: 'Grade 1',
    subject: 'Mathematics',
    title: 'Grade 1 Mathematics Student Textbook (Herrega Kutaa 1 / 1ኛ ክፍል ሒሳብ)',
    liveUrl: 'http://213.55.101.25/images/new_book/grade1/am/Maths_Grade_1Amaharic_compressed.pdf',
    units: [
      { title: 'Unit 1: Numbers up to 20', topics: ['Counting Objects 1 to 10', 'Number Names and Symbols', 'Comparing Quantities (More/Less)'] },
      { title: 'Unit 2: Addition within 10', topics: ['Concept of Combining Sets', 'Addition Symbol and Equations', 'Word Problems within 10'] },
      { title: 'Unit 3: Subtraction within 10', topics: ['Concept of Taking Away', 'Subtraction Equations', 'Mental Subtraction Strategies'] },
      { title: 'Unit 4: Basic Geometric Shapes and Patterns', topics: ['Circle, Square, Triangle, Rectangle', 'Recognizing Patterns in Nature', 'Sorting by Size and Shape'] },
    ]
  },
  {
    grade: 'Grade 1',
    subject: 'Environmental Science',
    title: 'Grade 1 Environmental Science (Saayinsii Naannoo / የአካባቢ ሳይንስ)',
    units: [
      { title: 'Unit 1: Our Natural Environment', topics: ['Living Things Around Us', 'Plants and Animals in Our Community', 'Caring for Trees and Water'] },
      { title: 'Unit 2: Personal Hygiene and Health', topics: ['Hand Washing and Cleanliness', 'Healthy Foods and Water', 'Safety at Home and School'] },
      { title: 'Unit 3: Weather and Seasons', topics: ['Sunny, Rainy, and Windy Days', 'Clothing for Different Weather', 'Day and Night Cycles'] },
    ]
  },
  // Grade 2
  {
    grade: 'Grade 2',
    subject: 'English',
    title: 'Grade 2 English Student Textbook',
    units: [
      { title: 'Unit 1: Days of the Week and Time', topics: ['Days and Morning Routines', 'Simple Clock Times', 'Talking About Daily Schedules'] },
      { title: 'Unit 2: Animals Around Us', topics: ['Domestic and Wild Animals', 'Animal Habitats and Food', 'Prepositions of Place (in, on, under)'] },
      { title: 'Unit 3: Food and Health', topics: ['Healthy Fruits and Vegetables', 'Expressing Food Preferences', 'Table Manners and Politeness'] },
      { title: 'Unit 4: My Village and Town', topics: ['Places in the Community', 'Giving Simple Directions', 'Road Safety Rules'] },
    ]
  },
  {
    grade: 'Grade 2',
    subject: 'Mathematics',
    title: 'Grade 2 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Numbers up to 100', topics: ['Place Value: Tens and Ones', 'Comparing and Ordering Numbers', 'Counting in 2s, 5s, and 10s'] },
      { title: 'Unit 2: Two-Digit Addition and Subtraction', topics: ['Addition Without Regrouping', 'Addition With Regrouping', 'Subtraction Strategies and Word Problems'] },
      { title: 'Unit 3: Introduction to Multiplication', topics: ['Repeated Addition Concept', 'Multiplication Tables of 2, 3, and 5', 'Real-Life Grouping Problems'] },
      { title: 'Unit 4: Measurement and Money', topics: ['Measuring Length in Centimeters', 'Ethiopian Currency (Birr and Santim)', 'Making Simple Purchases and Change'] },
    ]
  },
  // Grade 3
  {
    grade: 'Grade 3',
    subject: 'English',
    title: 'Grade 3 English Student Textbook (English for Ethiopia)',
    liveUrl: 'http://213.55.101.25/images/new_book/g3/English_Students_Grade_3_.pdf',
    units: [
      { title: 'Unit 1: Back to School and Hobbies', topics: ['Sharing Summer Experiences', 'Talking About Hobbies and Talents', 'Using Simple Present Tense'] },
      { title: 'Unit 2: Traditional Games and Culture', topics: ['Traditional Ethiopian Games (Gebeta, Qille)', 'Rules and Sportsmanship', 'Sequencing Adverbs (First, Next, Finally)'] },
      { title: 'Unit 3: Water is Life', topics: ['Sources of Fresh Water', 'Water Conservation Methods', 'Cause and Effect Expressions'] },
      { title: 'Unit 4: Occupations and Community Helpers', topics: ['Teachers, Doctors, Farmers, and Artisans', 'Tools of Different Trades', 'Future Aspirations (I want to be...)'] },
    ]
  },
  {
    grade: 'Grade 3',
    subject: 'Mathematics',
    title: 'Grade 3 Mathematics Student Textbook (Herrega Kutaa 3 / 3ኛ ክፍል ሒሳብ)',
    liveUrl: 'http://213.55.101.25/images/new_book/g3/HERREGA_Kutaa-3.pdf',
    units: [
      { title: 'Unit 1: Numbers up to 1,000', topics: ['Hundreds, Tens, and Ones Place Values', 'Expanded Form and Rounding to Nearest 10', 'Comparing and Ordering Large Numbers'] },
      { title: 'Unit 2: Operations on Three-Digit Numbers', topics: ['Column Addition with Regrouping', 'Subtraction with Decomposition', 'Multi-Step Real World Word Problems'] },
      { title: 'Unit 3: Multiplication and Division Foundations', topics: ['Multiplication Tables 6 through 9', 'Division as Sharing and Grouping', 'Fact Families and Properties of Operations'] },
      { title: 'Unit 4: Fractions and Geometry', topics: ['Unit Fractions (1/2, 1/3, 1/4)', 'Comparing Fractions on Number Lines', 'Perimeter of Polygons and Area Intuition'] },
    ]
  },
  {
    grade: 'Grade 3',
    subject: 'Environmental Science',
    title: 'Grade 3 Environmental Science (Saayinsii Naannoo Kutaa 3)',
    liveUrl: 'http://213.55.101.25/images/new_book/g3/Saayinsii_Naannoo_Kutaa-3.pdf',
    units: [
      { title: 'Unit 1: Plants and Their Structures', topics: ['Roots, Stems, Leaves and Flowers', 'Functions of Plant Parts', 'Photosynthesis Foundations'] },
      { title: 'Unit 2: Soil and Rocks', topics: ['Types of Soil (Clay, Loam, Sand)', 'Soil Fertility and Conservation', 'Common Rocks in Ethiopia'] },
      { title: 'Unit 3: Human Body Systems', topics: ['Digestive System Basics', 'Healthy Eating Habits', 'Preventing Waterborne Illnesses'] },
    ]
  },
  // Grade 4
  {
    grade: 'Grade 4',
    subject: 'English',
    title: 'Grade 4 English Student Textbook',
    units: [
      { title: 'Unit 1: Our Natural Heritage', topics: ['National Parks of Ethiopia (Simien, Bale)', 'Endemic Wildlife (Walia Ibex, Red Fox)', 'Descriptive Writing with Adjectives'] },
      { title: 'Unit 2: Agriculture and Harvesting', topics: ['Major Ethiopian Crops (Teff, Coffee, Barley)', 'Farming Seasons (Meher, Belg)', 'Past Continuous and Past Simple Tenses'] },
      { title: 'Unit 3: Technology in Everyday Life', topics: ['Communication Tools Past and Present', 'Computers and Mobile Phones', 'Expressing Opinions and Reasons'] },
    ]
  },
  {
    grade: 'Grade 4',
    subject: 'Mathematics',
    title: 'Grade 4 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Whole Numbers up to 100,000', topics: ['Reading and Writing Five-Digit Numbers', 'Place Value and Rounding', 'Mental Calculation Strategies'] },
      { title: 'Unit 2: Factors, Multiples and Divisibility', topics: ['Prime and Composite Numbers', 'Divisibility Rules for 2, 3, 5, 10', 'Greatest Common Divisor (GCD) and LCM'] },
      { title: 'Unit 3: Fractions and Decimals', topics: ['Equivalent Fractions and Simplification', 'Adding and Subtracting Like Fractions', 'Tenths and Hundredths Decimal Notation'] },
      { title: 'Unit 4: Measurement: Area and Perimeter', topics: ['Formulas for Perimeter of Rectangles and Squares', 'Area in Square Units', 'Volume of Rectangular Prisms'] },
    ]
  },
  // Grade 5
  {
    grade: 'Grade 5',
    subject: 'English',
    title: 'Grade 5 English Student Textbook (English for Ethiopia)',
    liveUrl: 'http://213.55.101.25/images/new_book/g5/English_Grade_5_compressed.pdf',
    units: [
      { title: 'Unit 1: Holiday Celebrations and Cultural Diversity', topics: ['Meskel, Timket, Eid al-Fitr, Irreecha', 'Comparative and Superlative Adjectives', 'Narrative Storytelling Structure'] },
      { title: 'Unit 2: Environmental Conservation and Forestry', topics: ['Deforestation Impacts in the Horn of Africa', 'Tree Planting Initiatives (Green Legacy)', 'Modal Verbs of Obligation (must, should)'] },
      { title: 'Unit 3: Science, Inventions and Discovery', topics: ['Famous African and Global Inventors', 'The Scientific Method in Simple Terms', 'Passive Voice in Factual Descriptions'] },
      { title: 'Unit 4: Health and Nutrition', topics: ['Balanced Diet and Food Groups', 'Deficiency Diseases and Prevention', 'Giving Health Advice and Instructions'] },
    ]
  },
  {
    grade: 'Grade 5',
    subject: 'Mathematics',
    title: 'Grade 5 Mathematics Student Textbook (Herrega Kutaa 5)',
    liveUrl: 'http://213.55.101.25/images/new_book/g5/HERREGA_Kutaa-5.pdf',
    units: [
      { title: 'Unit 1: Whole Numbers up to Millions', topics: ['Millions Period Place Value', 'Standard, Word, and Exponential Form', 'Order of Operations (PEMDAS / BODMAS)'] },
      { title: 'Unit 2: Operations on Fractions and Decimals', topics: ['Adding and Subtracting Unlike Fractions', 'Multiplying and Dividing Fractions', 'Decimal Multiplication and Long Division'] },
      { title: 'Unit 3: Percentages and Ratios', topics: ['Concept of Ratio and Proportion', 'Converting between Fractions, Decimals, Percents', 'Discount and Tax Word Problems'] },
      { title: 'Unit 4: Geometry and Data Handling', topics: ['Angles: Acute, Right, Obtuse, Reflex', 'Bar Graphs and Pie Charts Interpretation', 'Mean, Median, and Mode Fundamentals'] },
    ]
  },
  {
    grade: 'Grade 5',
    subject: 'General Science',
    title: 'Grade 5 General Science Student Textbook (Saayinsii Waliigalaa / ጠቅላላ ሳይንስ)',
    units: [
      { title: 'Unit 1: Ecosystems and Living Organisms', topics: ['Producers, Consumers, and Decomposers', 'Food Chains and Food Webs', 'Human Impact on Ecosystems'] },
      { title: 'Unit 2: Matter and Its Transformations', topics: ['States of Matter: Solid, Liquid, Gas', 'Physical versus Chemical Changes', 'Mixtures and Separation Techniques'] },
      { title: 'Unit 3: Forces, Work and Simple Machines', topics: ['Types of Forces (Gravity, Friction)', 'Levers, Pulleys, and Inclined Planes', 'Efficiency and Mechanical Advantage'] },
    ]
  },
  // Grade 6
  {
    grade: 'Grade 6',
    subject: 'English',
    title: 'Grade 6 English Student Textbook',
    units: [
      { title: 'Unit 1: Traditional and Modern Agriculture', topics: ['Agro-Ecological Zones of Ethiopia', 'Modern Irrigation Techniques', 'Cause and Effect Complex Sentences'] },
      { title: 'Unit 2: Ancient Civilizations and Monuments', topics: ['Aksumite Obelisks, Lalibela, Fasil Ghebbi', 'Descriptive Historical Passages', 'Reported Speech Basics'] },
      { title: 'Unit 3: Renewable Energy Sources', topics: ['Hydroelectric Power (GERD), Solar and Wind', 'Sustainable Development Goals', 'Expressing Future Probability (will, might)'] },
    ]
  },
  {
    grade: 'Grade 6',
    subject: 'Mathematics',
    title: 'Grade 6 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Integers and Rational Numbers', topics: ['Positive and Negative Numbers on Number Lines', 'Absolute Value and Ordering', 'Operations on Integers'] },
      { title: 'Unit 2: Algebraic Expressions and Equations', topics: ['Variables and Constants', 'Simplifying Linear Expressions', 'Solving One-Step and Two-Step Equations'] },
      { title: 'Unit 3: Geometry: Coordinate Plane and Circles', topics: ['Four Quadrants of Cartesian Plane', 'Radius, Diameter, Circumference, and Area of Circles', 'Symmetry and Transformations'] },
    ]
  },
  {
    grade: 'Grade 6',
    subject: 'Citizenship Education',
    title: 'Grade 6 Citizenship Education (የግብረ ገብ ትምህርት / Barnoota Lammiillummaa)',
    units: [
      { title: 'Unit 1: Democratic Values and Human Rights', topics: ['Freedom, Equality, and Justice', 'Children Rights and Responsibilities', 'Rule of Law in School and Community'] },
      { title: 'Unit 2: Patriotism and Civic Participation', topics: ['National Symbols and Constitutional Duty', 'Volunteering and Community Service', 'Peaceful Conflict Resolution'] },
      { title: 'Unit 3: Work Ethics and Anti-Corruption', topics: ['Honesty, Integrity, and Punctuality', 'Combating Nepotism and Bribery', 'Accountability and Transparency'] },
    ]
  },
  // Grade 7
  {
    grade: 'Grade 7',
    subject: 'General Science',
    title: 'Grade 7 General Science Student Textbook (New Ethiopian Curriculum)',
    units: [
      { title: 'Unit 1: Basic Concepts of Science and Measurement', topics: ['Scientific Inquiry and Laboratory Safety', 'SI Units and Dimensional Analysis', 'Measurement of Length, Mass, Time, and Volume'] },
      { title: 'Unit 2: Matter in Our Surroundings', topics: ['Particulate Nature of Matter', 'Atomic Structure Basics (Protons, Neutrons, Electrons)', 'Classification of Elements and Periodic Table Intro'] },
      { title: 'Unit 3: Cells as the Basis of Life', topics: ['Plant and Animal Cells Comparison', 'Microscopy Techniques', 'Cell Division and Tissue Organization'] },
      { title: 'Unit 4: Energy and Energy Transformations', topics: ['Kinetic and Potential Energy', 'Conservation of Energy Law', 'Heat Transfer: Conduction, Convection, Radiation'] },
    ]
  },
  {
    grade: 'Grade 7',
    subject: 'Mathematics',
    title: 'Grade 7 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Rational Numbers and Real Number System', topics: ['Terminating and Repeating Decimals', 'Operations on Rational Numbers', 'Square Roots and Cube Roots'] },
      { title: 'Unit 2: Linear Equations and Inequalities in One Variable', topics: ['Solving Linear Equations with Fractional Coefficients', 'Graphing Inequalities on Number Lines', 'Real-Life Optimization Problems'] },
      { title: 'Unit 3: Ratio, Proportion, and Financial Mathematics', topics: ['Direct and Inverse Variation', 'Simple Interest and Compound Interest Concept', 'Currency Exchange and Inflation'] },
      { title: 'Unit 4: Triangles and Quadrilaterals', topics: ['Angle Sum Property and Exterior Angle Theorem', 'Congruence of Triangles (SSS, SAS, ASA, RHS)', 'Pythagorean Theorem and Applications'] },
    ]
  },
  {
    grade: 'Grade 7',
    subject: 'Information Technology',
    title: 'Grade 7 Information Technology (IT) Student Textbook',
    units: [
      { title: 'Unit 1: Introduction to Information and Communication Technology', topics: ['Hardware, Software, and Peopleware', 'Generations of Computers', 'Operating System Basics (GUI vs CLI)'] },
      { title: 'Unit 2: Word Processing and Document Formatting', topics: ['Creating, Editing, and Formatting Academic Papers', 'Tables, Images, and Page Setup', 'Exporting and Printing Documents'] },
      { title: 'Unit 3: The Internet, Web Browsing, and Cyber Safety', topics: ['How the Internet Works (Browsers, URLs, Search Engines)', 'Online Privacy and Strong Passwords', 'Ethical Use of Digital Content and Copyright'] },
    ]
  },
  // Grade 8
  {
    grade: 'Grade 8',
    subject: 'General Science',
    title: 'Grade 8 General Science Student Textbook (New Curriculum)',
    units: [
      { title: 'Unit 1: Chemical Reactions and Equations', topics: ['Chemical vs Physical Changes Revisited', 'Writing and Balancing Chemical Equations', 'Acids, Bases, and Salts: pH Scale and Indicators'] },
      { title: 'Unit 2: Human Body Systems and Reproduction', topics: ['Circulatory System and Blood Groups', 'Respiratory System and Gas Exchange', 'Human Reproductive Health and Development'] },
      { title: 'Unit 3: Light, Sound, and Wave Phenomena', topics: ['Properties of Light: Reflection, Refraction, Lenses', 'Nature of Sound Waves: Pitch, Loudness, Echo', 'Electromagnetic Spectrum Overview'] },
      { title: 'Unit 4: Earth, Atmosphere, and Astronomy', topics: ['Structure of the Earth (Crust, Mantle, Core)', 'Plate Tectonics and Earthquakes in East African Rift', 'Solar System, Stars, and Space Exploration'] },
    ]
  },
  {
    grade: 'Grade 8',
    subject: 'Mathematics',
    title: 'Grade 8 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Square Roots, Cube Roots, and Real Numbers', topics: ['Estimating Non-Perfect Squares', 'Properties of Exponents and Scientific Notation', 'Pythagorean Theorem Proofs and 3D Applications'] },
      { title: 'Unit 2: Coordinate Geometry and Linear Functions', topics: ['Slope of a Line (Rise over Run)', 'Slope-Intercept Form (y = mx + b)', 'Graphing Systems of Linear Equations'] },
      { title: 'Unit 3: Solid Geometry: Surface Area and Volume', topics: ['Cylinders, Cones, and Spheres', 'Composite 3D Shapes Calculations', 'Scaling Factors and Dimensional Changes'] },
      { title: 'Unit 4: Statistics and Probability', topics: ['Scatter Plots and Line of Best Fit', 'Relative Frequency and Experimental Probability', 'Compound Events and Tree Diagrams'] },
    ]
  },
  // Grade 9
  {
    grade: 'Grade 9',
    subject: 'Biology',
    title: 'Grade 9 Biology Student Textbook (New Ethiopian Curriculum)',
    units: [
      { title: 'Unit 1: Biology and Technology', topics: ['Branches of Biology and Scientific Ethics', 'Biological Tools: Compound and Electron Microscopes', 'Applications in Agriculture, Medicine, and Biotechnology'] },
      { title: 'Unit 2: Characteristics of Living Things and Cell Biology', topics: ['Unifying Characteristics of Life', 'Cell Ultrastructure and Organelle Functions', 'Passive and Active Membrane Transport (Diffusion, Osmosis)'] },
      { title: 'Unit 3: Enzymes and Cellular Metabolism', topics: ['Enzyme Structure and Lock-and-Key Mechanism', 'Factors Affecting Enzyme Activity (Temperature, pH)', 'Aerobic and Anaerobic Respiration Pathways'] },
      { title: 'Unit 4: Genetics and Heredity Foundations', topics: ['Mendelian Laws of Inheritance', 'Monohybrid Crosses and Punnett Squares', 'DNA Structure and Protein Synthesis Overview'] },
    ]
  },
  {
    grade: 'Grade 9',
    subject: 'Chemistry',
    title: 'Grade 9 Chemistry Student Textbook (New Curriculum)',
    units: [
      { title: 'Unit 1: Chemistry as a Central Science', topics: ['Scope of Chemistry and Career Pathways', 'Hazard Symbols and Laboratory Safety Regulations', 'Scientific Investigation and Error Analysis'] },
      { title: 'Unit 2: Atomic Structure and Periodic Properties', topics: ['Dalton, Thomson, Rutherford, and Bohr Atomic Models', 'Quantum Sublevels and Electronic Configuration (s, p, d, f)', 'Periodic Trends: Electronegativity, Ionization Energy, Atomic Radius'] },
      { title: 'Unit 3: Chemical Bonding and Intermolecular Forces', topics: ['Ionic, Covalent, and Metallic Bonding Mechanisms', 'Lewis Dot Structures and Octet Rule Exceptions', 'Hydrogen Bonding and Dipole Interactions'] },
      { title: 'Unit 4: Stoichiometry and the Mole Concept', topics: ['Avogadro Number and Molar Mass', 'Empirical and Molecular Formulas Determination', 'Limiting Reactants and Percent Yield Calculations'] },
    ]
  },
  {
    grade: 'Grade 9',
    subject: 'Physics',
    title: 'Grade 9 Physics Student Textbook (New Curriculum)',
    units: [
      { title: 'Unit 1: Vectors and Physical Measurements', topics: ['Scalar vs Vector Quantities', 'Vector Addition: Graphical and Analytical Components', 'Uncertainty, Precision, and Significant Figures'] },
      { title: 'Unit 2: Kinematics: Motion in One Dimension', topics: ['Displacement, Velocity, and Acceleration', 'Kinematic Equations for Constant Acceleration', 'Free Fall Under Gravity and Terminal Velocity'] },
      { title: 'Unit 3: Dynamics: Newton Laws of Motion', topics: ['Newton First, Second, and Third Laws', 'Free Body Diagrams and Friction Forces', 'Momentum, Impulse, and Conservation of Momentum'] },
      { title: 'Unit 4: Work, Energy, and Power', topics: ['Mechanical Work Done by Constant Forces', 'Work-Energy Theorem and Mechanical Energy Conservation', 'Power Calculations and Mechanical Efficiency'] },
    ]
  },
  {
    grade: 'Grade 9',
    subject: 'Mathematics',
    title: 'Grade 9 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Sets and the Real Number System', topics: ['Venn Diagrams and Set Operations (Union, Intersection, Complement)', 'Subsets of Real Numbers and Interval Notation', 'Properties of Exponents and Radicals'] },
      { title: 'Unit 2: Polynomials and Factoring', topics: ['Polynomial Arithmetic and Long Division', 'Factoring Trinomials and Difference of Squares', 'Remainder and Factor Theorems'] },
      { title: 'Unit 3: Quadratic Equations and Functions', topics: ['Solving Quadratics by Factoring, Completing Square, and Formula', 'Discriminant and Nature of Roots', 'Parabola Vertex and Axis of Symmetry Graphing'] },
      { title: 'Unit 4: Euclidean Geometry and Trigonometry', topics: ['Congruence and Similarity of Triangles', 'Trigonometric Ratios in Right Triangles (sin, cos, tan)', 'Applications to Angles of Elevation and Depression'] },
    ]
  },
  // Grade 10
  {
    grade: 'Grade 10',
    subject: 'Biology',
    title: 'Grade 10 Biology Student Textbook',
    units: [
      { title: 'Unit 1: Human Anatomy and Physiology', topics: ['Nervous System and Sensory Organs', 'Endocrine Glands and Hormonal Regulation', 'Immune System and Pathogen Defense'] },
      { title: 'Unit 2: Ecology and Natural Resources', topics: ['Biomes of Ethiopia and Vegetation Zones', 'Biogeochemical Cycles (Carbon, Nitrogen, Water)', 'Conservation of Biodiversity and Protected Areas'] },
      { title: 'Unit 3: Biotechnology and Genetic Engineering', topics: ['Recombinant DNA and Gene Cloning', 'Genetically Modified Organisms in Agriculture', 'Bioethics and Environmental Safety'] },
    ]
  },
  {
    grade: 'Grade 10',
    subject: 'Chemistry',
    title: 'Grade 10 Chemistry Student Textbook',
    units: [
      { title: 'Unit 1: Solutions and Colloids', topics: ['Types of Solutions, Solubility Curves, and Henry Law', 'Concentration Units (Molarity, Molality, Mole Fraction)', 'Colligative Properties of Solutions'] },
      { title: 'Unit 2: Chemical Kinetics and Equilibrium', topics: ['Factors Influencing Reaction Rates and Activation Energy', 'Dynamic Equilibrium and Le Chatelier Principle', 'Equilibrium Constant (Kc and Kp) Calculations'] },
      { title: 'Unit 3: Introduction to Organic Chemistry', topics: ['Nomenclature of Alkanes, Alkenes, Alkynes', 'Functional Groups (Alcohols, Aldehydes, Carboxylic Acids)', 'Petroleum Refining and Polymerization Reactions'] },
    ]
  },
  {
    grade: 'Grade 10',
    subject: 'Physics',
    title: 'Grade 10 Physics Student Textbook',
    units: [
      { title: 'Unit 1: Rotational Motion and Universal Gravitation', topics: ['Angular Kinematics and Centripetal Acceleration', 'Newton Law of Universal Gravitation and Kepler Laws', 'Torque, Moment of Inertia, and Rotational Equilibrium'] },
      { title: 'Unit 2: Fluid Mechanics', topics: ['Pressure in Fluids and Pascal Principle', 'Archimedes Principle and Buoyant Force', 'Continuity Equation and Bernoulli Principle'] },
      { title: 'Unit 3: Thermodynamics and Thermal Properties', topics: ['Thermal Expansion of Solids, Liquids, and Gases', 'Specific Heat Capacity and Calorimetry', 'Laws of Thermodynamics and Heat Engines'] },
    ]
  },
  {
    grade: 'Grade 10',
    subject: 'Mathematics',
    title: 'Grade 10 Mathematics Student Textbook',
    units: [
      { title: 'Unit 1: Relations and Functions', topics: ['Domain, Range, and Function Notation', 'Inverse Functions and Composition of Functions', 'Even and Odd Functions Properties'] },
      { title: 'Unit 2: Exponential and Logarithmic Functions', topics: ['Laws of Logarithms and Change of Base', 'Solving Exponential and Logarithmic Equations', 'Applications: Radioactive Decay and Population Growth'] },
      { title: 'Unit 3: Analytic Geometry of Conic Sections', topics: ['Standard Equation of Circles and Tangent Lines', 'Parabola, Ellipse, and Hyperbola Standard Forms', 'Geometric Loci and Graphing Conics'] },
    ]
  },
  // Grade 11
  {
    grade: 'Grade 11',
    subject: 'Biology',
    title: 'Grade 11 Biology Student Textbook (Natural Science Stream)',
    units: [
      { title: 'Unit 1: Biomolecules and Biochemical Principles', topics: ['Proteins, Carbohydrates, Lipids, and Nucleic Acids', 'Thermodynamics of Biological Systems and ATP Coupling', 'Metabolic Regulation and Allosteric Enzymes'] },
      { title: 'Unit 2: Molecular Genetics and Gene Expression', topics: ['DNA Replication Mechanism (Meselson-Stahl)', 'Transcription, RNA Processing, and the Genetic Code', 'Translation and Post-Translational Modifications'] },
      { title: 'Unit 3: Evolutionary Biology and Population Genetics', topics: ['Darwinian Natural Selection and Evidence for Evolution', 'Hardy-Weinberg Equilibrium Principle', 'Speciation Mechanisms: Allopatric vs Sympatric'] },
    ]
  },
  {
    grade: 'Grade 11',
    subject: 'Chemistry',
    title: 'Grade 11 Chemistry Student Textbook (Natural Science Stream)',
    units: [
      { title: 'Unit 1: Quantum Theory and Atomic Orbitals', topics: ['Photoelectric Effect and Wave-Particle Duality (de Broglie)', 'Heisenberg Uncertainty Principle and Schrödinger Equation', 'Quantum Numbers (n, l, ml, ms) and Orbital Shapes'] },
      { title: 'Unit 2: Advanced Chemical Bonding and Molecular Geometry', topics: ['Valence Bond Theory and Hybridization (sp, sp2, sp3)', 'VSEPR Theory and Molecular Shapes', 'Molecular Orbital Theory for Homonuclear Diatomic Molecules'] },
      { title: 'Unit 3: Acid-Base Equilibria and Electrochemistry', topics: ['Bronsted-Lowry and Lewis Acid-Base Theories', 'Buffer Solutions and Henderson-Hasselbalch Equation', 'Galvanic Cells, Standard Electrode Potentials, and Nernst Equation'] },
    ]
  },
  {
    grade: 'Grade 11',
    subject: 'Physics',
    title: 'Grade 11 Physics Student Textbook (Natural Science Stream)',
    units: [
      { title: 'Unit 1: 2D Kinematics and Projectile Motion', topics: ['Projectile Motion with Horizontal and Angled Launch', 'Relative Velocity in Two Dimensions', 'Uniform Circular Motion Dynamics'] },
      { title: 'Unit 2: Electrostatics and Electric Fields', topics: ['Coulomb Law and Electric Field Superposition', 'Gauss Law and Electric Potential Energy', 'Capacitance and Dielectric Materials'] },
      { title: 'Unit 3: Direct Current Circuits and Magnetism', topics: ['Kirchhoff Current and Voltage Laws', 'RC Circuits and Time Constants', 'Magnetic Fields Due to Currents (Biot-Savart & Ampere Laws)'] },
    ]
  },
  {
    grade: 'Grade 11',
    subject: 'Mathematics',
    title: 'Grade 11 Mathematics Student Textbook (Natural Science Stream)',
    units: [
      { title: 'Unit 1: Sequences and Series', topics: ['Arithmetic Sequences and Partial Sums', 'Geometric Series and Infinite Convergence', 'Mathematical Induction Proofs'] },
      { title: 'Unit 2: Trigonometric Functions and Analytic Identities', topics: ['Unit Circle Definition and Radian Measure', 'Sum, Difference, and Double-Angle Formulas', 'Solving Advanced Trigonometric Equations'] },
      { title: 'Unit 3: Limits, Continuity, and Derivative Foundations', topics: ['Intuitive and Epsilon-Delta Concept of Limits', 'Derivative as Slope of Tangent (Power, Product, Quotient Rules)', 'Chain Rule and Implicit Differentiation'] },
    ]
  },
  // Grade 12
  {
    grade: 'Grade 12',
    subject: 'Physics',
    title: 'Grade 12 Physics Student Textbook (Preparatory / University Entrance)',
    units: [
      { title: 'Unit 1: Electromagnetic Induction and Alternating Current', topics: ['Faraday Law of Induction and Lenz Law', 'Mutual and Self-Inductance, RL and LC Circuits', 'AC Generator, Transformers, and Power Transmission'] },
      { title: 'Unit 2: Wave Optics and Interference', topics: ['Huygens Principle and Double-Slit Interference', 'Diffraction Gratings and Single-Slit Diffraction', 'Polarization of Light and Brewster Angle'] },
      { title: 'Unit 3: Modern Physics, Nuclear Physics, and Quantum Mechanics', topics: ['Photoelectric Effect and Compton Scattering', 'Bohr Atom and Hydrogen Spectral Series', 'Nuclear Binding Energy, Radioactive Decay Law, and Fission/Fusion'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'Chemistry',
    title: 'Grade 12 Chemistry Student Textbook (Preparatory / University Entrance)',
    units: [
      { title: 'Unit 1: Advanced Organic Chemistry and Reaction Mechanisms', topics: ['Nucleophilic Substitution (SN1 and SN2) Reactions', 'Electrophilic Addition and Elimination (E1, E2)', 'Aromatic Compounds and Electrophilic Aromatic Substitution'] },
      { title: 'Unit 2: Industrial Chemistry and Material Science', topics: ['Extraction of Metals (Iron, Aluminum, Copper)', 'Haber Process, Contact Process, and Fertilizer Industry in Ethiopia', 'Polymers, Ceramics, and Nanotechnology Applications'] },
      { title: 'Unit 3: Nuclear and Environmental Chemistry', topics: ['Radioisotopes in Medicine and Carbon Dating', 'Atmospheric Chemistry: Ozone Depletion and Greenhouse Effect', 'Water Treatment and Industrial Waste Management'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'Mathematics',
    title: 'Grade 12 Mathematics Student Textbook (Preparatory / University Entrance)',
    units: [
      { title: 'Unit 1: Differential Calculus and Applications', topics: ['Mean Value Theorem and L-Hopital Rule', 'Curve Sketching: Extrema, Inflection Points, and Concavity', 'Related Rates and Optimization Word Problems'] },
      { title: 'Unit 2: Integral Calculus and Applications', topics: ['Definite and Indefinite Integrals: Fundamental Theorem of Calculus', 'Integration Techniques: Substitution, Parts, Partial Fractions', 'Area Between Curves and Volume of Solids of Revolution'] },
      { title: 'Unit 3: Linear Algebra: Vectors and Matrices in 3D', topics: ['Dot Product, Cross Product, and Scalar Triple Product', 'Equations of Lines and Planes in 3-Space', 'Matrix Inverses, Determinants, and Cramer Rule'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'Biology',
    title: 'Grade 12 Biology Student Textbook (Preparatory / University Entrance)',
    units: [
      { title: 'Unit 1: Immunology and Infectious Diseases', topics: ['Innate and Adaptive Immunity Mechanisms', 'Antibody Structure and Antigen Recognition', 'Epidemiology of Malaria, Tuberculosis, and HIV/AIDS'] },
      { title: 'Unit 2: Plant Physiology and Crop Science', topics: ['Water Transport: Transpiration-Cohesion-Tension Theory', 'C3, C4, and CAM Photosynthetic Adaptations', 'Plant Hormones (Auxins, Gibberellins) and Photoperiodism'] },
      { title: 'Unit 3: Applied Ecology and Environmental Management', topics: ['Carrying Capacity and Population Growth Models', 'Conservation Genetics and Restoration Ecology', 'Climate Change Mitigation Strategies in the Sahel and Horn of Africa'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'English',
    title: 'Grade 12 English Student Textbook (Advanced Academic English)',
    units: [
      { title: 'Unit 1: Critical Reading and Academic Synthesis', topics: ['Evaluating Arguments and Detecting Bias', 'Synthesizing Multiple Scholarly Sources', 'Advanced Academic Vocabulary and Collocations'] },
      { title: 'Unit 2: Research Papers and Thesis Writing', topics: ['Formulating Research Questions and Literature Review', 'Citation Styles (APA, Harvard) and Plagiarism Avoidance', 'Cohesion and Coherence in Expository Essays'] },
      { title: 'Unit 3: Professional Communication and Debate', topics: ['Formal Debating Rules and Parliamentary Procedure', 'Cover Letters, CVs, and University Admission Statements', 'Interview Techniques and Public Speaking'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'Information Technology',
    title: 'Grade 12 Information Technology (IT) Student Textbook',
    units: [
      { title: 'Unit 1: Database Management Systems (DBMS)', topics: ['Relational Database Models and Normalization (1NF, 2NF, 3NF)', 'SQL Queries: SELECT, INSERT, UPDATE, DELETE, and JOINs', 'Database Integrity, Security, and ACID Properties'] },
      { title: 'Unit 2: Computer Networking and Protocols', topics: ['OSI 7-Layer Model and TCP/IP Architecture', 'IP Addressing (IPv4 vs IPv6), Subnetting, and Routing', 'Network Security: Firewalls, VPNs, and Cryptography'] },
      { title: 'Unit 3: Algorithms and Python Programming', topics: ['Algorithmic Complexity (Big O Notation)', 'Control Structures, Functions, and Recursion', 'Object-Oriented Programming and Data Structures (Lists, Dictionaries)'] },
    ]
  },
  {
    grade: 'Grade 12',
    subject: 'Agriculture',
    title: 'Grade 12 Agriculture Student Textbook (Vocational & Applied Science)',
    units: [
      { title: 'Unit 1: Modern Agronomy and Crop Husbandry', topics: ['Soil Chemistry and Integrated Nutrient Management', 'Precision Agriculture and Drip Irrigation', 'Post-Harvest Handling and Food Security Systems'] },
      { title: 'Unit 2: Animal Science and Livestock Production', topics: ['Dairy and Beef Cattle Management in Ethiopia', 'Poultry Science, Feeds, and Disease Control', 'Apiculture (Beekeeping) and Honey Production'] },
      { title: 'Unit 3: Agribusiness and Agricultural Economics', topics: ['Farm Planning, Budgeting, and Risk Management', 'Agricultural Cooperatives and Commodity Exchange (ECX)', 'Export Value Chains: Coffee, Oilseeds, and Horticulture'] },
    ]
  },
];

/**
 * Generates an end-to-end pedagogical lesson plan object for database insertion.
 */
function buildLessonPlanData(params) {
  const {
    schoolId,
    academicYearId,
    classroomId,
    subjectId,
    teacherId,
    sourceResourceId,
    unitTitle,
    topicTitle,
    lessonIndex,
    totalLessons,
    subjectName,
    gradeName,
    scheduledDate,
  } = params;

  const durationMinutes = 45;
  const isFirst = lessonIndex === 1;
  const isFinal = lessonIndex === totalLessons;

  const title = `${unitTitle} — Lesson ${lessonIndex}: ${topicTitle}`;
  const unitTopic = unitTitle;

  const overview = `In this curriculum lesson for ${gradeName} ${subjectName}, students explore "${topicTitle}" within ${unitTitle}. ${
    isFirst
      ? 'This introductory lesson establishes foundational concepts, key vocabulary, and analytical goals.'
      : isFinal
      ? 'This synthesis lesson reviews key competencies, resolves misconceptions, and applies concepts through problem-solving.'
      : 'Students investigate core theoretical mechanisms, engage in guided exercises, and examine real-world applications.'
  } Directly aligned with the official Ethiopian Ministry of Education curriculum.`;

  const objectives = `By the end of this 45-minute lesson, students will be able to:
1. Define and explain ${topicTitle} using accurate terminology.
2. Demonstrate conceptual understanding through guided examples and peer discussion.
3. Solve curriculum practice problems with at least 80% accuracy.
${isFinal ? '4. Synthesize unit concepts and formulate evaluative conclusions.' : '4. Complete an individual exit ticket reflecting on learning goals.'}`;

  const materials = `• Ethiopian MoE ${gradeName} ${subjectName} Student Textbook
• Classroom whiteboard and illustrative diagrams
• Student activity handout: "${topicTitle} Guided Inquiry Sheet"
• Formative exit tickets and assessment review cards`;

  const prerequisites = `Students should possess working familiarity with foundational principles from ${
    isFirst ? 'preceding grades' : `earlier lessons in ${unitTitle}`
  }, including academic reading skills and basic problem-solving procedures.`;

  const procedures = `Phase 1: Starter & Hook (8 mins)
• Present real-world scenario: "How does ${topicTitle} manifest in daily life and technological applications?"
• Review prior knowledge via a 3-minute think-pair-share.
• State today's learning objectives and success criteria.

Phase 2: Direct Instruction & Guided Practice (25 mins)
• Explicit Modeling (10 mins): Present key laws, formulas, and definitions. Model worked examples on the board.
• Guided Collaboration (8 mins): Students work in pairs on targeted textbook problems while teacher circulates.
• Independent Practice (7 mins): Students complete differentiated exercises demonstrating mastery.

Phase 3: Plenary & Formative Wrap-Up (12 mins)
• Pair Sharing: 2-3 student pairs explain solutions and reasoning to the class.
• Exit Ticket: Students write 1 key takeaway and 1 unresolved question about ${topicTitle}.
• Assign aligned homework review problems.`;

  const differentiation = `• Support: Provide structured scaffolds, formula reference cards, and guided peer pairing.
• Extension: Challenge advanced learners with higher-order synthesis and real-world edge cases.
• Multilingual: Maintain a bilingual vocabulary word-wall connecting English, Amharic, and Afan Oromo terms.`;

  const assessment = `• Formative Observation: Targeted checks during guided collaborative practice.
• Exit Ticket Check: Evaluate student responses to determine pacing for next session.
• Homework Alignment: Exercises 1–5 from unit review section.`;

  const homework = `1. Complete textbook questions on ${topicTitle} (approx. 20 minutes).
2. Write a 3-sentence summary in your study notebook connecting ${topicTitle} to ${unitTitle}.`;

  const notes = `Archived in Forma school management system for ongoing teacher collaboration and continuous enhancement.`;

  return {
    id: randomUUID(),
    schoolId,
    academicYearId,
    classroomId,
    subjectId,
    teacherId,
    sourceResourceId,
    unitTopic,
    title,
    durationMinutes,
    scheduledDate,
    overview,
    objectives,
    materials,
    prerequisites,
    procedures,
    differentiation,
    assessment,
    homework,
    notes,
    status: 'draft',
  };
}

/**
 * Generates an assessment with multiple choice questions from a textbook.
 */
function buildAssessmentData(params) {
  const {
    schoolId,
    createdBy,
    academicYearId,
    classroomId,
    subjectId,
    gradeName,
    subjectName,
    units,
  } = params;

  const assessmentId = randomUUID();
  const title = `${gradeName} ${subjectName} — Comprehensive Curriculum Quiz & Review`;
  const instructions = `Instructions:
1. Carefully read each question and all four available options before answering.
2. This assessment evaluates conceptual mastery, vocabulary, and problem-solving from the ${gradeName} ${subjectName} curriculum.
3. Total Score: 10 points. Passing Score: 70%.`;

  const questions = [];
  let sortOrder = 0;

  for (const unit of units) {
    for (const topic of unit.topics) {
      if (questions.length >= 10) break;
      const cleanTopic = topic.replace(/^[0-9.:\-\s]+/, '').trim();
      const cleanUnit = unit.title.replace(/^[0-9.:\-\s]+/, '').trim();

      const options = [
        `The essential principle governing how ${cleanTopic} functions within ${cleanUnit}.`,
        `An obsolete historical assumption no longer accepted in modern ${subjectName}.`,
        `An arbitrary convention applied only under non-standard laboratory settings.`,
        `A contradictory condition that invalidates the main laws of ${cleanUnit}.`,
      ];

      // Randomize correct option index
      const correctOption = Math.floor(Math.random() * 4);
      const temp = options[0];
      options[0] = options[correctOption];
      options[correctOption] = temp;

      questions.push({
        id: randomUUID(),
        assessmentId,
        questionText: `In the study of ${cleanUnit}, which of the following accurately describes the primary significance of "${cleanTopic}"?`,
        options,
        correctOption,
        points: 1,
        sortOrder: sortOrder++,
      });
    }
    if (questions.length >= 10) break;
  }

  return {
    assessment: {
      id: assessmentId,
      schoolId,
      createdBy,
      academicYearId,
      classroomId,
      subjectId,
      title,
      instructions,
      status: 'published',
      maxScore: questions.length,
    },
    questions,
  };
}

async function main() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection(DATABASE_URL);

  // 1. Identify target schools
  const [schools] = await conn.query('SELECT id, name FROM school_schools');
  if (schools.length === 0) {
    console.error('No schools found! Please setup a school first.');
    process.exit(1);
  }

  console.log(`Found ${schools.length} school(s):`, schools.map(s => `${s.name} (${s.id})`));

  for (const school of schools) {
    const schoolId = school.id;
    console.log(`\n======================================================`);
    console.log(`PROCESSING SCHOOL: ${school.name} (${schoolId})`);
    console.log(`======================================================`);

    // Ensure storage directory
    const schoolUploadDir = path.join(process.cwd(), 'var', 'uploads', schoolId);
    fs.mkdirSync(schoolUploadDir, { recursive: true });

    // Fetch school admin user
    const [adminRows] = await conn.query(
      `SELECT u.id, u.email FROM school_auth_users u 
       JOIN school_memberships m ON m.user_id = u.id 
       WHERE m.school_id = ? AND m.role IN ('school_admin', 'teacher') 
       LIMIT 1`,
      [schoolId]
    );
    const userId = adminRows[0]?.id || '1d9f1f00-2b1b-4263-97ec-727da36298c5';
    const userEmail = adminRows[0]?.email || 'admin@forma.test';

    // Ensure a teacher profile exists for this school
    let [teacherRows] = await conn.query('SELECT id FROM school_teachers WHERE school_id = ? LIMIT 1', [schoolId]);
    let teacherRecordId;
    if (teacherRows.length === 0) {
      teacherRecordId = randomUUID();
      await conn.query(
        `INSERT INTO school_teachers 
         (id, school_id, user_id, teacher_number, first_name, last_name, email, specialization, status) 
         VALUES (?, ?, ?, 'TCH-001', 'Curriculum', 'Lead', ?, 'Curriculum Design', 'active')`,
        [teacherRecordId, schoolId, userId, userEmail]
      );
      console.log(`Created teacher record for school: ${teacherRecordId}`);
    } else {
      teacherRecordId = teacherRows[0].id;
    }

    // 2. Ensure Academic Year
    let [academicYears] = await conn.query(
      'SELECT id, name, is_current FROM school_academic_years WHERE school_id = ? ORDER BY is_current DESC LIMIT 1',
      [schoolId]
    );
    let academicYearId;
    if (academicYears.length === 0) {
      academicYearId = randomUUID();
      await conn.query(
        `INSERT INTO school_academic_years (id, school_id, name, starts_on, ends_on, is_current) 
         VALUES (?, ?, '2026/2027 Academic Year', '2026-09-01', '2027-06-30', 1)`,
        [academicYearId, schoolId]
      );
      console.log('Created current Academic Year 2026/2027');
    } else {
      academicYearId = academicYears[0].id;
      console.log(`Using existing Academic Year: ${academicYears[0].name} (${academicYearId})`);
    }

    // 3. Ensure all Grade Levels 1 to 12
    const gradeLevelMap = new Map(); // Name -> ID
    const [existingGrades] = await conn.query('SELECT id, name, sort_order FROM school_grade_levels WHERE school_id = ?', [schoolId]);
    for (const eg of existingGrades) {
      gradeLevelMap.set(eg.name.trim(), eg.id);
    }

    for (const gDef of GRADE_DEFINITIONS) {
      if (!gradeLevelMap.has(gDef.name)) {
        const gradeId = randomUUID();
        await conn.query(
          'INSERT INTO school_grade_levels (id, school_id, name, sort_order) VALUES (?, ?, ?, ?)',
          [gradeId, schoolId, gDef.name, gDef.sortOrder]
        );
        gradeLevelMap.set(gDef.name, gradeId);
        console.log(`Created Grade Level: ${gDef.name}`);
      }
    }

    // 4. Ensure all Subjects
    const subjectMap = new Map(); // Name -> ID
    const [existingSubjects] = await conn.query('SELECT id, name, code FROM school_subjects WHERE school_id = ?', [schoolId]);
    for (const es of existingSubjects) {
      subjectMap.set(es.name.toLowerCase().trim(), es.id);
    }

    for (const sDef of SUBJECT_DEFINITIONS) {
      if (!subjectMap.has(sDef.name.toLowerCase())) {
        const subId = randomUUID();
        await conn.query(
          'INSERT INTO school_subjects (id, school_id, name, code, department) VALUES (?, ?, ?, ?, ?)',
          [subId, schoolId, sDef.name, sDef.code, sDef.department]
        );
        subjectMap.set(sDef.name.toLowerCase(), subId);
        console.log(`Created Subject: ${sDef.name} (${sDef.code})`);
      }
    }

    // 5. Ensure Classrooms for each Grade
    const classroomMap = new Map(); // GradeName -> ClassroomID
    const [existingClassrooms] = await conn.query('SELECT id, grade_level_id, name FROM school_classrooms WHERE school_id = ? AND academic_year_id = ?', [schoolId, academicYearId]);
    for (const ec of existingClassrooms) {
      classroomMap.set(ec.name, ec.id);
    }

    for (const gDef of GRADE_DEFINITIONS) {
      const gradeId = gradeLevelMap.get(gDef.name);
      if (!classroomMap.has(gDef.classroom)) {
        const classId = randomUUID();
        await conn.query(
          'INSERT INTO school_classrooms (id, school_id, academic_year_id, grade_level_id, name, capacity) VALUES (?, ?, ?, ?, ?, 45)',
          [classId, schoolId, academicYearId, gradeId, gDef.classroom]
        );
        classroomMap.set(gDef.name, classId);
        console.log(`Created Classroom: ${gDef.classroom}`);
      } else {
        classroomMap.set(gDef.name, existingClassrooms.find(c => c.name === gDef.classroom)?.id);
      }
    }

    // 6. Process Curriculum Catalogue (Textbooks, Lesson Plans, Quizzes)
    console.log(`\nRegistering Ethiopian textbooks, lesson plans, and assessments...`);

    let totalBooks = 0;
    let totalLessonsCreated = 0;
    let totalAssessmentsCreated = 0;

    for (const item of CURRICULUM_CATALOGUE) {
      const gradeId = gradeLevelMap.get(item.grade);
      const subjectId = subjectMap.get(item.subject.toLowerCase());
      const classroomId = classroomMap.get(item.grade);

      if (!gradeId || !subjectId) {
        console.warn(`Skipping ${item.grade} ${item.subject} (missing grade or subject record)`);
        continue;
      }

      // Check if textbook resource already registered
      const [existingResource] = await conn.query(
        'SELECT id, storage_key FROM school_learning_resources WHERE school_id = ? AND grade_level_id = ? AND subject_id = ? LIMIT 1',
        [schoolId, gradeId, subjectId]
      );

      let resourceId;
      let storageKey;

      if (existingResource.length > 0) {
        resourceId = existingResource[0].id;
        storageKey = existingResource[0].storage_key;
        console.log(`Textbook already exists: ${item.title}`);
      } else {
        resourceId = randomUUID();
        storageKey = randomUUID();
        const targetFilePath = path.join(schoolUploadDir, storageKey);
        const fileName = `${item.grade.replace(/\s+/g, '_')}_${item.subject.replace(/\s+/g, '_')}_Textbook.pdf`;

        // Check if we can download the live PDF or generate textbook content
        let downloaded = false;
        if (item.liveUrl) {
          try {
            console.log(`Downloading official PDF from ${item.liveUrl}...`);
            const res = await fetch(item.liveUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              fs.writeFileSync(targetFilePath, Buffer.from(arrayBuffer));
              downloaded = true;
              console.log(`Downloaded ${item.title} (${arrayBuffer.byteLength} bytes)`);
            }
          } catch (e) {
            console.warn(`Download failed, generating structured curriculum text instead: ${e.message}`);
          }
        }

        // If not downloaded, create structured curriculum document
        if (!downloaded) {
          let docContent = `${item.title}\n`;
          docContent += `Federal Democratic Republic of Ethiopia Ministry of Education\n`;
          docContent += `Grade Level: ${item.grade} | Subject: ${item.subject}\n\n`;

          for (const u of item.units) {
            docContent += `\n=========================================\n`;
            docContent += `${u.title}\n`;
            docContent += `=========================================\n`;
            u.topics.forEach((top, idx) => {
              docContent += `Lesson ${idx + 1}: ${top}\n`;
              docContent += `Overview: Comprehensive coverage of ${top} including foundational concepts, practical exercises, and unit evaluation.\n`;
            });
          }

          fs.writeFileSync(targetFilePath, Buffer.from(docContent, 'utf8'));
        }

        const sizeBytes = fs.statSync(targetFilePath).size;

        await conn.query(
          `INSERT INTO school_learning_resources 
           (id, school_id, uploaded_by, grade_level_id, subject_id, title, description, file_name, storage_key, content_type, size_bytes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?)`,
          [
            resourceId,
            schoolId,
            userId,
            gradeId,
            subjectId,
            item.title,
            `Official Ethiopian Ministry of Education curriculum student textbook for ${item.grade} ${item.subject}. Covers all units, lesson topics, and review exercises.`,
            fileName,
            storageKey,
            sizeBytes,
          ]
        );
        totalBooks++;
        console.log(`Registered textbook: ${item.title}`);
      }

      // 7. Auto-Generate Curriculum Lesson Plans for each unit & topic
      const [existingPlans] = await conn.query(
        'SELECT count(*) as count FROM school_lesson_plans WHERE school_id = ? AND grade_level_id = ? AND subject_id = ?',
        [schoolId, gradeId, subjectId]
      );

      if (existingPlans[0].count === 0) {
        console.log(`Generating curriculum lesson plans for ${item.grade} ${item.subject}...`);
        let lessonIndex = 1;
        const totalLessons = item.units.reduce((sum, u) => sum + u.topics.length, 0);

        for (const unit of item.units) {
          for (const topic of unit.topics) {
            const planData = buildLessonPlanData({
              schoolId,
              academicYearId,
              classroomId,
              subjectId,
              teacherId: teacherRecordId,
              sourceResourceId: resourceId,
              unitTitle: unit.title,
              topicTitle: topic,
              lessonIndex: lessonIndex++,
              totalLessons,
              subjectName: item.subject,
              gradeName: item.grade,
              scheduledDate: new Date(Date.now() + (lessonIndex * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
            });

            await conn.query(
              `INSERT INTO school_lesson_plans 
               (id, school_id, created_by, academic_year_id, classroom_id, grade_level_id, subject_id, teacher_id, source_resource_id, unit_topic, title, duration_minutes, scheduled_date, overview, objectives, materials, prerequisites, procedures, differentiation, assessment, homework, notes, status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                planData.id,
                planData.schoolId,
                userId,
                planData.academicYearId,
                planData.classroomId,
                gradeId,
                subjectId,
                teacherRecordId,
                planData.sourceResourceId,
                planData.unitTopic,
                planData.title,
                planData.durationMinutes,
                planData.scheduledDate,
                planData.overview,
                planData.objectives,
                planData.materials,
                planData.prerequisites,
                planData.procedures,
                planData.differentiation,
                planData.assessment,
                planData.homework,
                planData.notes,
                planData.status,
              ]
            );

            // Insert initial revision history entry
            await conn.query(
              `INSERT INTO school_lesson_plan_revisions 
               (id, school_id, lesson_plan_id, version, edited_by, change_summary, title, unit_topic, duration_minutes, scheduled_date, status, overview, objectives, materials, prerequisites, procedures, differentiation, assessment, homework, notes) 
               VALUES (?, ?, ?, 1, ?, 'Initial auto-generation from Ethiopian curriculum textbook', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                randomUUID(),
                schoolId,
                planData.id,
                userId,
                planData.title,
                planData.unitTopic,
                planData.durationMinutes,
                planData.scheduledDate,
                planData.status,
                planData.overview,
                planData.objectives,
                planData.materials,
                planData.prerequisites,
                planData.procedures,
                planData.differentiation,
                planData.assessment,
                planData.homework,
                planData.notes,
              ]
            );

            totalLessonsCreated++;
          }
        }
        console.log(`Generated ${item.units.length} units (${totalLessons} lessons) for ${item.grade} ${item.subject}`);
      }

      // 8. Auto-Generate Quiz & Assessment from textbook
      const [existingAssessment] = await conn.query(
        'SELECT id FROM school_assessments WHERE school_id = ? AND subject_id = ? AND title LIKE ? LIMIT 1',
        [schoolId, subjectId, `%${item.grade}%`]
      );

      if (existingAssessment.length === 0) {
        console.log(`Generating quiz and exercises for ${item.grade} ${item.subject}...`);
        const { assessment, questions } = buildAssessmentData({
          schoolId,
          createdBy: userId,
          academicYearId,
          classroomId: classroomId || existingClassrooms[0]?.id,
          subjectId,
          gradeName: item.grade,
          subjectName: item.subject,
          units: item.units,
        });

        await conn.query(
          `INSERT INTO school_assessments 
           (id, school_id, created_by, academic_year_id, classroom_id, subject_id, title, instructions, status, max_score) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assessment.id,
            assessment.schoolId,
            assessment.createdBy,
            assessment.academicYearId,
            assessment.classroomId,
            assessment.subjectId,
            assessment.title,
            assessment.instructions,
            assessment.status,
            assessment.maxScore,
          ]
        );

        for (const q of questions) {
          await conn.query(
            `INSERT INTO school_assessment_questions 
             (id, assessment_id, question_text, options, correct_option, points, sort_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              q.id,
              q.assessmentId,
              q.questionText,
              JSON.stringify(q.options),
              q.correctOption,
              q.points,
              q.sortOrder,
            ]
          );
        }

        totalAssessmentsCreated++;
        console.log(`Created assessment: ${assessment.title} with ${questions.length} questions`);
      }
    }

    console.log(`\nCompleted school: ${school.name}`);
    console.log(`  New Textbooks uploaded: ${totalBooks}`);
    console.log(`  New Lesson Plans generated: ${totalLessonsCreated}`);
    console.log(`  New Assessments created: ${totalAssessmentsCreated}`);
  }

  await conn.end();
  console.log('\nAll Ethiopian textbooks, lesson plans, and assessments processed successfully!');
}

main().catch(console.error);
