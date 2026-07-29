// Catálogo semilla: 215 licores.
//
// Generado a partir del insert_licores.sql del proyecto original, que a su vez
// venía de la transcripción de una carta real. Se versiona aquí para que la base
// de datos sea reproducible desde cero con `npm run db:seed`.
//
// No editar a mano si se puede evitar: es dato, no código.

export interface SeedProduct {
  name: string;
  category: string;
  brand: string | null;
  subcategory: string | null;
  abv: number | null;
  origin: string | null;
  age: string | null;
}

export const seedProducts: SeedProduct[] = [
  {
    "name": "AMARO DEL CAPO",
    "category": "AMARI & LIQUEURS",
    "brand": "AMARO DEL CAPO",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "AMARO SIBILLA",
    "category": "AMARI & LIQUEURS",
    "brand": "AMARO SIBILLA",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "AMARO TOSOLINI",
    "category": "AMARI & LIQUEURS",
    "brand": "AMARO TOSOLINI",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "AVERNA",
    "category": "AMARI & LIQUEURS",
    "brand": "AVERNA",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "FERNET BRANCA",
    "category": "AMARI & LIQUEURS",
    "brand": "FERNET BRANCA",
    "subcategory": "Fernet",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "MONTENEGRO",
    "category": "AMARI & LIQUEURS",
    "brand": "MONTENEGRO",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "NONINO AMARO",
    "category": "AMARI & LIQUEURS",
    "brand": "NONINO",
    "subcategory": "Amaro",
    "abv": null,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "BAILEYS",
    "category": "AMARI & LIQUEURS",
    "brand": "BAILEYS",
    "subcategory": "Cream Liqueur",
    "abv": 17,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "BENEDICTINE",
    "category": "AMARI & LIQUEURS",
    "brand": "BENEDICTINE",
    "subcategory": "Herbal Liqueur",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "CAFFE BORGHETTI",
    "category": "AMARI & LIQUEURS",
    "brand": "CAFFE BORGHETTI",
    "subcategory": "Coffee Liqueur",
    "abv": 25,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "CHAMBORD",
    "category": "AMARI & LIQUEURS",
    "brand": "CHAMBORD",
    "subcategory": "Raspberry Liqueur",
    "abv": 16.5,
    "origin": "France",
    "age": null
  },
  {
    "name": "CHERRY HERRING",
    "category": "AMARI & LIQUEURS",
    "brand": "CHERRY HERRING",
    "subcategory": "Cherry Liqueur",
    "abv": 24.7,
    "origin": "Denmark",
    "age": null
  },
  {
    "name": "COINTREAU",
    "category": "AMARI & LIQUEURS",
    "brand": "COINTREAU",
    "subcategory": "Orange Liqueur",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "FRANGELICO",
    "category": "AMARI & LIQUEURS",
    "brand": "FRANGELICO",
    "subcategory": "Hazelnut Liqueur",
    "abv": 20,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "GIFFARD CRÈME LIQUEURS",
    "category": "AMARI & LIQUEURS",
    "brand": "GIFFARD",
    "subcategory": "Crème Liqueur",
    "abv": null,
    "origin": "France",
    "age": null
  },
  {
    "name": "GRAND MARNIER",
    "category": "AMARI & LIQUEURS",
    "brand": "GRAND MARNIER",
    "subcategory": "Orange Liqueur",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "GREEN CHARTREUSE",
    "category": "AMARI & LIQUEURS",
    "brand": "CHARTREUSE",
    "subcategory": "Herbal Liqueur",
    "abv": 55,
    "origin": "France",
    "age": null
  },
  {
    "name": "YELLOW CHARTREUSE",
    "category": "AMARI & LIQUEURS",
    "brand": "CHARTREUSE",
    "subcategory": "Herbal Liqueur",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "JÄGERMEISTER",
    "category": "AMARI & LIQUEURS",
    "brand": "JÄGERMEISTER",
    "subcategory": "Herbal Liqueur",
    "abv": 35,
    "origin": "Germany",
    "age": null
  },
  {
    "name": "LICOR 43",
    "category": "AMARI & LIQUEURS",
    "brand": "LICOR 43",
    "subcategory": "Vanilla Liqueur",
    "abv": 31,
    "origin": "Spain",
    "age": null
  },
  {
    "name": "LIMONCELLO PALLINI",
    "category": "AMARI & LIQUEURS",
    "brand": "PALLINI",
    "subcategory": "Limoncello",
    "abv": 26,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "LUXARDO AMARETTO",
    "category": "AMARI & LIQUEURS",
    "brand": "LUXARDO",
    "subcategory": "Amaretto",
    "abv": 28,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "MOLINARI SAMBUCA",
    "category": "AMARI & LIQUEURS",
    "brand": "MOLINARI",
    "subcategory": "Sambuca",
    "abv": 42,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "PIMM'S Nº1",
    "category": "AMARI & LIQUEURS",
    "brand": "PIMM'S",
    "subcategory": "Gin-based Liqueur",
    "abv": 25,
    "origin": "England",
    "age": null
  },
  {
    "name": "ST-GERMAIN",
    "category": "AMARI & LIQUEURS",
    "brand": "ST-GERMAIN",
    "subcategory": "Elderflower Liqueur",
    "abv": 20,
    "origin": "France",
    "age": null
  },
  {
    "name": "ST. GEORGE SPICED PEAR",
    "category": "AMARI & LIQUEURS",
    "brand": "ST. GEORGE",
    "subcategory": "Pear Liqueur",
    "abv": 20,
    "origin": "USA",
    "age": null
  },
  {
    "name": "TEMPUS FUGIT DARK COCOA",
    "category": "AMARI & LIQUEURS",
    "brand": "TEMPUS FUGIT",
    "subcategory": "Cocoa Liqueur",
    "abv": 25,
    "origin": "USA",
    "age": null
  },
  {
    "name": "YUZURI YUZU",
    "category": "AMARI & LIQUEURS",
    "brand": "YUZURI",
    "subcategory": "Yuzu Liqueur",
    "abv": null,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "COURVOISIER XO",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "COURVOISIER",
    "subcategory": "XO",
    "abv": 40,
    "origin": "France",
    "age": "XO"
  },
  {
    "name": "D'USSÉ VSOP",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "D'USSÉ",
    "subcategory": "VSOP",
    "abv": 40,
    "origin": "France",
    "age": "VSOP"
  },
  {
    "name": "H BY HINE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "HINE",
    "subcategory": "VSOP",
    "abv": 40,
    "origin": "France",
    "age": "VSOP"
  },
  {
    "name": "HENNESSY VS",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "HENNESSY",
    "subcategory": "VS",
    "abv": 40,
    "origin": "France",
    "age": "VS"
  },
  {
    "name": "HENNESSY VSOP PRIVILEGE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "HENNESSY",
    "subcategory": "VSOP",
    "abv": 40,
    "origin": "France",
    "age": "VSOP"
  },
  {
    "name": "D'USSE XO",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "D'USSÉ",
    "subcategory": "XO",
    "abv": 40,
    "origin": "France",
    "age": "XO"
  },
  {
    "name": "MARTELL CORDON BLEU",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "MARTELL",
    "subcategory": "VS",
    "abv": 40,
    "origin": "France",
    "age": "VS"
  },
  {
    "name": "RÉMY MARTIN 1738 ACCORD ROYAL FINE CHAMPAGNE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "RÉMY MARTIN",
    "subcategory": "VSOP",
    "abv": 40,
    "origin": "France",
    "age": "VSOP"
  },
  {
    "name": "REMY MARTIN VSOP FINE CHAMPAGNE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "RÉMY MARTIN",
    "subcategory": "VSOP",
    "abv": 40,
    "origin": "France",
    "age": "VSOP"
  },
  {
    "name": "REMY MARTIN XO FINE CHAMPAGNE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "RÉMY MARTIN",
    "subcategory": "XO",
    "abv": 40,
    "origin": "France",
    "age": "XO"
  },
  {
    "name": "PISCO BARSOL SELECTO ITALIA",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "BARSOL",
    "subcategory": "Pisco",
    "abv": 41.3,
    "origin": "Peru",
    "age": null
  },
  {
    "name": "CHRISTIAN DROUIN XO PAYS D'AUGE",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "CHRISTIAN DROUIN",
    "subcategory": "Calvados XO",
    "abv": 40,
    "origin": "France",
    "age": "XO"
  },
  {
    "name": "LAIRD'S 10TH GENERATION APPLE BRANDY BOTTLED IN BOND",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "LAIRD'S",
    "subcategory": "Apple Brandy",
    "abv": 50,
    "origin": "USA",
    "age": null
  },
  {
    "name": "MAROLO GRAPPA",
    "category": "COGNAC & OTHER BRANDIES",
    "brand": "MAROLO",
    "subcategory": "Grappa",
    "abv": 42,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "AVIATION",
    "category": "GIN & GENEVER",
    "brand": "AVIATION",
    "subcategory": "American Gin",
    "abv": 42,
    "origin": "USA",
    "age": null
  },
  {
    "name": "BOMBAY SAPPHIRE LONDON DRY",
    "category": "GIN & GENEVER",
    "brand": "BOMBAY SAPPHIRE",
    "subcategory": "London Dry Gin",
    "abv": 47,
    "origin": "England",
    "age": null
  },
  {
    "name": "BOTANIST ISLAY DRY",
    "category": "GIN & GENEVER",
    "brand": "BOTANIST",
    "subcategory": "Islay Dry Gin",
    "abv": 46,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "EMPRESS 1908 INDIGO",
    "category": "GIN & GENEVER",
    "brand": "EMPRESS",
    "subcategory": "Indigo Gin",
    "abv": 42.5,
    "origin": "Canada",
    "age": null
  },
  {
    "name": "FORDS LONDON DRY",
    "category": "GIN & GENEVER",
    "brand": "FORDS",
    "subcategory": "London Dry Gin",
    "abv": 45,
    "origin": "England",
    "age": null
  },
  {
    "name": "GRAY WHALE CALIFORNIA SMALL BATCH",
    "category": "GIN & GENEVER",
    "brand": "GRAY WHALE",
    "subcategory": "California Gin",
    "abv": 43.4,
    "origin": "USA",
    "age": null
  },
  {
    "name": "HENDRICK'S",
    "category": "GIN & GENEVER",
    "brand": "HENDRICK'S",
    "subcategory": "Scottish Gin",
    "abv": 41.4,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "MONKEY 47",
    "category": "GIN & GENEVER",
    "brand": "MONKEY 47",
    "subcategory": "Schwarzwald Gin",
    "abv": 47,
    "origin": "Germany",
    "age": null
  },
  {
    "name": "ROKU",
    "category": "GIN & GENEVER",
    "brand": "ROKU",
    "subcategory": "Japanese Gin",
    "abv": 43,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "SIPSMITH",
    "category": "GIN & GENEVER",
    "brand": "SIPSMITH",
    "subcategory": "London Dry Gin",
    "abv": 41.6,
    "origin": "England",
    "age": null
  },
  {
    "name": "TANQUERAY LONDON DRY",
    "category": "GIN & GENEVER",
    "brand": "TANQUERAY",
    "subcategory": "London Dry Gin",
    "abv": 47.3,
    "origin": "England",
    "age": null
  },
  {
    "name": "APPLETON ESTATE 12YR-JAMAICA",
    "category": "RUM & CACHACA",
    "brand": "APPLETON ESTATE",
    "subcategory": "Aged Rum",
    "abv": 43,
    "origin": "Jamaica",
    "age": "12YR"
  },
  {
    "name": "BACARDI RESERVA OCHO 8YR PUERTO RICO",
    "category": "RUM & CACHACA",
    "brand": "BACARDI",
    "subcategory": "Aged Rum",
    "abv": 40,
    "origin": "Puerto Rico",
    "age": "8YR"
  },
  {
    "name": "BRUGAL 1888 DOBLEMENTE AÑEJADO-DOMINICAN REPUBLIC",
    "category": "RUM & CACHACA",
    "brand": "BRUGAL",
    "subcategory": "Aged Rum",
    "abv": 40,
    "origin": "Dominican Republic",
    "age": null
  },
  {
    "name": "CHAIRMAN'S RESERVE SPICED-ST. LUCIA",
    "category": "RUM & CACHACA",
    "brand": "CHAIRMAN'S RESERVE",
    "subcategory": "Spiced Rum",
    "abv": 40,
    "origin": "St. Lucia",
    "age": null
  },
  {
    "name": "DIPLOMATICO RESERVA EXCLUSIVA-VENEZUELA",
    "category": "RUM & CACHACA",
    "brand": "DIPLOMATICO",
    "subcategory": "Aged Rum",
    "abv": 40,
    "origin": "Venezuela",
    "age": null
  },
  {
    "name": "HAVANA CLUB ANEJO BLANCO-PUERTO RICO",
    "category": "RUM & CACHACA",
    "brand": "HAVANA CLUB",
    "subcategory": "White Rum",
    "abv": 40,
    "origin": "Puerto Rico",
    "age": null
  },
  {
    "name": "LEBLON-BRAZIL",
    "category": "RUM & CACHACA",
    "brand": "LEBLON",
    "subcategory": "Cachaça",
    "abv": 40,
    "origin": "Brazil",
    "age": null
  },
  {
    "name": "AVUÁ AMBURANA-BRAZIL",
    "category": "RUM & CACHACA",
    "brand": "AVUÁ",
    "subcategory": "Cachaça",
    "abv": 40,
    "origin": "Brazil",
    "age": null
  },
  {
    "name": "PLANTATION 3 STARS- BARBADOS-JAMAICA-TRINIDAD",
    "category": "RUM & CACHACA",
    "brand": "PLANTATION",
    "subcategory": "White Rum",
    "abv": 41.2,
    "origin": "Multi-Island",
    "age": null
  },
  {
    "name": "PLANTATION XAYMACA SPECIAL DRY-JAMAICA",
    "category": "RUM & CACHACA",
    "brand": "PLANTATION",
    "subcategory": "Special Dry Rum",
    "abv": 43,
    "origin": "Jamaica",
    "age": null
  },
  {
    "name": "ZACAPA 23-GUATEMALA",
    "category": "RUM & CACHACA",
    "brand": "ZACAPA",
    "subcategory": "Aged Rum",
    "abv": 40,
    "origin": "Guatemala",
    "age": "23YR"
  },
  {
    "name": "1942",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON JULIO",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CASAMIGOS BLANCO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CASAMIGOS",
    "subcategory": "Blanco",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CASAMIGOS REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CASAMIGOS",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CASAMIGOS AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CASAMIGOS",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CINCORO REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CINCORO",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CINCORO AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CINCORO",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CLASE AZUL REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CLASE AZUL",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CLASE AZUL AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CLASE AZUL",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "CUERVO RESERVA EXTRA AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "CUERVO",
    "subcategory": "Extra Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "DON FULANO BLANCO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON FULANO",
    "subcategory": "Blanco",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "DON FULANO REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON FULANO",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "DON JULIO BLANCO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON JULIO",
    "subcategory": "Blanco",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "DON JULIO AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON JULIO",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "DON JULIO 1942",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "DON JULIO",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "EL TESORO REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "EL TESORO",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "KOMOS REPOSADO ROSA",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "KOMOS",
    "subcategory": "Reposado Rosa",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "KOMOS AÑEJO RESERVA",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "KOMOS",
    "subcategory": "Añejo Reserva",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "MIJENTAS BLANCO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "MIJENTAS",
    "subcategory": "Blanco",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "MIJENTAS CRISTALINO REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "MIJENTAS",
    "subcategory": "Cristalino Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "MONTELOBOS PECHUGA MEZCAL",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "MONTELOBOS",
    "subcategory": "Pechuga Mezcal",
    "abv": 47.8,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "PATRÓN SILVER",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "PATRÓN",
    "subcategory": "Silver",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "PATRÓN REPOSADO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "PATRÓN",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "PATRÓN AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "PATRÓN",
    "subcategory": "Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "PATRÓN EL ALTO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "PATRÓN",
    "subcategory": "Reposado",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "GRAN PATRÓN BURDEOS AÑEJO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "PATRÓN",
    "subcategory": "Extra Añejo",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "SIETE LEGUAS BLANCO",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "SIETE LEGUAS",
    "subcategory": "Blanco",
    "abv": 40,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "SIETE MISTERIOS TOBALA MEZCAL",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "SIETE MISTERIOS",
    "subcategory": "Tobala Mezcal",
    "abv": 45,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "VIDA ESPADIN MEZCAL",
    "category": "TEQUILA & OTHER AGAVE SPIRITS",
    "brand": "VIDA",
    "subcategory": "Espadín Mezcal",
    "abv": 42,
    "origin": "Mexico",
    "age": null
  },
  {
    "name": "TOKI BLEND BY SUNTORY",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "SUNTORY",
    "subcategory": "Blend",
    "abv": 43,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "SHIBUI PURE MALT 10YR",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "SHIBUI",
    "subcategory": "Pure Malt",
    "abv": 43,
    "origin": "Japan",
    "age": "10YR"
  },
  {
    "name": "SHIBUI SINGLE GRAIN 15YR",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "SHIBUI",
    "subcategory": "Single Grain",
    "abv": 43,
    "origin": "Japan",
    "age": "15YR"
  },
  {
    "name": "NIKKA DAYS BLEND",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "NIKKA",
    "subcategory": "Blend",
    "abv": 40,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "NIKKA COFFEY GRAIN",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "NIKKA",
    "subcategory": "Coffey Grain",
    "abv": 45,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "NIKKA MIYAGIKYO SINGLE MALT",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "NIKKA",
    "subcategory": "Single Malt",
    "abv": 45,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "NIKKA YOICHI SINGLE MALT",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "NIKKA",
    "subcategory": "Single Malt",
    "abv": 45,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "KAVALAN CLASSIC SINGLE MALT",
    "category": "INTERNATIONAL WHISKIES",
    "brand": "KAVALAN",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Taiwan",
    "age": null
  },
  {
    "name": "ABSINTHE ST. GEORGE",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "ST. GEORGE",
    "subcategory": "Absinthe",
    "abv": 60,
    "origin": "USA",
    "age": null
  },
  {
    "name": "APEROL",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "APEROL",
    "subcategory": "Aperitif",
    "abv": 11,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "CAMPARI",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "CAMPARI",
    "subcategory": "Aperitif",
    "abv": 25,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "CARPANO ANTICA FORMULA SWEET VERMOUTH",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "CARPANO",
    "subcategory": "Sweet Vermouth",
    "abv": 16.5,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "CINZANO 1757 SWEET VERMOUTH",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "CINZANO",
    "subcategory": "Sweet Vermouth",
    "abv": 16,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "COCCHI AMERICANO",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "COCCHI",
    "subcategory": "Americano",
    "abv": 16.5,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "FORO SWEET VERMOUTH",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "FORO",
    "subcategory": "Sweet Vermouth",
    "abv": 18,
    "origin": "Spain",
    "age": null
  },
  {
    "name": "ITALICUS BERGAMOT APÉRITIF",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "ITALICUS",
    "subcategory": "Bergamot Aperitif",
    "abv": 20,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "LILLET BLONDE",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "LILLET",
    "subcategory": "Blonde",
    "abv": 17,
    "origin": "France",
    "age": null
  },
  {
    "name": "LILLET ROSÉ",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "LILLET",
    "subcategory": "Rosé",
    "abv": 17,
    "origin": "France",
    "age": null
  },
  {
    "name": "M&R AMBRATO VERMOUTH",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "MARTINI & ROSSI",
    "subcategory": "Ambrato Vermouth",
    "abv": 18,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "NOILLY PRAT EXTRA DRY VERMOUTH",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "NOILLY PRAT",
    "subcategory": "Extra Dry Vermouth",
    "abv": 18,
    "origin": "France",
    "age": null
  },
  {
    "name": "SELECT APÉRITIF",
    "category": "APÉRITIFS & VERMOUTHS",
    "brand": "SELECT",
    "subcategory": "Aperitif",
    "abv": 17.5,
    "origin": "Italy",
    "age": null
  },
  {
    "name": "ABSOLUTE ELYX",
    "category": "VODKA & AQUAVIT",
    "brand": "ABSOLUT",
    "subcategory": "Premium Vodka",
    "abv": 42.3,
    "origin": "Sweden",
    "age": null
  },
  {
    "name": "AMERICAN HARVEST",
    "category": "VODKA & AQUAVIT",
    "brand": "AMERICAN HARVEST",
    "subcategory": "Organic Vodka",
    "abv": 40,
    "origin": "USA",
    "age": null
  },
  {
    "name": "BELVEDERE",
    "category": "VODKA & AQUAVIT",
    "brand": "BELVEDERE",
    "subcategory": "Premium Vodka",
    "abv": 40,
    "origin": "Poland",
    "age": null
  },
  {
    "name": "CÎROC PEACH",
    "category": "VODKA & AQUAVIT",
    "brand": "CÎROC",
    "subcategory": "Flavored Vodka",
    "abv": 35,
    "origin": "France",
    "age": null
  },
  {
    "name": "CHOPIN",
    "category": "VODKA & AQUAVIT",
    "brand": "CHOPIN",
    "subcategory": "Potato Vodka",
    "abv": 40,
    "origin": "Poland",
    "age": null
  },
  {
    "name": "CORVUS 3 FLAVORS",
    "category": "VODKA & AQUAVIT",
    "brand": "CORVUS",
    "subcategory": "Flavored Vodka",
    "abv": 40,
    "origin": "USA",
    "age": null
  },
  {
    "name": "GREY GOOSE",
    "category": "VODKA & AQUAVIT",
    "brand": "GREY GOOSE",
    "subcategory": "Premium Vodka",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "GREY GOOSE LE CITRON",
    "category": "VODKA & AQUAVIT",
    "brand": "GREY GOOSE",
    "subcategory": "Citron Vodka",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "HAKU",
    "category": "VODKA & AQUAVIT",
    "brand": "HAKU",
    "subcategory": "Rice Vodka",
    "abv": 40,
    "origin": "Japan",
    "age": null
  },
  {
    "name": "KETEL ONE",
    "category": "VODKA & AQUAVIT",
    "brand": "KETEL ONE",
    "subcategory": "Premium Vodka",
    "abv": 40,
    "origin": "Netherlands",
    "age": null
  },
  {
    "name": "KETEL ONE BOTANICALS",
    "category": "VODKA & AQUAVIT",
    "brand": "KETEL ONE",
    "subcategory": "Botanical Vodka",
    "abv": 30,
    "origin": "Netherlands",
    "age": null
  },
  {
    "name": "OSTREIDA",
    "category": "VODKA & AQUAVIT",
    "brand": "OSTREIDA",
    "subcategory": "Premium Vodka",
    "abv": 40,
    "origin": "France",
    "age": null
  },
  {
    "name": "SKYY",
    "category": "VODKA & AQUAVIT",
    "brand": "SKYY",
    "subcategory": "Standard Vodka",
    "abv": 40,
    "origin": "USA",
    "age": null
  },
  {
    "name": "ST. GEORGE GREEN CHILE",
    "category": "VODKA & AQUAVIT",
    "brand": "ST. GEORGE",
    "subcategory": "Flavored Vodka",
    "abv": 35,
    "origin": "USA",
    "age": null
  },
  {
    "name": "STOLI ELITE",
    "category": "VODKA & AQUAVIT",
    "brand": "STOLICHNAYA",
    "subcategory": "Premium Vodka",
    "abv": 40,
    "origin": "Latvia",
    "age": null
  },
  {
    "name": "STOLI VANIL",
    "category": "VODKA & AQUAVIT",
    "brand": "STOLICHNAYA",
    "subcategory": "Vanilla Vodka",
    "abv": 35,
    "origin": "Latvia",
    "age": null
  },
  {
    "name": "SVOL SWEDISH-STYLE AQUAVIT",
    "category": "VODKA & AQUAVIT",
    "brand": "SVOL",
    "subcategory": "Aquavit",
    "abv": 40,
    "origin": "Sweden",
    "age": null
  },
  {
    "name": "TITO'S",
    "category": "VODKA & AQUAVIT",
    "brand": "TITO'S",
    "subcategory": "Handmade Vodka",
    "abv": 40,
    "origin": "USA",
    "age": null
  },
  {
    "name": "DEWAR'S WHITE LABEL",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "DEWAR'S",
    "subcategory": "Blended Scotch",
    "abv": 40,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "JOHNNIE WALKER BLACK LABEL 12YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "JOHNNIE WALKER",
    "subcategory": "Blended Scotch",
    "abv": 40,
    "origin": "Scotland",
    "age": "12YR"
  },
  {
    "name": "JOHNNIE WALKER BLUE LABEL",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "JOHNNIE WALKER",
    "subcategory": "Blended Scotch",
    "abv": 40,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "ARDBEG 10YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "ARDBEG",
    "subcategory": "Single Malt",
    "abv": 46,
    "origin": "Scotland",
    "age": "10YR"
  },
  {
    "name": "ARDBEG UIGEADAIL",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "ARDBEG",
    "subcategory": "Single Malt",
    "abv": 54.2,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "GLENFIDDICH 15YR SOLERA RESERVA",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "GLENFIDDICH",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Scotland",
    "age": "15YR"
  },
  {
    "name": "GLENFIDDICH GRAN RESERVA 21YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "GLENFIDDICH",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Scotland",
    "age": "21YR"
  },
  {
    "name": "GLENMORANGIE 14YR QUINTA ROBAN PORT FINIS",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "GLENMORANGIE",
    "subcategory": "Single Malt",
    "abv": 46,
    "origin": "Scotland",
    "age": "14YR"
  },
  {
    "name": "GLENMORANGIE SIGNET",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "GLENMORANGIE",
    "subcategory": "Single Malt",
    "abv": 46,
    "origin": "Scotland",
    "age": null
  },
  {
    "name": "HIGHLAND PARK 18YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "HIGHLAND PARK",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "18YR"
  },
  {
    "name": "ISLE OF JURA 10YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "ISLE OF JURA",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Scotland",
    "age": "10YR"
  },
  {
    "name": "OBAN 14YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "OBAN",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "14YR"
  },
  {
    "name": "TALISKER 10YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "TALISKER",
    "subcategory": "Single Malt",
    "abv": 45.8,
    "origin": "Scotland",
    "age": "10YR"
  },
  {
    "name": "THE BALVENIE DOUBLE WOOD 12YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE BALVENIE",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "12YR"
  },
  {
    "name": "THE BALVENIE PORT WOOD 21YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE BALVENIE",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "21YR"
  },
  {
    "name": "THE DALMORE 15YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE DALMORE",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Scotland",
    "age": "15YR"
  },
  {
    "name": "THE GLENDRONACH 12YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE GLENDRONACH",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "12YR"
  },
  {
    "name": "THE GLENFARCLAS 25YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE GLENFARCLAS",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "25YR"
  },
  {
    "name": "THE GLENLIVET 12YR",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE GLENLIVET",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Scotland",
    "age": "12YR"
  },
  {
    "name": "THE MACALLAN 12YR SHERRY CASK",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE MACALLAN",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "12YR"
  },
  {
    "name": "THE MACALLAN 18YR SHERRY CASK",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE MACALLAN",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "18YR"
  },
  {
    "name": "THE MACALLAN 25YR SHERRY CASK",
    "category": "SCOTCH BLENDED & SINGLE MALT",
    "brand": "THE MACALLAN",
    "subcategory": "Single Malt",
    "abv": 43,
    "origin": "Scotland",
    "age": "25YR"
  },
  {
    "name": "BUSHMILLS 10YR SINGLE MALT",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "BUSHMILLS",
    "subcategory": "Single Malt",
    "abv": 40,
    "origin": "Ireland",
    "age": "10YR"
  },
  {
    "name": "JAMESON",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "JAMESON",
    "subcategory": "Blended Irish",
    "abv": 40,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "POWERS",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "POWERS",
    "subcategory": "Irish Rye",
    "abv": 43.2,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "REDBREAST 12YR SINGLE POT STILL",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "REDBREAST",
    "subcategory": "Single Pot Still",
    "abv": 40,
    "origin": "Ireland",
    "age": "12YR"
  },
  {
    "name": "TEELING SMALL BATCH",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "TEELING",
    "subcategory": "Small Batch",
    "abv": 46,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "TULLAMORE DEW",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "TULLAMORE DEW",
    "subcategory": "Blended Irish",
    "abv": 40,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "WATERFORD THE CUVÉE",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "WATERFORD",
    "subcategory": "Single Malt",
    "abv": 50,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "WRITERS' TEARS CASK STRENGTH",
    "category": "IRISH BLENDED/IRISH POT STILL/SINGLE MALT",
    "brand": "WRITERS' TEARS",
    "subcategory": "Cask Strength",
    "abv": 54.8,
    "origin": "Ireland",
    "age": null
  },
  {
    "name": "ANGELS ENVY FINISHED IN PORT WINE BARREL",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "ANGELS ENVY",
    "subcategory": "Finished Bourbon",
    "abv": 43.3,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BASIL HAYDEN",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "BASIL HAYDEN",
    "subcategory": "Small Batch",
    "abv": 40,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BLANTON'S SINGLE BARREL",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "BLANTON'S",
    "subcategory": "Single Barrel",
    "abv": 46.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BUFFALO TRACE",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "BUFFALO TRACE",
    "subcategory": "Straight Bourbon",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BULLEIT",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "BULLEIT",
    "subcategory": "Straight Bourbon",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BULLEIT SINGLE MALT",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "BULLEIT",
    "subcategory": "Single Malt",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "COLONEL E.H. TAYLOR JR. SMALL BATCH",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "COLONEL E.H. TAYLOR",
    "subcategory": "Small Batch",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "EAGLE RARE 10YR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "EAGLE RARE",
    "subcategory": "Single Barrel",
    "abv": 45,
    "origin": "KY",
    "age": "10YR"
  },
  {
    "name": "EAGLE RARE 17YR ANTIQUE COLLECTION",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "EAGLE RARE",
    "subcategory": "Antique Collection",
    "abv": 50.5,
    "origin": "KY",
    "age": "17YR"
  },
  {
    "name": "ELIJAH CRAIG 12YR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "ELIJAH CRAIG",
    "subcategory": "Small Batch",
    "abv": 47,
    "origin": "KY",
    "age": "12YR"
  },
  {
    "name": "FOUR ROSES",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "FOUR ROSES",
    "subcategory": "Straight Bourbon",
    "abv": 40,
    "origin": "KY",
    "age": null
  },
  {
    "name": "FOUR ROSES SMALL BATCH",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "FOUR ROSES",
    "subcategory": "Small Batch",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "GEORGE DICKEL BOURBON",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "GEORGE DICKEL",
    "subcategory": "Tennessee Bourbon",
    "abv": 45,
    "origin": "TN",
    "age": null
  },
  {
    "name": "GEORGE T. STAGG",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "GEORGE T. STAGG",
    "subcategory": "Uncut-Unfiltered",
    "abv": 67.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "HENRY MCKENNA 10 YEAR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "HENRY MCKENNA",
    "subcategory": "Single Barrel",
    "abv": 50,
    "origin": "KY",
    "age": "10YR"
  },
  {
    "name": "KNOB CREEK SMALL BATCH",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "KNOB CREEK",
    "subcategory": "Small Batch",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "MAKER'S MARK",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "MAKER'S MARK",
    "subcategory": "Wheated Bourbon",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "MAKER'S MARK 46 FRENCH OAKED",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "MAKER'S MARK",
    "subcategory": "Wheated Bourbon",
    "abv": 47,
    "origin": "KY",
    "age": null
  },
  {
    "name": "MICHTER'S US 1 SMALL BATCH",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "MICHTER'S",
    "subcategory": "Small Batch",
    "abv": 45.7,
    "origin": "KY",
    "age": null
  },
  {
    "name": "MICHTER'S US UNBLENDED AMERICAN WHISKEY",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "MICHTER'S",
    "subcategory": "Unblended American",
    "abv": 41.7,
    "origin": "KY",
    "age": null
  },
  {
    "name": "OLD FORESTER",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "OLD FORESTER",
    "subcategory": "Straight Bourbon",
    "abv": 46,
    "origin": "KY",
    "age": null
  },
  {
    "name": "OLD FORESTER STATESMAN",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "OLD FORESTER",
    "subcategory": "Premium Bourbon",
    "abv": 47.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "PAPPY VAN WINKLE 12YR LOT \"B\"",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "PAPPY VAN WINKLE",
    "subcategory": "Wheated Bourbon",
    "abv": 45.2,
    "origin": "KY",
    "age": "12YR"
  },
  {
    "name": "PAPPY VAN WINKLE FAMILY RESERVE 15YR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "PAPPY VAN WINKLE",
    "subcategory": "Wheated Bourbon",
    "abv": 53.5,
    "origin": "KY",
    "age": "15YR"
  },
  {
    "name": "RABBIT HOLE HEIGOLD DOUBLE RYE HIGH MALT BOURBON",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "RABBIT HOLE",
    "subcategory": "High Malt Bourbon",
    "abv": 47.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "RD1 SMALL BATCH FINISHED WITH AMBURANA BRAZILIAN WOOD",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "RD1",
    "subcategory": "Finished Bourbon",
    "abv": 55,
    "origin": "KY",
    "age": null
  },
  {
    "name": "REDEMPTION HIGH RYE BOURBON",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "REDEMPTION",
    "subcategory": "High Rye Bourbon",
    "abv": 46,
    "origin": "IN",
    "age": null
  },
  {
    "name": "RUSSELL'S RESERVE 10YR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "RUSSELL'S RESERVE",
    "subcategory": "Small Batch",
    "abv": 45,
    "origin": "KY",
    "age": "10YR"
  },
  {
    "name": "W.L. WELLER 12YR",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "W.L. WELLER",
    "subcategory": "Wheated Bourbon",
    "abv": 45,
    "origin": "KY",
    "age": "12YR"
  },
  {
    "name": "WELLER ANTIQUE",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WELLER",
    "subcategory": "Wheated Bourbon",
    "abv": 53.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "WIDOW JANE DECADENCE FINISHED IN MAPLE SYRUP BARREL",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WIDOW JANE",
    "subcategory": "Finished Bourbon",
    "abv": 45.5,
    "origin": "NY",
    "age": null
  },
  {
    "name": "WILDERNESS TRAIL BOTTLE IN BOND",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WILDERNESS TRAIL",
    "subcategory": "Wheated Bourbon",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "WOODFORD RESERVE",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WOODFORD RESERVE",
    "subcategory": "Straight Bourbon",
    "abv": 45.2,
    "origin": "KY",
    "age": null
  },
  {
    "name": "WOODFORD RESERVE DOUBLE OAKED",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WOODFORD RESERVE",
    "subcategory": "Double Oaked",
    "abv": 45.2,
    "origin": "KY",
    "age": null
  },
  {
    "name": "WOODINVILLE",
    "category": "STRAIGHT BOURBON WHISKEY",
    "brand": "WOODINVILLE",
    "subcategory": "Straight Bourbon",
    "abv": 45,
    "origin": "WA",
    "age": null
  },
  {
    "name": "ANGELS ENVY RYE CARIBBEAN CASK FINISHED",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "ANGELS ENVY",
    "subcategory": "Finished Rye",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "BULLET RYE",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "BULLEIT",
    "subcategory": "Straight Rye",
    "abv": 45,
    "origin": "KY",
    "age": null
  },
  {
    "name": "HIGH WEST DOUBLE RYE",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "HIGH WEST",
    "subcategory": "Double Rye",
    "abv": 46,
    "origin": "UT",
    "age": null
  },
  {
    "name": "KNOB CREEK RYE SMALL BATCH",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "KNOB CREEK",
    "subcategory": "Small Batch Rye",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "MICHTER'S US1 SINGLE BARREL RYE",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "MICHTER'S",
    "subcategory": "Single Barrel Rye",
    "abv": 42.4,
    "origin": "KY",
    "age": null
  },
  {
    "name": "PEERLESS STRAIGHT RYE SMALL BATCH",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "PEERLESS",
    "subcategory": "Small Batch Rye",
    "abv": 53.5,
    "origin": "KY",
    "age": null
  },
  {
    "name": "RAGTIME RYE BOTTLED IN BOND-EMPIRE RYE",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "RAGTIME",
    "subcategory": "Bottled in Bond",
    "abv": 50,
    "origin": "NY",
    "age": null
  },
  {
    "name": "RUSSELL'S RYE 6YR",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "RUSSELL'S",
    "subcategory": "Straight Rye",
    "abv": 45,
    "origin": "KY",
    "age": "6YR"
  },
  {
    "name": "WHISTLE PIG 15YR FINISHED IN VERMONT ESTATE OAK",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WHISTLE PIG",
    "subcategory": "Estate Oak Finish",
    "abv": 46,
    "origin": "VT",
    "age": "15YR"
  },
  {
    "name": "WHISTLE PIG OLD WORLD RYE 12YR",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WHISTLE PIG",
    "subcategory": "Old World Rye",
    "abv": 43,
    "origin": "VT",
    "age": "12YR"
  },
  {
    "name": "WHISTLE PIG PIGGYBACK 6YR",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WHISTLE PIG",
    "subcategory": "Straight Rye",
    "abv": 48.7,
    "origin": "VT",
    "age": "6YR"
  },
  {
    "name": "WHISTLE PIG SMALL BATCH 10YR",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WHISTLE PIG",
    "subcategory": "Small Batch",
    "abv": 50,
    "origin": "VT",
    "age": "10YR"
  },
  {
    "name": "WILDERNESS TRAIL SINGLE BARREL-BOTTLED IN BOND",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WILDERNESS TRAIL",
    "subcategory": "Single Barrel",
    "abv": 50,
    "origin": "KY",
    "age": null
  },
  {
    "name": "WOODFORD RESERVE STRAIGHT RYE",
    "category": "STRAIGHT RYE WHISKEY",
    "brand": "WOODFORD RESERVE",
    "subcategory": "Straight Rye",
    "abv": 45.2,
    "origin": "KY",
    "age": null
  },
  {
    "name": "JACK DANIEL'S OLD NO 7",
    "category": "TENNESSEE WHISKEY",
    "brand": "JACK DANIEL'S",
    "subcategory": "Tennessee Whiskey",
    "abv": 40,
    "origin": "TN",
    "age": null
  },
  {
    "name": "GENTLEMAN JACK DOUBLE MELLOWED",
    "category": "TENNESSEE WHISKEY",
    "brand": "JACK DANIEL'S",
    "subcategory": "Double Mellowed",
    "abv": 40,
    "origin": "TN",
    "age": null
  },
  {
    "name": "UNCLE NEAREST SINGLE BARREL",
    "category": "TENNESSEE WHISKEY",
    "brand": "UNCLE NEAREST",
    "subcategory": "Single Barrel",
    "abv": 60.5,
    "origin": "TN",
    "age": null
  },
  {
    "name": "CANADIAN CLUB",
    "category": "CANADIAN WHISKY",
    "brand": "CANADIAN CLUB",
    "subcategory": "Blended Canadian",
    "abv": 40,
    "origin": "Canada",
    "age": null
  },
  {
    "name": "CROWN ROYAL",
    "category": "CANADIAN WHISKY",
    "brand": "CROWN ROYAL",
    "subcategory": "Blended Canadian",
    "abv": 40,
    "origin": "Canada",
    "age": null
  }
];
