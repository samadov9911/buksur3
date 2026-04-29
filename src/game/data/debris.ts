/**
 * База данных реального космического мусора
 * Каждый объект имеет реальные параметры: масса, размеры, вращение, материал, историю
 */

export interface DebrisObject {
  id: string;
  name: string;
  /** Тип объекта */
  type: 'rocket_stage' | 'satellite' | 'fragment' | 'dead_sat';
  /** Страна происхождения */
  origin: string;
  /** Год запуска */
  launchYear: number;
  /** Почему стал мусором */
  reason: string;
  /** Краткая справка */
  description: string;
  /** Масса (кг) */
  mass: number;
  /** Размеры (м) */
  size: { x: number; y: number; z: number };
  /** Материал (для расчёта торможения) */
  material: 'aluminum' | 'steel' | 'titanium' | 'composite';
  /** Скорость вращения (град/с) по осям */
  tumbleRate: { x: number; y: number; z: number };
  /** Начальная орбита */
  orbit: {
    altitude: number; // Высота в км
    inclination: number; // Наклонение в градусах
    eccentricity: number;
  };
  /** Сложность захвата (1-5) */
  difficulty: number;
  /** Рекомендуемый тип захвата */
  recommendedCapture: 'harpoon' | 'manipulator' | 'net';
  /** Визуальный цвет */
  color: string;
}

// ============================================================
// Реальные объекты космического мусора (20+ объектов)
// ============================================================

