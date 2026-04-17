export const hvacDefaults = {
  indoorTemp: 21,
  ts99: 2.59,
  ts996: 1.37,
  tMin: -2.29,
  vmcFlow: 210,
  vmcRecovery: 85,
  areas: {
    openings: 64.1,
    facade: 183,
    roof: 124.8,
    floor: 117.1
  },
  uValues: {
    openings: 1,
    facade: 0.28,
    roof: 0.21,
    floor: 0.28
  },
  extras: {
    base: 32.5
  },
  designMargin: 10,
  operationalBuffer: 0.2,
  machines: [4, 6, 8, 10, 12, 14, 16],
  machineSteps: [4, 6, 8, 10, 12, 14, 16]
};

export const hvacClimateProfile = {
  source: {
    label: "Temperaturas.csv · Tavg horario válido",
    samples: 49669,
    period: "2020-02 → 2025-12"
  },
  gaussian: {
    mean: 14.2,
    stdDev: 5.53
  },
  chartRange: {
    min: -5,
    max: 32
  },
  percentileIntervals: [
    {
      slug: "extreme",
      label: "0–0,4 %",
      from: -5,
      to: 1.35
    },
    {
      slug: "design",
      label: "0,4–1 %",
      from: 1.35,
      to: 2.57
    },
    {
      slug: "winter",
      label: "1–5 %",
      from: 2.57,
      to: 5.57
    },
    {
      slug: "habitual",
      label: "5–50 %",
      from: 5.57,
      to: 13.88
    },
    {
      slug: "warm",
      label: "50–95 %",
      from: 13.88,
      to: 24.23
    }
  ],
  percentileMarkers: [
    {
      slug: "ts996",
      label: "P0,4 = TS99,6",
      shortLabel: "P0,4",
      temperature: 1.35,
      tone: "design",
      showLabel: false
    },
    {
      slug: "ts99",
      label: "P1 = TS99",
      shortLabel: "P1",
      temperature: 2.57,
      tone: "design",
      showLabel: false
    },
    {
      slug: "p5",
      label: "P5",
      shortLabel: "P5",
      temperature: 5.57,
      tone: "winter",
      showLabel: true
    },
    {
      slug: "p50",
      label: "P50",
      shortLabel: "P50",
      temperature: 13.88,
      tone: "habitual",
      showLabel: true
    }
  ]
};

const sliderRangeGrowth = 0.25;

function getStepPrecision(step) {
  const decimals = `${step}`.split(".")[1];
  return decimals ? decimals.length : 0;
}

function alignSliderValue(value, step, direction) {
  const scaledValue = Number((value / step).toFixed(8));
  const roundedValue =
    direction === "up"
      ? Math.ceil(scaledValue)
      : direction === "down"
        ? Math.floor(scaledValue)
        : Math.round(scaledValue);

  return Number((roundedValue * step).toFixed(getStepPrecision(step)));
}

function expandSliderMin(min, step) {
  if (min === 0) {
    return 0;
  }

  if (min > 0) {
    return alignSliderValue(min * (1 - sliderRangeGrowth), step, "down");
  }

  return alignSliderValue(min * (1 + sliderRangeGrowth), step, "down");
}

function expandSliderMax(max, step) {
  if (max >= 0) {
    return alignSliderValue(max * (1 + sliderRangeGrowth), step, "up");
  }

  return alignSliderValue(max * (1 - sliderRangeGrowth), step, "up");
}

function widenSliderRanges(controls) {
  return controls.map((control) => {
    if (control.expandRange === false) {
      return control;
    }

    return {
      ...control,
      min: expandSliderMin(control.min, control.step),
      max: expandSliderMax(control.max, control.step)
    };
  });
}

export const hvacControlGroups = [
  {
    id: "climate",
    title: "Clima interior y exterior",
    note: "Bloque climático base"
  },
  {
    id: "geometry",
    title: "Geometría de la envolvente",
    note: "Áreas base simplificadas de la vivienda"
  },
  {
    id: "uValues",
    title: "Transmitancias U",
    note: "Transmitancias base para construir la carga térmica"
  },
  {
    id: "ventilation",
    title: "Ventilación, extras y operación",
    note: "VMC continua, pérdidas residuales y colchón operativo"
  },
  {
    id: "dimensioning",
    title: "Criterio de dimensionado",
    note: "Esto no cambia la carga física; cambia la recomendación de clase"
  }
];

