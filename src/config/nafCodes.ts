// ---------------------------------------------------------------------------
// NAF Rev.2 — Nomenclature d'activités française (INSEE)
// 732 sous-classes regroupées par section (A → U)
// Les codes les plus courants (IT, conseil, services, commerce) sont en tête.
// ---------------------------------------------------------------------------

export type NafEntry = {
  code: string;   // e.g., "62.01Z"
  label: string;  // e.g., "Programmation informatique"
  section: string; // e.g., "J"
};

export const NAF_SECTIONS: Record<string, string> = {
  'A': 'Agriculture, sylviculture et pêche',
  'B': 'Industries extractives',
  'C': 'Industrie manufacturière',
  'D': 'Production et distribution d\'électricité, de gaz, de vapeur et d\'air conditionné',
  'E': 'Production et distribution d\'eau; assainissement, gestion des déchets et dépollution',
  'F': 'Construction',
  'G': 'Commerce; réparation d\'automobiles et de motocycles',
  'H': 'Transports et entreposage',
  'I': 'Hébergement et restauration',
  'J': 'Information et communication',
  'K': 'Activités financières et d\'assurance',
  'L': 'Activités immobilières',
  'M': 'Activités spécialisées, scientifiques et techniques',
  'N': 'Activités de services administratifs et de soutien',
  'O': 'Administration publique',
  'P': 'Enseignement',
  'Q': 'Santé humaine et action sociale',
  'R': 'Arts, spectacles et activités récréatives',
  'S': 'Autres activités de services',
  'T': 'Activités des ménages en tant qu\'employeurs',
  'U': 'Activités extra-territoriales',
};

// ---------------------------------------------------------------------------
// Codes les plus courants en premier (IT / conseil / services / commerce),
// puis le reste classé par section (A → U) et par code.
// ---------------------------------------------------------------------------