export const DEBRIS_DATABASE: DebrisObject[] = [
  {
    id: 'cosmos2251',
    name: 'Космос-2251 (обломки)',
    type: 'dead_sat',
    origin: 'СССР / Россия',
    launchYear: 1993,
    reason: 'Неисправность — спутник перестал отвечать на команды через 2 года после запуска',
    description: 'Военный связной спутник «Стрела-2М». 10 февраля 2009 года столкнулся с действующим спутником Iridium 33 на высоте 789 км. Столкновение создало более 2000 отслеживаемых обломков.',
    mass: 900,
    size: { x: 2.0, y: 2.0, z: 12.0 },
    material: 'aluminum',
    tumbleRate: { x: 0.5, y: 1.2, z: 0.8 },
    orbit: { altitude: 789, inclination: 74, eccentricity: 0.002 },
    difficulty: 3,
    recommendedCapture: 'net',
    color: '#888888'
  },
  {
    id: 'cyclone3_stage',
    name: 'Ступень «Циклон-3»',
    type: 'rocket_stage',
    origin: 'СССР / Украина',
    launchYear: 1986,
    reason: 'Вторая ступень ракеты, оставшаяся на орбите после вывода полезной нагрузки',
    description: 'Ступень ракеты-носителя «Циклон-3», использовавшейся с 1977 по 2009 год. На орбите осталось более 30 ступеней. Одна из старейших ракетных ступеней на орбите.',
    mass: 3800,
    size: { x: 2.7, y: 2.7, z: 8.5 },
    material: 'aluminum',
    tumbleRate: { x: 0.2, y: 0.05, z: 0.15 },
    orbit: { altitude: 650, inclination: 82.5, eccentricity: 0.005 },
    difficulty: 4,
    recommendedCapture: 'harpoon',
    color: '#A0A0A0'
  },
  {
    id: 'fengyun1c',
    name: 'Фэнъюнь-1С (обломки)',
    type: 'fragment',
    origin: 'Китай',
    launchYear: 1999,
    reason: 'Уничтожен китайской противоспутниковой ракетой 11 января 2007 года',
    description: 'Метеорологический спутник, намеренно уничтоженный в рамках испытания противоспутникового оружия. Создало более 3000 отслеживаемых обломков, самый крупный объём мусора от одного события.',
    mass: 750,
    size: { x: 1.5, y: 2.0, z: 2.0 },
    material: 'aluminum',
    tumbleRate: { x: 2.5, y: 3.1, z: 1.8 },
    orbit: { altitude: 865, inclination: 98.8, eccentricity: 0.001 },
    difficulty: 5,
    recommendedCapture: 'net',
    color: '#CC8844'
  },
  {
    id: 'ariane5_stage',
    name: 'Ступень EPS «Ариан-5»',
    type: 'rocket_stage',
    origin: 'Европа (ESA)',
    launchYear: 2002,
    reason: 'Верхняя ступень после вывода геостационарного спутника',
    description: 'Верхняя ступень EPS (Étage à Propergol Stockable) ракеты-носителя «Ариан-5». Остаются на ГСО-трансферной орбите. На орбите более 40 таких ступеней.',
    mass: 2000,
    size: { x: 4.0, y: 4.0, z: 3.8 },
    material: 'aluminum',
    tumbleRate: { x: 0.1, y: 0.3, z: 0.1 },
    orbit: { altitude: 800, inclination: 5, eccentricity: 0.7 },
    difficulty: 4,
    recommendedCapture: 'harpoon',
    color: '#C0C0C0'
  },
  {
    id: 'proton_stage',
    name: 'Ступень «Протон-М»',
    type: 'rocket_stage',
    origin: 'Россия',
    launchYear: 2010,
    reason: 'Разгонный блок ДМ после вывода на геостационарную орбиту',
    description: 'Разгонный блок ДМ (11С86) ракеты «Протон-М». Масса более 2400 кг, содержит остатки топлива (гептил). Один из самых опасных объектов с токсичным топливом.',
    mass: 2400,
    size: { x: 3.7, y: 3.7, z: 6.3 },
    material: 'steel',
    tumbleRate: { x: 0.3, y: 0.15, z: 0.25 },
    orbit: { altitude: 500, inclination: 51.6, eccentricity: 0.01 },
    difficulty: 4,
    recommendedCapture: 'manipulator',
    color: '#909090'
  },
  {
    id: 'iridium33',
    name: 'Iridium 33 (обломки)',
    type: 'dead_sat',
    origin: 'США',
    launchYear: 1997,
    reason: 'Разрушен при столкновении с «Космос-2251» в 2009 году',
    description: 'Коммерческий связной спутник сети Iridium. Столкновение на скорости 11.7 км/с создало облако обломков. Оставшиеся обломки представляют опасность для МКС.',
    mass: 560,
    size: { x: 1.2, y: 3.0, z: 1.2 },
    material: 'aluminum',
    tumbleRate: { x: 1.5, y: 2.0, z: 0.7 },
    orbit: { altitude: 789, inclination: 86, eccentricity: 0.002 },
    difficulty: 3,
    recommendedCapture: 'net',
    color: '#6688AA'
  },
  {
    id: 'envisat',
    name: 'Envisat',
    type: 'dead_sat',
    origin: 'Европа (ESA)',
    launchYear: 2002,
    reason: 'Потеря связи в апреле 2012 года, 10 лет эксплуатации',
    description: 'Крупнейший гражданский спутник наблюдения Земли. Масса 8 тонн, длина 10 метров. Находится на высоте 782 км. Один из приоритетных объектов для активного удаления мусора.',
    mass: 8200,
    size: { x: 10.0, y: 3.0, z: 2.5 },
    material: 'aluminum',
    tumbleRate: { x: 0.02, y: 0.01, z: 0.015 },
    orbit: { altitude: 782, inclination: 98.5, eccentricity: 0.001 },
    difficulty: 5,
    recommendedCapture: 'manipulator',
    color: '#DAA520'
  },
  {
    id: 'spy_sat_1980',
    name: 'USA-193 (обломки)',
    type: 'fragment',
    origin: 'США',
    launchYear: 2006,
    reason: 'Не вышел на орбиту, сбит ракетой SM-3 в 2008 году',
    description: 'Разведывательный спутник NRO L-21. Не смог достичь орбиты из-за неисправности. Был намеренно сбит американским эсминцем для предотвращения падения токсичного топлива на населённые пункты.',
    mass: 2300,
    size: { x: 5.0, y: 2.5, z: 2.5 },
    material: 'titanium',
    tumbleRate: { x: 4.0, y: 2.5, z: 3.0 },
    orbit: { altitude: 250, inclination: 58.5, eccentricity: 0.015 },
    difficulty: 4,
    recommendedCapture: 'harpoon',
    color: '#4A4A6A'
  },
  {
    id: 'sl6_stage',
    name: 'Ступень «Слёва» (китайская)',
    type: 'rocket_stage',
    origin: 'Китай',
    launchYear: 2007,
    reason: 'Третья ступень ракеты CZ-4B после запуска CBERS-2B',
    description: 'Китайская ракетная ступень. Из-за остатков топлива в баках произошёл разрыв в 2019 году, создав сотни обломков. Классический пример «позднего разрушения».',
    mass: 1500,
    size: { x: 2.3, y: 2.3, z: 7.5 },
    material: 'aluminum',
    tumbleRate: { x: 0.8, y: 0.4, z: 0.6 },
    orbit: { altitude: 750, inclination: 98.5, eccentricity: 0.003 },
    difficulty: 3,
    recommendedCapture: 'harpoon',
    color: '#B0B0B0'
  },
  {
    id: 'noaa16_debris',
    name: 'NOAA-16 (обломки)',
    type: 'dead_sat',
    origin: 'США',
    launchYear: 2000,
    reason: 'Разрушен на орбите в ноябре 2015 года (возможно, взрыв аккумулятора)',
    description: 'Метеорологический спутник NOAA. После 15 лет работы внезапно разрушился на орбите, создав более 450 обломков. Находится на полярной орбите.',
    mass: 1400,
    size: { x: 4.0, y: 1.5, z: 1.5 },
    material: 'aluminum',
    tumbleRate: { x: 1.0, y: 1.5, z: 2.0 },
    orbit: { altitude: 850, inclination: 99.1, eccentricity: 0.001 },
    difficulty: 3,
    recommendedCapture: 'net',
    color: '#778899'
  },
  {
    id: 'briz_m',
    name: 'Разгонный блок «Бриз-М»',
    type: 'rocket_stage',
    origin: 'Россия',
    launchYear: 2012,
    reason: 'Неудачная операция выведения, блок с остатками топлива на орбите',
    description: 'Разгонный блок «Бриз-М», который не смог выполнить миссию. Содержит высокотоксичный гептил и амил. Более 60 таких блоков на орбите — серьёзная проблема.',
    mass: 2240,
    size: { x: 2.5, y: 2.5, z: 4.1 },
    material: 'titanium',
    tumbleRate: { x: 0.15, y: 0.4, z: 0.2 },
    orbit: { altitude: 550, inclination: 48, eccentricity: 0.008 },
    difficulty: 4,
    recommendedCapture: 'manipulator',
    color: '#8B8682'
  },
  {
    id: 'cosmos1408',
    name: 'Космос-1408 (обломки)',
    type: 'fragment',
    origin: 'Россия',
    launchYear: 1982,
    reason: 'Уничтожен российской противоспутниковой ракетой в ноябре 2021 года',
    description: 'Советский военный спутник связи «Целина-Д», неработающий с 1980-х. Уничтожен в ходе испытания ПРО, создав более 1500 обломков. Экипаж МКС вынужден был укрыться.',
    mass: 1800,
    size: { x: 3.0, y: 4.0, z: 2.0 },
    material: 'aluminum',
    tumbleRate: { x: 3.0, y: 2.5, z: 3.5 },
    orbit: { altitude: 480, inclination: 82.5, eccentricity: 0.001 },
    difficulty: 5,
    recommendedCapture: 'net',
    color: '#705050'
  },
  {
    id: 'delta2_stage',
    name: 'Ступень «Дельта-2»',
    type: 'rocket_stage',
    origin: 'США',
    launchYear: 1999,
    reason: 'Вторая ступень после запуска GPS-спутника',
    description: 'Ступень Aerojet AJ10-118K ракеты «Дельта-2». С 1989 года на орбите осталось более 100 ступеней. Отличаются высокой плотностью и устойчивостью к торможению.',
    mass: 900,
    size: { x: 1.5, y: 1.5, z: 5.3 },
    material: 'aluminum',
    tumbleRate: { x: 0.6, y: 0.3, z: 0.5 },
    orbit: { altitude: 1050, inclination: 55, eccentricity: 0.003 },
    difficulty: 2,
    recommendedCapture: 'harpoon',
    color: '#B8B8B8'
  },
  {
    id: 'ers1',
    name: 'ERS-1',
    type: 'dead_sat',
    origin: 'Европа (ESA)',
    launchYear: 1991,
    reason: 'Выведен из эксплуатации в 2000 году, продолжает неуправляемый полёт',
    description: 'Европейский спутник дистанционного зондирования. Масса 2.4 тонны. Находится на высоте 780 км. ESA рассматривает его как кандидат на активное удаление.',
    mass: 2400,
    size: { x: 11.0, y: 2.0, z: 1.5 },
    material: 'aluminum',
    tumbleRate: { x: 0.03, y: 0.02, z: 0.04 },
    orbit: { altitude: 780, inclination: 98.5, eccentricity: 0.001 },
    difficulty: 3,
    recommendedCapture: 'manipulator',
    color: '#C8C8B0'
  },
  {
    id: 'kosmos1275',
    name: 'Космос-1275 (обломки)',
    type: 'fragment',
    origin: 'СССР',
    launchYear: 1981,
    reason: 'Разрушился на орбите через 50 дней после запуска',
    description: 'Советский навигационный спутник. Разрушился при переходе через зону радиационных поясов Ван Аллена. Создал более 300 обломков.',
    mass: 800,
    size: { x: 2.5, y: 2.0, z: 3.0 },
    material: 'steel',
    tumbleRate: { x: 1.8, y: 2.2, z: 1.5 },
    orbit: { altitude: 980, inclination: 83, eccentricity: 0.002 },
    difficulty: 3,
    recommendedCapture: 'net',
    color: '#606060'
  },
  {
    id: 'falcon9_stage',
    name: 'Вторая ступень «Falcon 9»',
    type: 'rocket_stage',
    origin: 'США (SpaceX)',
    launchYear: 2018,
    reason: 'Ступень после выведения спутника Starlink',
    description: 'Вторая ступень ракеты Falcon 9. Хотя SpaceX приземляет первые ступени, вторые остаются на орбите. На 2024 год более 200 ступеней на орбите.',
    mass: 4000,
    size: { x: 3.7, y: 3.7, z: 12.6 },
    material: 'aluminum',
    tumbleRate: { x: 0.05, y: 0.08, z: 0.04 },
    orbit: { altitude: 340, inclination: 53, eccentricity: 0.0005 },
    difficulty: 3,
    recommendedCapture: 'harpoon',
    color: '#D0D0D0'
  },
  {
    id: 'adeos2',
    name: 'ADEOS-II (Midori-2)',
    type: 'dead_sat',
    origin: 'Япония (JAXA)',
    launchYear: 2002,
    reason: 'Выход из строя солнечных батарей через 10 месяцев работы',
    description: 'Японский спутник наблюдения Земли. Потерял энергию из-за короткого замыкания. Масса 3.7 тонны, длинные солнечные панели.',
    mass: 3700,
    size: { x: 6.0, y: 4.0, z: 3.0 },
    material: 'composite',
    tumbleRate: { x: 0.1, y: 0.2, z: 0.15 },
    orbit: { altitude: 803, inclination: 98.7, eccentricity: 0.001 },
    difficulty: 4,
    recommendedCapture: 'manipulator',
    color: '#5070A0'
  },
  {
    id: 'tracker_debris_1',
    name: 'Обломок покрытия «Спутник-1»',
    type: 'fragment',
    origin: 'СССР',
    launchYear: 1957,
    reason: 'Обломок термометрического покрытия первого искусственного спутника',
    description: 'Маленький, но исторически значимый обломок. «Спутник-1» сгорел в атмосфере в 1958 году, но некоторые мелкие фрагменты остались на более высоких орбитах.',
    mass: 0.5,
    size: { x: 0.1, y: 0.1, z: 0.05 },
    material: 'aluminum',
    tumbleRate: { x: 5.0, y: 7.0, z: 6.0 },
    orbit: { altitude: 950, inclination: 65.1, eccentricity: 0.05 },
    difficulty: 5,
    recommendedCapture: 'net',
    color: '#C0C0C0'
  },
  {
    id: ' gslv_stage',
    name: 'Ступень GSLV (Индия)',
    type: 'rocket_stage',
    origin: 'Индия (ISRO)',
    launchYear: 2010,
    reason: 'Криогенная верхняя ступень после неудачного запуска',
    description: 'Индийская ракетная ступень с криогенным двигателем. Из-за неисправности двигателя спутник не вышел на расчётную орбиту. Ступень осталась на эллиптической орбите.',
    mass: 1200,
    size: { x: 2.8, y: 2.8, z: 8.9 },
    material: 'aluminum',
    tumbleRate: { x: 0.4, y: 0.6, z: 0.3 },
    orbit: { altitude: 400, inclination: 20, eccentricity: 0.02 },
    difficulty: 3,
    recommendedCapture: 'harpoon',
    color: '#A0A090'
  },
  {
    id: 'h2a_stage',
    name: 'Вторая ступень H-IIA',
    type: 'rocket_stage',
    origin: 'Япония (JAXA)',
    launchYear: 2005,
    reason: 'Ступень после вывода на геостационарную трансферную орбиту',
    description: 'Верхняя ступень LE-5B ракеты H-IIA. Япония активно работает над технологией удаления подобных ступеней с орбиты.',
    mass: 1800,
    size: { x: 3.0, y: 3.0, z: 7.0 },
    material: 'aluminum',
    tumbleRate: { x: 0.2, y: 0.1, z: 0.25 },
    orbit: { altitude: 250, inclination: 28, eccentricity: 0.73 },
    difficulty: 4,
    recommendedCapture: 'manipulator',
    color: '#B8B0A8'
  },
  {
    id: 'astra5b',
    name: 'Astra 5B (обломки)',
    type: 'dead_sat',
    origin: 'Люксембург (SES)',
    launchYear: 2014,
    reason: 'Частичная потеря мощности, переведён на орбиту захоронения',
    description: 'Телекоммуникационный спутник. После исчерпания ресурсов топлива переведён на орбиту захоронения (200+ км выше ГСО). Остаётся там тысячи лет.',
    mass: 6000,
    size: { x: 8.0, y: 3.0, z: 2.5 },
    material: 'aluminum',
    tumbleRate: { x: 0.01, y: 0.005, z: 0.008 },
    orbit: { altitude: 600, inclination: 0.1, eccentricity: 0.0001 },
    difficulty: 2,
    recommendedCapture: 'manipulator',
    color: '#E8E0D0'
  },
  {
    id: 'meteor1_29',
    name: 'Метеор-1 №29 (обломки)',
    type: 'fragment',
    origin: 'СССР',
    launchYear: 1970,
    reason: 'Разрушен на орбите, вероятная разгерметизация',
    description: 'Самый старый отслеживаемый крупный обломок. Метеорологический спутник, разрушенный на орбите в 2006 году. Порождает вторичные столкновения.',
    mass: 1200,
    size: { x: 3.5, y: 2.0, z: 2.0 },
    material: 'steel',
    tumbleRate: { x: 0.7, y: 1.1, z: 0.9 },
    orbit: { altitude: 620, inclination: 82, eccentricity: 0.002 },
    difficulty: 3,
    recommendedCapture: 'net',
    color: '#706050'
  },
  {
    id: 'starlink_v2mini',
    name: 'Starlink v2 Mini (нерабочий)',
    type: 'dead_sat',
    origin: 'США (SpaceX)',
    launchYear: 2023,
    reason: 'Выведен из эксплуатации из-за солнечной бури',
    description: 'Один из тысяч спутников Starlink. Масса 800 кг, комплект из 2 спутников для связи. Из-за солнечной активности некоторые спутники не смогли маневрировать и вошли в атмосферу.',
    mass: 800,
    size: { x: 4.0, y: 0.3, z: 2.0 },
    material: 'aluminum',
    tumbleRate: { x: 0.5, y: 0.1, z: 0.3 },
    orbit: { altitude: 340, inclination: 43, eccentricity: 0.0003 },
    difficulty: 1,
    recommendedCapture: 'manipulator',
    color: '#E0E0E0'
  },
  {
    id: 'iridium_coffin',
    name: 'Iridium «гроб» (контейнер)',
    type: 'fragment',
    origin: 'США',
    launchYear: 1998,
    reason: 'Защитный контейнер, отделившийся при развёртывании спутника',
    description: 'Контейнер для транспортировки спутника Iridium. Отделяется после выхода на орбиту. На орбите более 70 таких объектов.',
    mass: 15,
    size: { x: 1.5, y: 1.5, z: 0.5 },
    material: 'aluminum',
    tumbleRate: { x: 3.0, y: 4.0, z: 2.5 },
    orbit: { altitude: 780, inclination: 86.4, eccentricity: 0.001 },
    difficulty: 2,
    recommendedCapture: 'net',
    color: '#A8A8A8'
  }
];

/** Получить объект по ID */
export function getDebrisById(id: string): DebrisObject | undefined {
  return DEBRIS_DATABASE.find(d => d.id === id);
}

/** Получить объекты по уровню сложности */
export function getDebrisByDifficulty(maxDifficulty: number): DebrisObject[] {
  return DEBRIS_DATABASE.filter(d => d.difficulty <= maxDifficulty);
}