const hvacBaseControls = [
  {
    key: "indoorTemp",
    group: "climate",
    label: "Temperatura interior objetivo",
    min: 18,
    max: 24,
    step: 0.1,
    unit: "°C"
  },
  {
    key: "ts99",
    group: "climate",
    label: "TS99 proxy exterior",
    min: -3,
    max: 5,
    step: 0.1,
    unit: "°C"
  },
  {
    key: "ts996",
    group: "climate",
    label: "TS99,6 proxy exterior",
    min: -4,
    max: 4,
    step: 0.1,
    unit: "°C"
  },
  {
    key: "tMin",
    group: "climate",
    label: "Mínima absoluta observada",
    min: -6,
    max: 3,
    step: 0.1,
    unit: "°C"
  },
  {
    key: "areaOpenings",
    group: "geometry",
    label: "Área huecos exteriores",
    min: 40,
    max: 90,
    step: 0.5,
    unit: "m²"
  },
  {
    key: "areaFacade",
    group: "geometry",
    label: "Área fachada opaca neta",
    min: 140,
    max: 240,
    step: 1,
    unit: "m²"
  },
  {
    key: "areaRoof",
    group: "geometry",
    label: "Área cubierta",
    min: 90,
    max: 170,
    step: 0.5,
    unit: "m²"
  },
  {
    key: "areaFloor",
    group: "geometry",
    label: "Área suelo sobre forjado sanitario",
    min: 90,
    max: 150,
    step: 0.5,
    unit: "m²"
  },
  {
    key: "uOpenings",
    group: "uValues",
    label: "U huecos",
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: "W/m²K"
  },
  {
    key: "uFacade",
    group: "uValues",
    label: "U fachada",
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: "W/m²K"
  },
  {
    key: "uRoof",
    group: "uValues",
    label: "U cubierta",
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: "W/m²K"
  },
  {
    key: "uFloor",
    group: "uValues",
    label: "U suelo",
    min: 0.1,
    max: 2,
    step: 0.01,
    unit: "W/m²K"
  },
  {
    key: "vmcFlow",
    group: "ventilation",
    label: "Caudal VMC continuo invierno",
    min: 120,
    max: 320,
    step: 5,
    unit: "m³/h"
  },
  {
    key: "vmcRecovery",
    group: "ventilation",
    label: "Rendimiento recuperación VMC",
    min: 60,
    max: 95,
    step: 1,
    unit: "%"
  },
  {
    key: "extraLosses",
    group: "ventilation",
    label: "Pérdidas extra",
    min: 0,
    max: 70,
    step: 1,
    unit: "W/K"
  },
  {
    key: "designMargin",
    group: "dimensioning",
    label: "Margen de dimensionado",
    min: 0,
    max: 20,
    step: 1,
    unit: "%"
  },
  {
    key: "operationalBuffer",
    group: "ventilation",
    label: "Colchón ACS / operativo",
    min: 0,
    max: 1.5,
    step: 0.1,
    unit: "kW"
  }
];

export const hvacControls = widenSliderRanges(hvacBaseControls);

export const machineShortlist = [
  {
    brand: "Vaillant",
    recommendationField: "vaillant",
    models: [
      {
        slug: "vaillant-45-6",
        label: "aroTHERM plus 45/6",
        classKw: 4,
        note: "Escalón Vaillant sub-6 kW para cargas contenidas."
      },
      {
        slug: "vaillant-65-6",
        label: "aroTHERM plus 65/6",
        classKw: 6,
        note: "Opción base actual del proyecto."
      },
      {
        slug: "vaillant-85-6",
        label: "aroTHERM plus 85/6",
        classKw: 8,
        note: "Opción conservadora con más margen."
      }
    ]
  },
  {
    brand: "Daikin",
    recommendationField: "daikin",
    models: [
      {
        slug: "daikin-04",
        label: "Altherma 3 M 04",
        classKw: 4,
        note: "Alternativa ligera para clase 4 kW."
      },
      {
        slug: "daikin-06",
        label: "Altherma 3 M 06",
        classKw: 6,
        note: "Alternativa fuerte en clase 6 kW."
      },
      {
        slug: "daikin-08",
        label: "Altherma 3 M 08",
        classKw: 8,
        note: "Alternativa conservadora con más margen."
      }
    ]
  }
];