export const NAF_CODES: NafEntry[] = [
  // =========================================================================
  // CODES COURANTS — IT, Conseil, Services, Commerce
  // =========================================================================

  // Section J — Information et communication (sélection courante)
  { code: "62.01Z", label: "Programmation informatique", section: "J" },
  { code: "62.02A", label: "Conseil en systèmes et logiciels informatiques", section: "J" },
  { code: "62.02B", label: "Tierce maintenance de systèmes et d'applications informatiques", section: "J" },
  { code: "62.03Z", label: "Gestion d'installations informatiques", section: "J" },
  { code: "62.09Z", label: "Autres activités informatiques", section: "J" },
  { code: "63.11Z", label: "Traitement de données, hébergement et activités connexes", section: "J" },
  { code: "63.12Z", label: "Portails Internet", section: "J" },
  { code: "58.21Z", label: "Édition de jeux électroniques", section: "J" },
  { code: "58.29A", label: "Édition de logiciels système et de réseau", section: "J" },
  { code: "58.29B", label: "Édition de logiciels outils de développement et de langages", section: "J" },
  { code: "58.29C", label: "Édition de logiciels applicatifs", section: "J" },

  // Section M — Activités spécialisées, scientifiques et techniques (sélection courante)
  { code: "70.22Z", label: "Conseil pour les affaires et autres conseils de gestion", section: "M" },
  { code: "70.21Z", label: "Conseil en relations publiques et communication", section: "M" },
  { code: "70.10Z", label: "Activités des sièges sociaux", section: "M" },
  { code: "69.20Z", label: "Activités comptables", section: "M" },
  { code: "69.10Z", label: "Activités juridiques", section: "M" },
  { code: "71.11Z", label: "Activités d'architecture", section: "M" },
  { code: "71.12B", label: "Ingénierie, études techniques", section: "M" },
  { code: "73.11Z", label: "Activités des agences de publicité", section: "M" },
  { code: "73.12Z", label: "Régie publicitaire de médias", section: "M" },
  { code: "74.10Z", label: "Activités spécialisées de design", section: "M" },
  { code: "74.20Z", label: "Activités photographiques", section: "M" },
  { code: "74.30Z", label: "Traduction et interprétation", section: "M" },

  // Section G — Commerce (sélection courante)
  { code: "47.91B", label: "Vente à distance sur catalogue spécialisé", section: "G" },
  { code: "47.91A", label: "Vente à distance sur catalogue général", section: "G" },
  { code: "47.11F", label: "Hypermarchés", section: "G" },
  { code: "47.11D", label: "Supermarchés", section: "G" },
  { code: "46.90Z", label: "Commerce de gros non spécialisé", section: "G" },

  // Section N — Services administratifs et de soutien (sélection courante)
  { code: "82.99Z", label: "Autres activités de soutien aux entreprises n.c.a.", section: "N" },
  { code: "78.10Z", label: "Activités des agences de placement de main-d'oeuvre", section: "N" },
  { code: "78.20Z", label: "Activités des agences de travail temporaire", section: "N" },

  // Section K — Activités financières (sélection courante)
  { code: "64.20Z", label: "Activités des sociétés holding", section: "K" },

  // Section I — Hébergement et restauration (sélection courante)
  { code: "56.10A", label: "Restauration traditionnelle", section: "I" },
  { code: "56.10C", label: "Restauration de type rapide", section: "I" },

  // =========================================================================
  // SECTION A — Agriculture, sylviculture et pêche (39 codes)
  // =========================================================================
  { code: "01.11Z", label: "Culture de céréales (à l'exception du riz), de légumineuses et de graines oléagineuses", section: "A" },
  { code: "01.12Z", label: "Culture du riz", section: "A" },
  { code: "01.13Z", label: "Culture de légumes, de melons, de racines et de tubercules", section: "A" },
  { code: "01.14Z", label: "Culture de la canne à sucre", section: "A" },
  { code: "01.15Z", label: "Culture du tabac", section: "A" },
  { code: "01.16Z", label: "Culture de plantes à fibres", section: "A" },
  { code: "01.19Z", label: "Autres cultures non permanentes", section: "A" },
  { code: "01.21Z", label: "Culture de la vigne", section: "A" },
  { code: "01.22Z", label: "Culture de fruits tropicaux et subtropicaux", section: "A" },
  { code: "01.23Z", label: "Culture d'agrumes", section: "A" },
  { code: "01.24Z", label: "Culture de fruits à pépins et à noyau", section: "A" },
  { code: "01.25Z", label: "Culture d'autres fruits d'arbres ou d'arbustes et de fruits à coque", section: "A" },
  { code: "01.26Z", label: "Culture de fruits oléagineux", section: "A" },
  { code: "01.27Z", label: "Culture de plantes à boissons", section: "A" },
  { code: "01.28Z", label: "Culture de plantes à épices, aromatiques, médicinales et pharmaceutiques", section: "A" },
  { code: "01.29Z", label: "Autres cultures permanentes", section: "A" },
  { code: "01.30Z", label: "Reproduction de plantes", section: "A" },
  { code: "01.41Z", label: "Élevage de vaches laitières", section: "A" },
  { code: "01.42Z", label: "Élevage d'autres bovins et de buffles", section: "A" },
  { code: "01.43Z", label: "Élevage de chevaux et d'autres équidés", section: "A" },
  { code: "01.44Z", label: "Élevage de chameaux et d'autres camélidés", section: "A" },
  { code: "01.45Z", label: "Élevage d'ovins et de caprins", section: "A" },
  { code: "01.46Z", label: "Élevage de porcins", section: "A" },
  { code: "01.47Z", label: "Élevage de volailles", section: "A" },
  { code: "01.49Z", label: "Élevage d'autres animaux", section: "A" },
  { code: "01.50Z", label: "Culture et élevage associés", section: "A" },
  { code: "01.61Z", label: "Activités de soutien aux cultures", section: "A" },
  { code: "01.62Z", label: "Activités de soutien à la production animale", section: "A" },
  { code: "01.63Z", label: "Traitement primaire des récoltes", section: "A" },
  { code: "01.64Z", label: "Traitement des semences", section: "A" },
  { code: "01.70Z", label: "Chasse, piégeage et services annexes", section: "A" },
  { code: "02.10Z", label: "Sylviculture et autres activités forestières", section: "A" },
  { code: "02.20Z", label: "Exploitation forestière", section: "A" },
  { code: "02.30Z", label: "Récolte de produits forestiers non ligneux poussant à l'état sauvage", section: "A" },
  { code: "02.40Z", label: "Services de soutien à l'exploitation forestière", section: "A" },
  { code: "03.11Z", label: "Pêche en mer", section: "A" },
  { code: "03.12Z", label: "Pêche en eau douce", section: "A" },
  { code: "03.21Z", label: "Aquaculture en mer", section: "A" },
  { code: "03.22Z", label: "Aquaculture en eau douce", section: "A" },

  // =========================================================================
  // SECTION B — Industries extractives (15 codes)
  // =========================================================================
  { code: "05.10Z", label: "Extraction de houille", section: "B" },
  { code: "05.20Z", label: "Extraction de lignite", section: "B" },
  { code: "06.10Z", label: "Extraction de pétrole brut", section: "B" },
  { code: "06.20Z", label: "Extraction de gaz naturel", section: "B" },
  { code: "07.10Z", label: "Extraction de minerais de fer", section: "B" },
  { code: "07.21Z", label: "Extraction de minerais d'uranium et de thorium", section: "B" },
  { code: "07.29Z", label: "Extraction d'autres minerais de métaux non ferreux", section: "B" },
  { code: "08.11Z", label: "Extraction de pierres ornementales et de construction, de calcaire industriel, de gypse, de craie et d'ardoise", section: "B" },
  { code: "08.12Z", label: "Exploitation de gravières et sablières, extraction d'argiles et de kaolin", section: "B" },
  { code: "08.91Z", label: "Extraction des minéraux chimiques et d'engrais minéraux", section: "B" },
  { code: "08.92Z", label: "Extraction de tourbe", section: "B" },
  { code: "08.93Z", label: "Production de sel", section: "B" },
  { code: "08.99Z", label: "Autres activités extractives n.c.a.", section: "B" },
  { code: "09.10Z", label: "Activités de soutien à l'extraction d'hydrocarbures", section: "B" },
  { code: "09.90Z", label: "Activités de soutien aux autres industries extractives", section: "B" },

  // =========================================================================
  // SECTION C — Industrie manufacturière (259 codes)
  // =========================================================================

  // Division 10 — Industries alimentaires
  { code: "10.11Z", label: "Transformation et conservation de la viande de boucherie", section: "C" },
  { code: "10.12Z", label: "Transformation et conservation de la viande de volaille", section: "C" },
  { code: "10.13A", label: "Préparation industrielle de produits à base de viande", section: "C" },
  { code: "10.13B", label: "Charcuterie", section: "C" },
  { code: "10.20Z", label: "Transformation et conservation de poisson, de crustacés et de mollusques", section: "C" },
  { code: "10.31Z", label: "Transformation et conservation de pommes de terre", section: "C" },
  { code: "10.32Z", label: "Préparation de jus de fruits et légumes", section: "C" },
  { code: "10.39A", label: "Autre transformation et conservation de légumes", section: "C" },
  { code: "10.39B", label: "Transformation et conservation de fruits", section: "C" },
  { code: "10.41A", label: "Fabrication d'huiles et graisses brutes", section: "C" },
  { code: "10.41B", label: "Fabrication d'huiles et graisses raffinées", section: "C" },
  { code: "10.42Z", label: "Fabrication de margarine et graisses comestibles similaires", section: "C" },
  { code: "10.51A", label: "Fabrication de lait liquide et de produits frais", section: "C" },
  { code: "10.51B", label: "Fabrication de beurre", section: "C" },
  { code: "10.51C", label: "Fabrication de fromage", section: "C" },
  { code: "10.51D", label: "Fabrication d'autres produits laitiers", section: "C" },
  { code: "10.52Z", label: "Fabrication de glaces et sorbets", section: "C" },
  { code: "10.61A", label: "Meunerie", section: "C" },
  { code: "10.61B", label: "Autres activités du travail des grains", section: "C" },
  { code: "10.62Z", label: "Fabrication de produits amylacés", section: "C" },
  { code: "10.71A", label: "Fabrication industrielle de pain et de pâtisserie fraîche", section: "C" },
  { code: "10.71B", label: "Cuisson de produits de boulangerie", section: "C" },
  { code: "10.71C", label: "Boulangerie et boulangerie-pâtisserie", section: "C" },
  { code: "10.71D", label: "Pâtisserie", section: "C" },
  { code: "10.72Z", label: "Fabrication de biscuits, biscottes et pâtisseries de conservation", section: "C" },
  { code: "10.73Z", label: "Fabrication de pâtes alimentaires", section: "C" },
  { code: "10.81Z", label: "Fabrication de sucre", section: "C" },
  { code: "10.82Z", label: "Fabrication de cacao, chocolat et de produits de confiserie", section: "C" },
  { code: "10.83Z", label: "Transformation du thé et du café", section: "C" },
  { code: "10.84Z", label: "Fabrication de condiments et assaisonnements", section: "C" },
  { code: "10.85Z", label: "Fabrication de plats préparés", section: "C" },
  { code: "10.86Z", label: "Fabrication d'aliments homogénéisés et diététiques", section: "C" },
  { code: "10.89Z", label: "Fabrication d'autres produits alimentaires n.c.a.", section: "C" },
  { code: "10.91Z", label: "Fabrication d'aliments pour animaux de ferme", section: "C" },
  { code: "10.92Z", label: "Fabrication d'aliments pour animaux de compagnie", section: "C" },

  // Division 11 — Fabrication de boissons
  { code: "11.01Z", label: "Production de boissons alcooliques distillées", section: "C" },
  { code: "11.02A", label: "Fabrication de vins effervescents", section: "C" },
  { code: "11.02B", label: "Vinification", section: "C" },
  { code: "11.03Z", label: "Fabrication de cidre et de vins de fruits", section: "C" },
  { code: "11.04Z", label: "Production d'autres boissons fermentées non distillées", section: "C" },
  { code: "11.05Z", label: "Fabrication de bière", section: "C" },
  { code: "11.06Z", label: "Fabrication de malt", section: "C" },
  { code: "11.07A", label: "Industrie des eaux de table", section: "C" },
  { code: "11.07B", label: "Production de boissons rafraîchissantes", section: "C" },

  // Division 12 — Fabrication de produits à base de tabac
  { code: "12.00Z", label: "Fabrication de produits à base de tabac", section: "C" },

  // Division 13 — Fabrication de textiles
  { code: "13.10Z", label: "Préparation de fibres textiles et filature", section: "C" },
  { code: "13.20Z", label: "Tissage", section: "C" },
  { code: "13.30Z", label: "Ennoblissement textile", section: "C" },
  { code: "13.91Z", label: "Fabrication d'étoffes à mailles", section: "C" },
  { code: "13.92Z", label: "Fabrication d'articles textiles, sauf habillement", section: "C" },
  { code: "13.93Z", label: "Fabrication de tapis et moquettes", section: "C" },
  { code: "13.94Z", label: "Fabrication de ficelles, cordes et filets", section: "C" },
  { code: "13.95Z", label: "Fabrication de non-tissés, sauf habillement", section: "C" },
  { code: "13.96Z", label: "Fabrication d'autres textiles techniques et industriels", section: "C" },
  { code: "13.99Z", label: "Fabrication d'autres textiles n.c.a.", section: "C" },

  // Division 14 — Industrie de l'habillement
  { code: "14.11Z", label: "Fabrication de vêtements en cuir", section: "C" },
  { code: "14.12Z", label: "Fabrication de vêtements de travail", section: "C" },
  { code: "14.13Z", label: "Fabrication de vêtements de dessus", section: "C" },
  { code: "14.14Z", label: "Fabrication de vêtements de dessous", section: "C" },
  { code: "14.19Z", label: "Fabrication d'autres vêtements et accessoires", section: "C" },
  { code: "14.20Z", label: "Fabrication d'articles en fourrure", section: "C" },
  { code: "14.31Z", label: "Fabrication d'articles chaussants à mailles", section: "C" },
  { code: "14.39Z", label: "Fabrication d'autres articles à mailles", section: "C" },

  // Division 15 — Industrie du cuir et de la chaussure
  { code: "15.11Z", label: "Apprêt et tannage des cuirs ; préparation et teinture des fourrures", section: "C" },
  { code: "15.12Z", label: "Fabrication d'articles de voyage, de maroquinerie et de sellerie", section: "C" },
  { code: "15.20Z", label: "Fabrication de chaussures", section: "C" },

  // Division 16 — Travail du bois et fabrication d'articles en bois et en liège
  { code: "16.10A", label: "Sciage et rabotage du bois, hors imprégnation", section: "C" },
  { code: "16.10B", label: "Imprégnation du bois", section: "C" },
  { code: "16.21Z", label: "Fabrication de placage et de panneaux de bois", section: "C" },
  { code: "16.22Z", label: "Fabrication de parquets assemblés", section: "C" },
  { code: "16.23Z", label: "Fabrication de charpentes et d'autres menuiseries", section: "C" },
  { code: "16.24Z", label: "Fabrication d'emballages en bois", section: "C" },
  { code: "16.29Z", label: "Fabrication d'objets divers en bois ; fabrication d'objets en liège, vannerie et sparterie", section: "C" },

  // Division 17 — Industrie du papier et du carton
  { code: "17.11Z", label: "Fabrication de pâte à papier", section: "C" },
  { code: "17.12Z", label: "Fabrication de papier et de carton", section: "C" },
  { code: "17.21A", label: "Fabrication de carton ondulé", section: "C" },
  { code: "17.21B", label: "Fabrication de cartonnages", section: "C" },
  { code: "17.21C", label: "Fabrication d'emballages en papier", section: "C" },
  { code: "17.22Z", label: "Fabrication d'articles en papier à usage sanitaire ou domestique", section: "C" },
  { code: "17.23Z", label: "Fabrication d'articles de papeterie", section: "C" },
  { code: "17.24Z", label: "Fabrication de papiers peints", section: "C" },
  { code: "17.29Z", label: "Fabrication d'autres articles en papier ou en carton", section: "C" },

  // Division 18 — Imprimerie et reproduction d'enregistrements
  { code: "18.11Z", label: "Imprimerie de journaux", section: "C" },
  { code: "18.12Z", label: "Autre imprimerie (labeur)", section: "C" },
  { code: "18.13Z", label: "Activités de pré-presse", section: "C" },
  { code: "18.14Z", label: "Reliure et activités connexes", section: "C" },
  { code: "18.20Z", label: "Reproduction d'enregistrements", section: "C" },

  // Division 19 — Cokéfaction et raffinage
  { code: "19.10Z", label: "Cokéfaction", section: "C" },
  { code: "19.20Z", label: "Raffinage du pétrole", section: "C" },

  // Division 20 — Industrie chimique
  { code: "20.11Z", label: "Fabrication de gaz industriels", section: "C" },
  { code: "20.12Z", label: "Fabrication de colorants et de pigments", section: "C" },
  { code: "20.13A", label: "Enrichissement et retraitement de matières nucléaires", section: "C" },
  { code: "20.13B", label: "Fabrication d'autres produits chimiques inorganiques de base n.c.a.", section: "C" },
  { code: "20.14Z", label: "Fabrication d'autres produits chimiques organiques de base", section: "C" },
  { code: "20.15Z", label: "Fabrication de produits azotés et d'engrais", section: "C" },
  { code: "20.16Z", label: "Fabrication de matières plastiques de base", section: "C" },
  { code: "20.17Z", label: "Fabrication de caoutchouc synthétique", section: "C" },
  { code: "20.20Z", label: "Fabrication de pesticides et d'autres produits agrochimiques", section: "C" },
  { code: "20.30Z", label: "Fabrication de peintures, vernis, encres et mastics", section: "C" },
  { code: "20.41Z", label: "Fabrication de savons, détergents et produits d'entretien", section: "C" },
  { code: "20.42Z", label: "Fabrication de parfums et de produits pour la toilette", section: "C" },
  { code: "20.51Z", label: "Fabrication de produits explosifs", section: "C" },
  { code: "20.52Z", label: "Fabrication de colles", section: "C" },
  { code: "20.53Z", label: "Fabrication d'huiles essentielles", section: "C" },
  { code: "20.59Z", label: "Fabrication d'autres produits chimiques n.c.a.", section: "C" },
  { code: "20.60Z", label: "Fabrication de fibres artificielles ou synthétiques", section: "C" },

  // Division 21 — Industrie pharmaceutique
  { code: "21.10Z", label: "Fabrication de produits pharmaceutiques de base", section: "C" },
  { code: "21.20Z", label: "Fabrication de préparations pharmaceutiques", section: "C" },

  // Division 22 — Fabrication de produits en caoutchouc et en plastique
  { code: "22.11Z", label: "Fabrication et rechapage de pneumatiques", section: "C" },
  { code: "22.19Z", label: "Fabrication d'autres articles en caoutchouc", section: "C" },
  { code: "22.21Z", label: "Fabrication de plaques, feuilles, tubes et profilés en matières plastiques", section: "C" },
  { code: "22.22Z", label: "Fabrication d'emballages en matières plastiques", section: "C" },
  { code: "22.23Z", label: "Fabrication d'éléments en matières plastiques pour la construction", section: "C" },
  { code: "22.29A", label: "Fabrication de pièces techniques à base de matières plastiques", section: "C" },
  { code: "22.29B", label: "Fabrication de produits de consommation courante en matières plastiques", section: "C" },

  // Division 23 — Fabrication d'autres produits minéraux non métalliques
  { code: "23.11Z", label: "Fabrication de verre plat", section: "C" },
  { code: "23.12Z", label: "Façonnage et transformation du verre plat", section: "C" },
  { code: "23.13Z", label: "Fabrication de verre creux", section: "C" },
  { code: "23.14Z", label: "Fabrication de fibres de verre", section: "C" },
  { code: "23.19Z", label: "Fabrication et façonnage d'autres articles en verre, y compris verre technique", section: "C" },
  { code: "23.20Z", label: "Fabrication de produits réfractaires", section: "C" },
  { code: "23.31Z", label: "Fabrication de carreaux en céramique", section: "C" },
  { code: "23.32Z", label: "Fabrication de briques, tuiles et produits de construction, en terre cuite", section: "C" },
  { code: "23.41Z", label: "Fabrication d'articles céramiques à usage domestique ou ornemental", section: "C" },
  { code: "23.42Z", label: "Fabrication d'appareils sanitaires en céramique", section: "C" },
  { code: "23.43Z", label: "Fabrication d'isolateurs et pièces isolantes en céramique", section: "C" },
  { code: "23.44Z", label: "Fabrication d'autres produits céramiques à usage technique", section: "C" },
  { code: "23.49Z", label: "Fabrication d'autres produits céramiques", section: "C" },
  { code: "23.51Z", label: "Fabrication de ciment", section: "C" },
  { code: "23.52Z", label: "Fabrication de chaux et plâtre", section: "C" },
  { code: "23.61Z", label: "Fabrication d'éléments en béton pour la construction", section: "C" },
  { code: "23.62Z", label: "Fabrication d'éléments en plâtre pour la construction", section: "C" },
  { code: "23.63Z", label: "Fabrication de béton prêt à l'emploi", section: "C" },
  { code: "23.64Z", label: "Fabrication de mortiers et bétons secs", section: "C" },
  { code: "23.65Z", label: "Fabrication d'ouvrages en fibre-ciment", section: "C" },
  { code: "23.69Z", label: "Fabrication d'autres ouvrages en béton, en ciment ou en plâtre", section: "C" },
  { code: "23.70Z", label: "Taille, façonnage et finissage de pierres", section: "C" },
  { code: "23.91Z", label: "Fabrication de produits abrasifs", section: "C" },
  { code: "23.99Z", label: "Fabrication d'autres produits minéraux non métalliques n.c.a.", section: "C" },

  // Division 24 — Métallurgie
  { code: "24.10Z", label: "Sidérurgie", section: "C" },
  { code: "24.20Z", label: "Fabrication de tubes, tuyaux, profilés creux et accessoires correspondants en acier", section: "C" },
  { code: "24.31Z", label: "Étirage à froid de barres", section: "C" },
  { code: "24.32Z", label: "Laminage à froid de feuillards", section: "C" },
  { code: "24.33Z", label: "Profilage à froid par formage ou pliage", section: "C" },
  { code: "24.34Z", label: "Tréfilage à froid", section: "C" },
  { code: "24.41Z", label: "Production de métaux précieux", section: "C" },
  { code: "24.42Z", label: "Métallurgie de l'aluminium", section: "C" },
  { code: "24.43Z", label: "Métallurgie du plomb, du zinc ou de l'étain", section: "C" },
  { code: "24.44Z", label: "Métallurgie du cuivre", section: "C" },
  { code: "24.45Z", label: "Métallurgie des autres métaux non ferreux", section: "C" },
  { code: "24.46Z", label: "Élaboration et transformation de matières nucléaires", section: "C" },
  { code: "24.51Z", label: "Fonderie de fonte", section: "C" },
  { code: "24.52Z", label: "Fonderie d'acier", section: "C" },
  { code: "24.53Z", label: "Fonderie de métaux légers", section: "C" },
  { code: "24.54Z", label: "Fonderie d'autres métaux non ferreux", section: "C" },

  // Division 25 — Fabrication de produits métalliques
  { code: "25.11Z", label: "Fabrication de structures métalliques et de parties de structures", section: "C" },
  { code: "25.12Z", label: "Fabrication de portes et fenêtres en métal", section: "C" },
  { code: "25.21Z", label: "Fabrication de radiateurs et de chaudières pour le chauffage central", section: "C" },
  { code: "25.29Z", label: "Fabrication d'autres réservoirs, citernes et conteneurs métalliques", section: "C" },
  { code: "25.30Z", label: "Fabrication de générateurs de vapeur, à l'exception des chaudières pour le chauffage central", section: "C" },
  { code: "25.40Z", label: "Fabrication d'armes et de munitions", section: "C" },
  { code: "25.50A", label: "Forge, estampage, matriçage ; métallurgie des poudres", section: "C" },
  { code: "25.50B", label: "Découpage, emboutissage", section: "C" },
  { code: "25.61Z", label: "Traitement et revêtement des métaux", section: "C" },
  { code: "25.62A", label: "Décolletage", section: "C" },
  { code: "25.62B", label: "Mécanique industrielle", section: "C" },
  { code: "25.71Z", label: "Fabrication de coutellerie", section: "C" },
  { code: "25.72Z", label: "Fabrication de serrures et de ferrures", section: "C" },
  { code: "25.73A", label: "Fabrication de moules et modèles", section: "C" },
  { code: "25.73B", label: "Fabrication d'autres outillages", section: "C" },
  { code: "25.91Z", label: "Fabrication de fûts et emballages métalliques similaires", section: "C" },
  { code: "25.92Z", label: "Fabrication d'emballages métalliques légers", section: "C" },
  { code: "25.93Z", label: "Fabrication d'articles en fils métalliques, de chaînes et de ressorts", section: "C" },
  { code: "25.94Z", label: "Fabrication de vis et de boulons", section: "C" },
  { code: "25.99A", label: "Fabrication d'articles métalliques ménagers", section: "C" },
  { code: "25.99B", label: "Fabrication d'autres articles métalliques", section: "C" },

  // Division 26 — Fabrication de produits informatiques, électroniques et optiques
  { code: "26.11Z", label: "Fabrication de composants électroniques", section: "C" },
  { code: "26.12Z", label: "Fabrication de cartes électroniques assemblées", section: "C" },
  { code: "26.20Z", label: "Fabrication d'ordinateurs et d'équipements périphériques", section: "C" },
  { code: "26.30Z", label: "Fabrication d'équipements de communication", section: "C" },
  { code: "26.40Z", label: "Fabrication de produits électroniques grand public", section: "C" },
  { code: "26.51A", label: "Fabrication d'équipements d'aide à la navigation", section: "C" },
  { code: "26.51B", label: "Fabrication d'instrumentation scientifique et technique", section: "C" },
  { code: "26.52Z", label: "Horlogerie", section: "C" },
  { code: "26.60Z", label: "Fabrication d'équipements d'irradiation médicale, d'équipements électromédicaux et électrothérapeutiques", section: "C" },
  { code: "26.70Z", label: "Fabrication de matériels optique et photographique", section: "C" },
  { code: "26.80Z", label: "Fabrication de supports magnétiques et optiques", section: "C" },

  // Division 27 — Fabrication d'équipements électriques
  { code: "27.11Z", label: "Fabrication de moteurs, génératrices et transformateurs électriques", section: "C" },
  { code: "27.12Z", label: "Fabrication de matériel de distribution et de commande électrique", section: "C" },
  { code: "27.20Z", label: "Fabrication de piles et d'accumulateurs électriques", section: "C" },
  { code: "27.31Z", label: "Fabrication de câbles de fibres optiques", section: "C" },
  { code: "27.32Z", label: "Fabrication d'autres fils et câbles électroniques ou électriques", section: "C" },
  { code: "27.33Z", label: "Fabrication de matériel d'installation électrique", section: "C" },
  { code: "27.40Z", label: "Fabrication d'appareils d'éclairage électrique", section: "C" },
  { code: "27.51Z", label: "Fabrication d'appareils électroménagers", section: "C" },
  { code: "27.52Z", label: "Fabrication d'appareils ménagers non électriques", section: "C" },
  { code: "27.90Z", label: "Fabrication d'autres matériels électriques", section: "C" },

  // Division 28 — Fabrication de machines et équipements n.c.a.
  { code: "28.11Z", label: "Fabrication de moteurs et turbines, à l'exception des moteurs d'avions et de véhicules", section: "C" },
  { code: "28.12Z", label: "Fabrication d'équipements hydrauliques et pneumatiques", section: "C" },
  { code: "28.13Z", label: "Fabrication d'autres pompes et compresseurs", section: "C" },
  { code: "28.14Z", label: "Fabrication d'autres articles de robinetterie", section: "C" },
  { code: "28.15Z", label: "Fabrication d'engrenages et d'organes mécaniques de transmission", section: "C" },
  { code: "28.21Z", label: "Fabrication de fours et brûleurs", section: "C" },
  { code: "28.22Z", label: "Fabrication de matériel de levage et de manutention", section: "C" },
  { code: "28.23Z", label: "Fabrication de machines et d'équipements de bureau (à l'exception des ordinateurs et équipements périphériques)", section: "C" },
  { code: "28.24Z", label: "Fabrication d'outillage portatif à moteur incorporé", section: "C" },
  { code: "28.25Z", label: "Fabrication d'équipements aérauliques et frigorifiques industriels", section: "C" },
  { code: "28.29A", label: "Fabrication d'équipements d'emballage, de conditionnement et de pesage", section: "C" },
  { code: "28.29B", label: "Fabrication d'autres machines d'usage général", section: "C" },
  { code: "28.30Z", label: "Fabrication de machines agricoles et forestières", section: "C" },
  { code: "28.41Z", label: "Fabrication de machines-outils pour le travail des métaux", section: "C" },
  { code: "28.49Z", label: "Fabrication d'autres machines-outils", section: "C" },
  { code: "28.91Z", label: "Fabrication de machines pour la métallurgie", section: "C" },
  { code: "28.92Z", label: "Fabrication de machines pour l'extraction ou la construction", section: "C" },
  { code: "28.93Z", label: "Fabrication de machines pour l'industrie agro-alimentaire", section: "C" },
  { code: "28.94Z", label: "Fabrication de machines pour les industries textiles", section: "C" },
  { code: "28.95Z", label: "Fabrication de machines pour les industries du papier et du carton", section: "C" },
  { code: "28.96Z", label: "Fabrication de machines pour le travail du caoutchouc ou des plastiques", section: "C" },
  { code: "28.99A", label: "Fabrication de machines d'imprimerie", section: "C" },
  { code: "28.99B", label: "Fabrication d'autres machines spécialisées", section: "C" },

  // Division 29 — Industrie automobile
  { code: "29.10Z", label: "Construction de véhicules automobiles", section: "C" },
  { code: "29.20Z", label: "Fabrication de carrosseries et remorques", section: "C" },
  { code: "29.31Z", label: "Fabrication d'équipements électriques et électroniques automobiles", section: "C" },
  { code: "29.32Z", label: "Fabrication d'autres équipements automobiles", section: "C" },

  // Division 30 — Fabrication d'autres matériels de transport
  { code: "30.11Z", label: "Construction de navires et de structures flottantes", section: "C" },
  { code: "30.12Z", label: "Construction de bateaux de plaisance", section: "C" },
  { code: "30.20Z", label: "Construction de locomotives et d'autre matériel ferroviaire roulant", section: "C" },
  { code: "30.30Z", label: "Construction aéronautique et spatiale", section: "C" },
  { code: "30.40Z", label: "Construction de véhicules militaires de combat", section: "C" },
  { code: "30.91Z", label: "Fabrication de motocycles", section: "C" },
  { code: "30.92Z", label: "Fabrication de bicyclettes et de véhicules pour invalides", section: "C" },
  { code: "30.99Z", label: "Fabrication d'autres équipements de transport n.c.a.", section: "C" },

  // Division 31 — Fabrication de meubles
  { code: "31.01Z", label: "Fabrication de meubles de bureau et de magasin", section: "C" },
  { code: "31.02Z", label: "Fabrication de meubles de cuisine", section: "C" },
  { code: "31.03Z", label: "Fabrication de matelas", section: "C" },
  { code: "31.09A", label: "Fabrication de sièges d'ameublement d'intérieur", section: "C" },
  { code: "31.09B", label: "Fabrication d'autres meubles et industries connexes de l'ameublement", section: "C" },

  // Division 32 — Autres industries manufacturières
  { code: "32.11Z", label: "Frappe de monnaie", section: "C" },
  { code: "32.12Z", label: "Fabrication d'articles de joaillerie et bijouterie", section: "C" },
  { code: "32.13Z", label: "Fabrication d'articles de bijouterie fantaisie et articles similaires", section: "C" },
  { code: "32.20Z", label: "Fabrication d'instruments de musique", section: "C" },
  { code: "32.30Z", label: "Fabrication d'articles de sport", section: "C" },
  { code: "32.40Z", label: "Fabrication de jeux et jouets", section: "C" },
  { code: "32.50A", label: "Fabrication de matériel médico-chirurgical et dentaire", section: "C" },
  { code: "32.50B", label: "Fabrication de lunettes", section: "C" },
  { code: "32.91Z", label: "Fabrication d'articles de brosserie", section: "C" },
  { code: "32.99Z", label: "Autres activités manufacturières n.c.a.", section: "C" },

  // Division 33 — Réparation et installation de machines et d'équipements
  { code: "33.11Z", label: "Réparation d'ouvrages en métaux", section: "C" },
  { code: "33.12Z", label: "Réparation de machines et équipements mécaniques", section: "C" },
  { code: "33.13Z", label: "Réparation de matériels électroniques et optiques", section: "C" },
  { code: "33.14Z", label: "Réparation d'équipements électriques", section: "C" },
  { code: "33.15Z", label: "Réparation et maintenance navale", section: "C" },
  { code: "33.16Z", label: "Réparation et maintenance d'aéronefs et d'engins spatiaux", section: "C" },
  { code: "33.17Z", label: "Réparation et maintenance d'autres équipements de transport", section: "C" },
  { code: "33.19Z", label: "Réparation d'autres équipements", section: "C" },
  { code: "33.20A", label: "Installation de structures métalliques, chaudronnées et de tuyauterie", section: "C" },
  { code: "33.20B", label: "Installation de machines et équipements mécaniques", section: "C" },
  { code: "33.20C", label: "Conception d'ensemble et assemblage sur site industriel d'équipements de contrôle des processus industriels", section: "C" },
  { code: "33.20D", label: "Installation d'équipements électriques, de matériels électroniques et optiques ou d'autres matériels", section: "C" },

  // =========================================================================
  // SECTION D — Production et distribution d'électricité, de gaz (8 codes)
  // =========================================================================
  { code: "35.11Z", label: "Production d'électricité", section: "D" },
  { code: "35.12Z", label: "Transport d'électricité", section: "D" },
  { code: "35.13Z", label: "Distribution d'électricité", section: "D" },
  { code: "35.14Z", label: "Commerce d'électricité", section: "D" },
  { code: "35.21Z", label: "Production de combustibles gazeux", section: "D" },
  { code: "35.22Z", label: "Distribution de combustibles gazeux par conduites", section: "D" },
  { code: "35.23Z", label: "Commerce de combustibles gazeux par conduites", section: "D" },
  { code: "35.30Z", label: "Production et distribution de vapeur et d'air conditionné", section: "D" },

  // =========================================================================
  // SECTION E — Eau, assainissement, gestion des déchets (10 codes)
  // =========================================================================
  { code: "36.00Z", label: "Captage, traitement et distribution d'eau", section: "E" },
  { code: "37.00Z", label: "Collecte et traitement des eaux usées", section: "E" },
  { code: "38.11Z", label: "Collecte des déchets non dangereux", section: "E" },
  { code: "38.12Z", label: "Collecte des déchets dangereux", section: "E" },
  { code: "38.21Z", label: "Traitement et élimination des déchets non dangereux", section: "E" },
  { code: "38.22Z", label: "Traitement et élimination des déchets dangereux", section: "E" },
  { code: "38.31Z", label: "Démantèlement d'épaves", section: "E" },
  { code: "38.32Z", label: "Récupération de déchets triés", section: "E" },
  { code: "39.00Z", label: "Dépollution et autres services de gestion des déchets", section: "E" },

  // =========================================================================
  // SECTION F — Construction (45 codes)
  // =========================================================================
  { code: "41.10A", label: "Promotion immobilière de logements", section: "F" },
  { code: "41.10B", label: "Promotion immobilière de bureaux", section: "F" },
  { code: "41.10C", label: "Promotion immobilière d'autres bâtiments", section: "F" },
  { code: "41.10D", label: "Supports juridiques de programmes", section: "F" },
  { code: "41.20A", label: "Construction de maisons individuelles", section: "F" },
  { code: "41.20B", label: "Construction d'autres bâtiments", section: "F" },
  { code: "42.11Z", label: "Construction de routes et autoroutes", section: "F" },
  { code: "42.12Z", label: "Construction de voies ferrées de surface et souterraines", section: "F" },
  { code: "42.13A", label: "Construction d'ouvrages d'art", section: "F" },
  { code: "42.13B", label: "Construction et entretien de tunnels", section: "F" },
  { code: "42.21Z", label: "Construction de réseaux pour fluides", section: "F" },
  { code: "42.22Z", label: "Construction de réseaux électriques et de télécommunications", section: "F" },
  { code: "42.91Z", label: "Construction d'ouvrages maritimes et fluviaux", section: "F" },
  { code: "42.99Z", label: "Construction d'autres ouvrages de génie civil n.c.a.", section: "F" },
  { code: "43.11Z", label: "Travaux de démolition", section: "F" },
  { code: "43.12A", label: "Travaux de terrassement courants et travaux préparatoires", section: "F" },
  { code: "43.12B", label: "Travaux de terrassement spécialisés ou de grande masse", section: "F" },
  { code: "43.13Z", label: "Forages et sondages", section: "F" },
  { code: "43.21A", label: "Travaux d'installation électrique dans tous locaux", section: "F" },
  { code: "43.21B", label: "Travaux d'installation électrique sur la voie publique", section: "F" },
  { code: "43.22A", label: "Travaux d'installation d'eau et de gaz en tous locaux", section: "F" },
  { code: "43.22B", label: "Travaux d'installation d'équipements thermiques et de climatisation", section: "F" },
  { code: "43.29A", label: "Travaux d'isolation", section: "F" },
  { code: "43.29B", label: "Autres travaux d'installation n.c.a.", section: "F" },
  { code: "43.31Z", label: "Travaux de plâtrerie", section: "F" },
  { code: "43.32A", label: "Travaux de menuiserie bois et PVC", section: "F" },
  { code: "43.32B", label: "Travaux de menuiserie métallique et serrurerie", section: "F" },
  { code: "43.32C", label: "Agencement de lieux de vente", section: "F" },
  { code: "43.33Z", label: "Travaux de revêtement des sols et des murs", section: "F" },
  { code: "43.34Z", label: "Travaux de peinture et vitrerie", section: "F" },
  { code: "43.39Z", label: "Autres travaux de finition", section: "F" },
  { code: "43.91A", label: "Travaux de charpente", section: "F" },
  { code: "43.91B", label: "Travaux de couverture par éléments", section: "F" },
  { code: "43.99A", label: "Travaux d'étanchéification", section: "F" },
  { code: "43.99B", label: "Travaux de montage de structures métalliques", section: "F" },
  { code: "43.99C", label: "Travaux de maçonnerie générale et gros oeuvre de bâtiment", section: "F" },
  { code: "43.99D", label: "Autres travaux spécialisés de construction", section: "F" },
  { code: "43.99E", label: "Location avec opérateur de matériel de construction", section: "F" },

  // =========================================================================
  // SECTION G — Commerce ; réparation d'automobiles et de motocycles (141 codes)
  // =========================================================================

  // Division 45 — Commerce et réparation d'automobiles et de motocycles
  { code: "45.11Z", label: "Commerce de voitures et de véhicules automobiles légers", section: "G" },
  { code: "45.19Z", label: "Commerce d'autres véhicules automobiles", section: "G" },
  { code: "45.20A", label: "Entretien et réparation de véhicules automobiles légers", section: "G" },
  { code: "45.20B", label: "Entretien et réparation d'autres véhicules automobiles", section: "G" },
  { code: "45.31Z", label: "Commerce de gros d'équipements automobiles", section: "G" },
  { code: "45.32Z", label: "Commerce de détail d'équipements automobiles", section: "G" },
  { code: "45.40Z", label: "Commerce et réparation de motocycles", section: "G" },

  // Division 46 — Commerce de gros
  { code: "46.11Z", label: "Intermédiaires du commerce en matières premières agricoles, animaux vivants, matières premières textiles et produits semi-finis", section: "G" },
  { code: "46.12A", label: "Centrales d'achat de carburant", section: "G" },
  { code: "46.12B", label: "Autres intermédiaires du commerce en combustibles, métaux, minéraux et produits chimiques", section: "G" },
  { code: "46.13Z", label: "Intermédiaires du commerce en bois et matériaux de construction", section: "G" },
  { code: "46.14Z", label: "Intermédiaires du commerce en machines, équipements industriels, navires et avions", section: "G" },
  { code: "46.15Z", label: "Intermédiaires du commerce en meubles, articles de ménage et quincaillerie", section: "G" },
  { code: "46.16Z", label: "Intermédiaires du commerce en textiles, habillement, fourrures, chaussures et articles en cuir", section: "G" },
  { code: "46.17A", label: "Centrales d'achat alimentaires", section: "G" },
  { code: "46.17B", label: "Autres intermédiaires du commerce en denrées, boissons et tabac", section: "G" },
  { code: "46.18Z", label: "Intermédiaires spécialisés dans le commerce d'autres produits spécifiques", section: "G" },
  { code: "46.19A", label: "Centrales d'achat non alimentaires", section: "G" },
  { code: "46.19B", label: "Autres intermédiaires du commerce en produits divers", section: "G" },
  { code: "46.21Z", label: "Commerce de gros de céréales, de tabac non manufacturé, de semences et d'aliments pour le bétail", section: "G" },
  { code: "46.22Z", label: "Commerce de gros de fleurs et plantes", section: "G" },
  { code: "46.23Z", label: "Commerce de gros d'animaux vivants", section: "G" },
  { code: "46.24Z", label: "Commerce de gros de cuirs et peaux", section: "G" },
  { code: "46.31Z", label: "Commerce de gros de fruits et légumes", section: "G" },
  { code: "46.32A", label: "Commerce de gros de viandes de boucherie", section: "G" },
  { code: "46.32B", label: "Commerce de gros de produits à base de viande", section: "G" },
  { code: "46.32C", label: "Commerce de gros de volailles et gibier", section: "G" },
  { code: "46.33Z", label: "Commerce de gros de produits laitiers, oeufs, huiles et matières grasses comestibles", section: "G" },
  { code: "46.34Z", label: "Commerce de gros de boissons", section: "G" },
  { code: "46.35Z", label: "Commerce de gros de produits à base de tabac", section: "G" },
  { code: "46.36Z", label: "Commerce de gros de sucre, chocolat et confiserie", section: "G" },
  { code: "46.37Z", label: "Commerce de gros de café, thé, cacao et épices", section: "G" },
  { code: "46.38A", label: "Commerce de gros de poissons, crustacés et mollusques", section: "G" },
  { code: "46.38B", label: "Commerce de gros alimentaire spécialisé divers", section: "G" },
  { code: "46.39A", label: "Commerce de gros de produits surgelés", section: "G" },
  { code: "46.39B", label: "Commerce de gros alimentaire non spécialisé", section: "G" },
  { code: "46.41Z", label: "Commerce de gros de textiles", section: "G" },
  { code: "46.42Z", label: "Commerce de gros d'habillement et de chaussures", section: "G" },
  { code: "46.43Z", label: "Commerce de gros d'appareils électroménagers", section: "G" },
  { code: "46.44Z", label: "Commerce de gros de vaisselle, verrerie et produits d'entretien", section: "G" },
  { code: "46.45Z", label: "Commerce de gros de parfumerie et de produits de beauté", section: "G" },
  { code: "46.46Z", label: "Commerce de gros de produits pharmaceutiques", section: "G" },
  { code: "46.47Z", label: "Commerce de gros de meubles, de tapis et d'appareils d'éclairage", section: "G" },
  { code: "46.48Z", label: "Commerce de gros d'articles d'horlogerie et de bijouterie", section: "G" },
  { code: "46.49Z", label: "Commerce de gros d'autres biens domestiques", section: "G" },
  { code: "46.51Z", label: "Commerce de gros d'ordinateurs, d'équipements informatiques périphériques et de logiciels", section: "G" },
  { code: "46.52Z", label: "Commerce de gros de composants et d'équipements électroniques et de télécommunication", section: "G" },
  { code: "46.61Z", label: "Commerce de gros de matériel agricole", section: "G" },
  { code: "46.62Z", label: "Commerce de gros de machines-outils", section: "G" },
  { code: "46.63Z", label: "Commerce de gros de machines pour l'extraction, la construction et le génie civil", section: "G" },
  { code: "46.64Z", label: "Commerce de gros de machines pour l'industrie textile et l'habillement", section: "G" },
  { code: "46.65Z", label: "Commerce de gros de mobilier de bureau", section: "G" },
  { code: "46.66Z", label: "Commerce de gros d'autres machines et équipements de bureau", section: "G" },
  { code: "46.69A", label: "Commerce de gros de matériel électrique", section: "G" },
  { code: "46.69B", label: "Commerce de gros de fournitures et équipements industriels divers", section: "G" },
  { code: "46.69C", label: "Commerce de gros de fournitures et équipements divers pour le commerce et les services", section: "G" },
  { code: "46.71Z", label: "Commerce de gros de combustibles et de produits annexes", section: "G" },
  { code: "46.72Z", label: "Commerce de gros de minerais et métaux", section: "G" },
  { code: "46.73A", label: "Commerce de gros de bois et de matériaux de construction", section: "G" },
  { code: "46.73B", label: "Commerce de gros d'appareils sanitaires et de produits de décoration", section: "G" },
  { code: "46.74A", label: "Commerce de gros de quincaillerie", section: "G" },
  { code: "46.74B", label: "Commerce de gros de fournitures pour la plomberie et le chauffage", section: "G" },
  { code: "46.75Z", label: "Commerce de gros de produits chimiques", section: "G" },
  { code: "46.76Z", label: "Commerce de gros d'autres produits intermédiaires", section: "G" },
  { code: "46.77Z", label: "Commerce de gros de déchets et débris", section: "G" },

  // Division 47 — Commerce de détail (already selected above: 47.91A/B, 47.11D/F, plus the rest)
  { code: "47.11A", label: "Commerce de détail de produits surgelés", section: "G" },
  { code: "47.11B", label: "Commerce d'alimentation générale", section: "G" },
  { code: "47.11C", label: "Supérettes", section: "G" },
  { code: "47.11E", label: "Magasins multi-commerces", section: "G" },
  { code: "47.19A", label: "Grands magasins", section: "G" },
  { code: "47.19B", label: "Autres commerces de détail en magasin non spécialisé", section: "G" },
  { code: "47.21Z", label: "Commerce de détail de fruits et légumes en magasin spécialisé", section: "G" },
  { code: "47.22Z", label: "Commerce de détail de viandes et de produits à base de viande en magasin spécialisé", section: "G" },
  { code: "47.23Z", label: "Commerce de détail de poissons, crustacés et mollusques en magasin spécialisé", section: "G" },
  { code: "47.24Z", label: "Commerce de détail de pain, pâtisserie et confiserie en magasin spécialisé", section: "G" },
  { code: "47.25Z", label: "Commerce de détail de boissons en magasin spécialisé", section: "G" },
  { code: "47.26Z", label: "Commerce de détail de produits à base de tabac en magasin spécialisé", section: "G" },
  { code: "47.29Z", label: "Autres commerces de détail alimentaires en magasin spécialisé", section: "G" },
  { code: "47.30Z", label: "Commerce de détail de carburants en magasin spécialisé", section: "G" },
  { code: "47.41Z", label: "Commerce de détail d'ordinateurs, d'unités périphériques et de logiciels en magasin spécialisé", section: "G" },
  { code: "47.42Z", label: "Commerce de détail de matériels de télécommunication en magasin spécialisé", section: "G" },
  { code: "47.43Z", label: "Commerce de détail de matériels audio et vidéo en magasin spécialisé", section: "G" },
  { code: "47.51Z", label: "Commerce de détail de textiles en magasin spécialisé", section: "G" },
  { code: "47.52A", label: "Commerce de détail de quincaillerie, peintures et verres en petites surfaces (moins de 400 m2)", section: "G" },
  { code: "47.52B", label: "Commerce de détail de quincaillerie, peintures et verres en grandes surfaces (400 m2 et plus)", section: "G" },
  { code: "47.53Z", label: "Commerce de détail de tapis, moquettes et revêtements de murs et de sols en magasin spécialisé", section: "G" },
  { code: "47.54Z", label: "Commerce de détail d'appareils électroménagers en magasin spécialisé", section: "G" },
  { code: "47.59A", label: "Commerce de détail de meubles", section: "G" },
  { code: "47.59B", label: "Commerce de détail d'autres équipements du foyer", section: "G" },
  { code: "47.61Z", label: "Commerce de détail de livres en magasin spécialisé", section: "G" },
  { code: "47.62Z", label: "Commerce de détail de journaux et papeterie en magasin spécialisé", section: "G" },
  { code: "47.63Z", label: "Commerce de détail d'enregistrements musicaux et vidéo en magasin spécialisé", section: "G" },
  { code: "47.64Z", label: "Commerce de détail d'articles de sport en magasin spécialisé", section: "G" },
  { code: "47.65Z", label: "Commerce de détail de jeux et jouets en magasin spécialisé", section: "G" },
  { code: "47.71Z", label: "Commerce de détail d'habillement en magasin spécialisé", section: "G" },
  { code: "47.72A", label: "Commerce de détail de la chaussure", section: "G" },
  { code: "47.72B", label: "Commerce de détail de maroquinerie et d'articles de voyage", section: "G" },
  { code: "47.73Z", label: "Commerce de détail de produits pharmaceutiques en magasin spécialisé", section: "G" },
  { code: "47.74Z", label: "Commerce de détail d'articles médicaux et orthopédiques en magasin spécialisé", section: "G" },
  { code: "47.75Z", label: "Commerce de détail de parfumerie et de produits de beauté en magasin spécialisé", section: "G" },
  { code: "47.76Z", label: "Commerce de détail de fleurs, plantes, graines, engrais, animaux de compagnie et aliments pour ces animaux en magasin spécialisé", section: "G" },
  { code: "47.77Z", label: "Commerce de détail d'articles d'horlogerie et de bijouterie en magasin spécialisé", section: "G" },
  { code: "47.78A", label: "Commerces de détail d'optique", section: "G" },
  { code: "47.78B", label: "Commerces de détail de charbons et combustibles", section: "G" },
  { code: "47.78C", label: "Autres commerces de détail spécialisés divers", section: "G" },
  { code: "47.79Z", label: "Commerce de détail de biens d'occasion en magasin", section: "G" },
  { code: "47.81Z", label: "Commerce de détail alimentaire sur éventaires et marchés", section: "G" },
  { code: "47.82Z", label: "Commerce de détail de textiles, d'habillement et de chaussures sur éventaires et marchés", section: "G" },
  { code: "47.89Z", label: "Autres commerces de détail sur éventaires et marchés", section: "G" },
  { code: "47.99A", label: "Vente à domicile", section: "G" },
  { code: "47.99B", label: "Vente par automates et autres commerces de détail hors magasin, éventaires ou marchés n.c.a.", section: "G" },

  // =========================================================================
  // SECTION H — Transports et entreposage (34 codes)
  // =========================================================================
  { code: "49.10Z", label: "Transport ferroviaire interurbain de voyageurs", section: "H" },
  { code: "49.20Z", label: "Transports ferroviaires de fret", section: "H" },
  { code: "49.31Z", label: "Transports urbains et suburbains de voyageurs", section: "H" },
  { code: "49.32Z", label: "Transports de voyageurs par taxis", section: "H" },
  { code: "49.39A", label: "Transports routiers réguliers de voyageurs", section: "H" },
  { code: "49.39B", label: "Autres transports routiers de voyageurs", section: "H" },
  { code: "49.39C", label: "Téléphériques et remontées mécaniques", section: "H" },
  { code: "49.41A", label: "Transports routiers de fret interurbains", section: "H" },
  { code: "49.41B", label: "Transports routiers de fret de proximité", section: "H" },
  { code: "49.41C", label: "Location de camions avec chauffeur", section: "H" },
  { code: "49.42Z", label: "Services de déménagement", section: "H" },
  { code: "49.50Z", label: "Transports par conduites", section: "H" },
  { code: "50.10Z", label: "Transports maritimes et côtiers de passagers", section: "H" },
  { code: "50.20Z", label: "Transports maritimes et côtiers de fret", section: "H" },
  { code: "50.30Z", label: "Transports fluviaux de passagers", section: "H" },
  { code: "50.40Z", label: "Transports fluviaux de fret", section: "H" },
  { code: "51.10Z", label: "Transports aériens de passagers", section: "H" },
  { code: "51.21Z", label: "Transports aériens de fret", section: "H" },
  { code: "51.22Z", label: "Transports spatiaux", section: "H" },
  { code: "52.10A", label: "Entreposage et stockage frigorifique", section: "H" },
  { code: "52.10B", label: "Entreposage et stockage non frigorifique", section: "H" },
  { code: "52.21Z", label: "Services auxiliaires des transports terrestres", section: "H" },
  { code: "52.22Z", label: "Services auxiliaires des transports par eau", section: "H" },
  { code: "52.23Z", label: "Services auxiliaires des transports aériens", section: "H" },
  { code: "52.24A", label: "Manutention portuaire", section: "H" },
  { code: "52.24B", label: "Manutention non portuaire", section: "H" },
  { code: "52.29A", label: "Messagerie, fret express", section: "H" },
  { code: "52.29B", label: "Affrètement et organisation des transports", section: "H" },
  { code: "53.10Z", label: "Activités de poste dans le cadre d'une obligation de service universel", section: "H" },
  { code: "53.20Z", label: "Autres activités de poste et de courrier", section: "H" },

  // =========================================================================
  // SECTION I — Hébergement et restauration (10 codes)
  // =========================================================================
  { code: "55.10Z", label: "Hôtels et hébergement similaire", section: "I" },
  { code: "55.20Z", label: "Hébergement touristique et autre hébergement de courte durée", section: "I" },
  { code: "55.30Z", label: "Terrains de camping et parcs pour caravanes ou véhicules de loisirs", section: "I" },
  { code: "55.90Z", label: "Autres hébergements", section: "I" },
  { code: "56.10B", label: "Cafétérias et autres libres-services", section: "I" },
  { code: "56.21Z", label: "Services des traiteurs", section: "I" },
  { code: "56.29A", label: "Restauration collective sous contrat", section: "I" },
  { code: "56.29B", label: "Autres services de restauration n.c.a.", section: "I" },
  { code: "56.30Z", label: "Débits de boissons", section: "I" },

  // =========================================================================
  // SECTION J — Information et communication (reste des codes)
  // =========================================================================
  { code: "58.11Z", label: "Édition de livres", section: "J" },
  { code: "58.12Z", label: "Édition de répertoires et de fichiers d'adresses", section: "J" },
  { code: "58.13Z", label: "Édition de journaux", section: "J" },
  { code: "58.14Z", label: "Édition de revues et périodiques", section: "J" },
  { code: "58.19Z", label: "Autres activités d'édition", section: "J" },
  { code: "59.11A", label: "Production de films et de programmes pour la télévision", section: "J" },
  { code: "59.11B", label: "Production de films institutionnels et publicitaires", section: "J" },
  { code: "59.11C", label: "Production de films pour le cinéma", section: "J" },
  { code: "59.12Z", label: "Post-production de films cinématographiques, de vidéo et de programmes de télévision", section: "J" },
  { code: "59.13A", label: "Distribution de films cinématographiques", section: "J" },
  { code: "59.13B", label: "Édition et distribution vidéo", section: "J" },
  { code: "59.14Z", label: "Projection de films cinématographiques", section: "J" },
  { code: "59.20Z", label: "Enregistrement sonore et édition musicale", section: "J" },
  { code: "60.10Z", label: "Édition et diffusion de programmes radio", section: "J" },
  { code: "60.20A", label: "Édition de chaînes généralistes", section: "J" },
  { code: "60.20B", label: "Édition de chaînes thématiques", section: "J" },
  { code: "61.10Z", label: "Télécommunications filaires", section: "J" },
  { code: "61.20Z", label: "Télécommunications sans fil", section: "J" },
  { code: "61.30Z", label: "Télécommunications par satellite", section: "J" },
  { code: "61.90Z", label: "Autres activités de télécommunication", section: "J" },
  { code: "63.91Z", label: "Activités des agences de presse", section: "J" },
  { code: "63.99Z", label: "Autres services d'information n.c.a.", section: "J" },

  // =========================================================================
  // SECTION K — Activités financières et d'assurance (24 codes)
  // =========================================================================
  { code: "64.11Z", label: "Activités de banque centrale", section: "K" },
  { code: "64.19Z", label: "Autres intermédiations monétaires", section: "K" },
  { code: "64.30Z", label: "Fonds de placement et entités financières similaires", section: "K" },
  { code: "64.91Z", label: "Crédit-bail", section: "K" },
  { code: "64.92Z", label: "Autre distribution de crédit", section: "K" },
  { code: "64.99Z", label: "Autres activités des services financiers, hors assurance et caisses de retraite, n.c.a.", section: "K" },
  { code: "65.11Z", label: "Assurance vie", section: "K" },
  { code: "65.12Z", label: "Autres assurances", section: "K" },
  { code: "65.20Z", label: "Réassurance", section: "K" },
  { code: "65.30Z", label: "Caisses de retraite", section: "K" },
  { code: "66.11Z", label: "Administration de marchés financiers", section: "K" },
  { code: "66.12Z", label: "Courtage de valeurs mobilières et de marchandises", section: "K" },
  { code: "66.19A", label: "Supports juridiques de gestion de patrimoine mobilier", section: "K" },
  { code: "66.19B", label: "Autres activités auxiliaires de services financiers, hors assurance et caisses de retraite, n.c.a.", section: "K" },
  { code: "66.21Z", label: "Évaluation des risques et dommages", section: "K" },
  { code: "66.22Z", label: "Activités des agents et courtiers d'assurances", section: "K" },
  { code: "66.29Z", label: "Autres activités auxiliaires d'assurance et de caisses de retraite", section: "K" },
  { code: "66.30Z", label: "Gestion de fonds", section: "K" },

  // =========================================================================
  // SECTION L — Activités immobilières (6 codes)
  // =========================================================================
  { code: "68.10Z", label: "Activités des marchands de biens immobiliers", section: "L" },
  { code: "68.20A", label: "Location de logements", section: "L" },
  { code: "68.20B", label: "Location de terrains et d'autres biens immobiliers", section: "L" },
  { code: "68.31Z", label: "Agences immobilières", section: "L" },
  { code: "68.32A", label: "Administration d'immeubles et autres biens immobiliers", section: "L" },
  { code: "68.32B", label: "Supports juridiques de gestion de patrimoine immobilier", section: "L" },

  // =========================================================================
  // SECTION M — Activités spécialisées, scientifiques et techniques (reste)
  // =========================================================================
  { code: "71.12A", label: "Activité des géomètres", section: "M" },
  { code: "71.20A", label: "Contrôle technique automobile", section: "M" },
  { code: "71.20B", label: "Analyses, essais et inspections techniques", section: "M" },
  { code: "72.11Z", label: "Recherche-développement en biotechnologie", section: "M" },
  { code: "72.19Z", label: "Recherche-développement en autres sciences physiques et naturelles", section: "M" },
  { code: "72.20Z", label: "Recherche-développement en sciences humaines et sociales", section: "M" },
  { code: "73.20Z", label: "Études de marché et sondages", section: "M" },
  { code: "74.90A", label: "Activité des économistes de la construction", section: "M" },
  { code: "74.90B", label: "Activités spécialisées, scientifiques et techniques diverses", section: "M" },
  { code: "75.00Z", label: "Activités vétérinaires", section: "M" },

  // =========================================================================
  // SECTION N — Activités de services administratifs et de soutien (42 codes)
  // =========================================================================
  { code: "77.11A", label: "Location de courte durée de voitures et de véhicules automobiles légers", section: "N" },
  { code: "77.11B", label: "Location de longue durée de voitures et de véhicules automobiles légers", section: "N" },
  { code: "77.12Z", label: "Location et location-bail de camions", section: "N" },
  { code: "77.21Z", label: "Location et location-bail d'articles de loisirs et de sport", section: "N" },
  { code: "77.22Z", label: "Location de vidéocassettes et disques vidéo", section: "N" },
  { code: "77.29Z", label: "Location et location-bail d'autres biens personnels et domestiques", section: "N" },
  { code: "77.31Z", label: "Location et location-bail de machines et équipements agricoles", section: "N" },
  { code: "77.32Z", label: "Location et location-bail de machines et équipements pour la construction", section: "N" },
  { code: "77.33Z", label: "Location et location-bail de machines de bureau et de matériel informatique", section: "N" },
  { code: "77.34Z", label: "Location et location-bail de matériels de transport par eau", section: "N" },
  { code: "77.35Z", label: "Location et location-bail de matériels de transport aérien", section: "N" },
  { code: "77.39Z", label: "Location et location-bail d'autres machines, équipements et biens matériels n.c.a.", section: "N" },
  { code: "77.40Z", label: "Location-bail de propriété intellectuelle et de produits similaires, à l'exception des oeuvres soumises à copyright", section: "N" },
  { code: "78.30Z", label: "Autre mise à disposition de ressources humaines", section: "N" },
  { code: "79.11Z", label: "Activités des agences de voyage", section: "N" },
  { code: "79.12Z", label: "Activités des voyagistes", section: "N" },
  { code: "79.90Z", label: "Autres services de réservation et activités connexes", section: "N" },
  { code: "80.10Z", label: "Activités de sécurité privée", section: "N" },
  { code: "80.20Z", label: "Activités liées aux systèmes de sécurité", section: "N" },
  { code: "80.30Z", label: "Activités d'enquête", section: "N" },
  { code: "81.10Z", label: "Activités combinées de soutien lié aux bâtiments", section: "N" },
  { code: "81.21Z", label: "Nettoyage courant des bâtiments", section: "N" },
  { code: "81.22Z", label: "Autres activités de nettoyage des bâtiments et nettoyage industriel", section: "N" },
  { code: "81.29A", label: "Désinfection, désinsectisation, dératisation", section: "N" },
  { code: "81.29B", label: "Autres activités de nettoyage n.c.a.", section: "N" },
  { code: "81.30Z", label: "Services d'aménagement paysager", section: "N" },
  { code: "82.11Z", label: "Services administratifs combinés de bureau", section: "N" },
  { code: "82.19Z", label: "Photocopie, préparation de documents et autres activités spécialisées de soutien de bureau", section: "N" },
  { code: "82.20Z", label: "Activités de centres d'appels", section: "N" },
  { code: "82.30Z", label: "Organisation de foires, salons professionnels et congrès", section: "N" },
  { code: "82.91Z", label: "Activités des agences de recouvrement de factures et des sociétés d'information financière sur la clientèle", section: "N" },
  { code: "82.92Z", label: "Activités de conditionnement", section: "N" },

  // =========================================================================
  // SECTION O — Administration publique (13 codes)
  // =========================================================================
  { code: "84.11Z", label: "Administration publique générale", section: "O" },
  { code: "84.12Z", label: "Administration publique (tutelle) de la santé, de la formation, de la culture et des services sociaux, autre que sécurité sociale", section: "O" },
  { code: "84.13Z", label: "Administration publique (tutelle) des activités économiques", section: "O" },
  { code: "84.21Z", label: "Affaires étrangères", section: "O" },
  { code: "84.22Z", label: "Défense", section: "O" },
  { code: "84.23Z", label: "Justice", section: "O" },
  { code: "84.24Z", label: "Activités d'ordre public et de sécurité", section: "O" },
  { code: "84.25Z", label: "Services du feu et de secours", section: "O" },
  { code: "84.30A", label: "Activités générales de sécurité sociale", section: "O" },
  { code: "84.30B", label: "Gestion des retraites complémentaires", section: "O" },
  { code: "84.30C", label: "Distribution sociale de revenus", section: "O" },

  // =========================================================================
  // SECTION P — Enseignement (12 codes)
  // =========================================================================
  { code: "85.10Z", label: "Enseignement pré-primaire", section: "P" },
  { code: "85.20Z", label: "Enseignement primaire", section: "P" },
  { code: "85.31Z", label: "Enseignement secondaire général", section: "P" },
  { code: "85.32Z", label: "Enseignement secondaire technique ou professionnel", section: "P" },
  { code: "85.41Z", label: "Enseignement post-secondaire non supérieur", section: "P" },
  { code: "85.42Z", label: "Enseignement supérieur", section: "P" },
  { code: "85.51Z", label: "Enseignement de disciplines sportives et d'activités de loisirs", section: "P" },
  { code: "85.52Z", label: "Enseignement culturel", section: "P" },
  { code: "85.53Z", label: "Enseignement de la conduite", section: "P" },
  { code: "85.59A", label: "Formation continue d'adultes", section: "P" },
  { code: "85.59B", label: "Autres enseignements", section: "P" },
  { code: "85.60Z", label: "Activités de soutien à l'enseignement", section: "P" },

  // =========================================================================
  // SECTION Q — Santé humaine et action sociale (36 codes)
  // =========================================================================
  { code: "86.10Z", label: "Activités hospitalières", section: "Q" },
  { code: "86.21Z", label: "Activité des médecins généralistes", section: "Q" },
  { code: "86.22A", label: "Activités de radiodiagnostic et de radiothérapie", section: "Q" },
  { code: "86.22B", label: "Activités chirurgicales", section: "Q" },
  { code: "86.22C", label: "Autres activités des médecins spécialistes", section: "Q" },
  { code: "86.23Z", label: "Pratique dentaire", section: "Q" },
  { code: "86.90A", label: "Ambulances", section: "Q" },
  { code: "86.90B", label: "Laboratoires d'analyses médicales", section: "Q" },
  { code: "86.90C", label: "Centres de collecte et banques d'organes", section: "Q" },
  { code: "86.90D", label: "Activités des infirmiers et des sages-femmes", section: "Q" },
  { code: "86.90E", label: "Activités des professionnels de la rééducation, de l'appareillage et des pédicures-podologues", section: "Q" },
  { code: "86.90F", label: "Activités de santé humaine non classées ailleurs", section: "Q" },
  { code: "87.10A", label: "Hébergement médicalisé pour personnes âgées", section: "Q" },
  { code: "87.10B", label: "Hébergement médicalisé pour enfants handicapés", section: "Q" },
  { code: "87.10C", label: "Hébergement médicalisé pour adultes handicapés et autre hébergement médicalisé", section: "Q" },
  { code: "87.20A", label: "Hébergement social pour handicapés mentaux et malades mentaux", section: "Q" },
  { code: "87.20B", label: "Hébergement social pour toxicomanes", section: "Q" },
  { code: "87.30A", label: "Hébergement social pour personnes âgées", section: "Q" },
  { code: "87.30B", label: "Hébergement social pour handicapés physiques", section: "Q" },
  { code: "87.90A", label: "Hébergement social pour enfants en difficultés", section: "Q" },
  { code: "87.90B", label: "Hébergement social pour adultes et familles en difficultés et autre hébergement social", section: "Q" },
  { code: "88.10A", label: "Aide à domicile", section: "Q" },
  { code: "88.10B", label: "Accueil ou accompagnement sans hébergement d'adultes handicapés ou de personnes âgées", section: "Q" },
  { code: "88.10C", label: "Aide par le travail", section: "Q" },
  { code: "88.91A", label: "Accueil de jeunes enfants", section: "Q" },
  { code: "88.91B", label: "Accueil ou accompagnement sans hébergement d'enfants handicapés", section: "Q" },
  { code: "88.99A", label: "Autre accueil ou accompagnement sans hébergement d'enfants et d'adolescents", section: "Q" },
  { code: "88.99B", label: "Action sociale sans hébergement n.c.a.", section: "Q" },

  // =========================================================================
  // SECTION R — Arts, spectacles et activités récréatives (14 codes)
  // =========================================================================
  { code: "90.01Z", label: "Arts du spectacle vivant", section: "R" },
  { code: "90.02Z", label: "Activités de soutien au spectacle vivant", section: "R" },
  { code: "90.03A", label: "Création artistique relevant des arts plastiques", section: "R" },
  { code: "90.03B", label: "Autre création artistique", section: "R" },
  { code: "90.04Z", label: "Gestion de salles de spectacles", section: "R" },
  { code: "91.01Z", label: "Gestion des bibliothèques et des archives", section: "R" },
  { code: "91.02Z", label: "Gestion des musées", section: "R" },
  { code: "91.03Z", label: "Gestion des sites et monuments historiques et des attractions touristiques similaires", section: "R" },
  { code: "91.04Z", label: "Gestion des jardins botaniques et zoologiques et des réserves naturelles", section: "R" },
  { code: "92.00Z", label: "Organisation de jeux de hasard et d'argent", section: "R" },
  { code: "93.11Z", label: "Gestion d'installations sportives", section: "R" },
  { code: "93.12Z", label: "Activités de clubs de sports", section: "R" },
  { code: "93.13Z", label: "Activités des centres de culture physique", section: "R" },
  { code: "93.19Z", label: "Autres activités liées au sport", section: "R" },
  { code: "93.21Z", label: "Activités des parcs d'attractions et parcs à thèmes", section: "R" },
  { code: "93.29Z", label: "Autres activités récréatives et de loisirs", section: "R" },

  // =========================================================================
  // SECTION S — Autres activités de services (28 codes)
  // =========================================================================
  { code: "94.11Z", label: "Activités des organisations patronales et consulaires", section: "S" },
  { code: "94.12Z", label: "Activités des organisations professionnelles", section: "S" },
  { code: "94.20Z", label: "Activités des syndicats de salariés", section: "S" },
  { code: "94.91Z", label: "Activités des organisations religieuses", section: "S" },
  { code: "94.92Z", label: "Activités des organisations politiques", section: "S" },
  { code: "94.99Z", label: "Autres organisations fonctionnant par adhésion volontaire", section: "S" },
  { code: "95.11Z", label: "Réparation d'ordinateurs et d'équipements périphériques", section: "S" },
  { code: "95.12Z", label: "Réparation d'équipements de communication", section: "S" },
  { code: "95.21Z", label: "Réparation de produits électroniques grand public", section: "S" },
  { code: "95.22Z", label: "Réparation d'appareils électroménagers et d'équipements pour la maison et le jardin", section: "S" },
  { code: "95.23Z", label: "Réparation de chaussures et d'articles en cuir", section: "S" },
  { code: "95.24Z", label: "Réparation de meubles et d'équipements du foyer", section: "S" },
  { code: "95.25Z", label: "Réparation d'articles d'horlogerie et de bijouterie", section: "S" },
  { code: "95.29Z", label: "Réparation d'autres biens personnels et domestiques", section: "S" },
  { code: "96.01A", label: "Blanchisserie-teinturerie de gros", section: "S" },
  { code: "96.01B", label: "Blanchisserie-teinturerie de détail", section: "S" },
  { code: "96.02A", label: "Coiffure", section: "S" },
  { code: "96.02B", label: "Soins de beauté", section: "S" },
  { code: "96.03Z", label: "Services funéraires", section: "S" },
  { code: "96.04Z", label: "Entretien corporel", section: "S" },
  { code: "96.09Z", label: "Autres services personnels n.c.a.", section: "S" },

  // =========================================================================
  // SECTION T — Activités des ménages en tant qu'employeurs (3 codes)
  // =========================================================================
  { code: "97.00Z", label: "Activités des ménages en tant qu'employeurs de personnel domestique", section: "T" },
  { code: "98.10Z", label: "Activités indifférenciées des ménages en tant que producteurs de biens pour usage propre", section: "T" },
  { code: "98.20Z", label: "Activités indifférenciées des ménages en tant que producteurs de services pour usage propre", section: "T" },

  // =========================================================================
  // SECTION U — Activités extra-territoriales (1 code)
  // =========================================================================
  { code: "99.00Z", label: "Activités des organisations et organismes extraterritoriaux", section: "U" },
];

// ---------------------------------------------------------------------------
// Recherche de codes NAF avec normalisation des accents
// ---------------------------------------------------------------------------

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function searchNafCodes(query: string, limit = 30): NafEntry[] {
  const normalized = removeAccents(query.trim()).toLowerCase();
  if (!normalized) return [];

  const results: NafEntry[] = [];

  for (const entry of NAF_CODES) {
    if (results.length >= limit) break;

    const codeMatch = removeAccents(entry.code).toLowerCase().includes(normalized);
    const labelMatch = removeAccents(entry.label).toLowerCase().includes(normalized);

    if (codeMatch || labelMatch) {
      results.push(entry);
    }
  }

  return results;
}
