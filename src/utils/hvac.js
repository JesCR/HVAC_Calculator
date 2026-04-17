export function calculateHvacScenario(input, shortlist = []) {
  const state = normalizeInput(input);
  const transmission =
    state.areas.openings * state.uValues.openings +
    state.areas.facade * state.uValues.facade +
    state.areas.roof * state.uValues.roof +
    state.areas.floor * state.uValues.floor;

  const effectiveRecovery = Math.max(0, Math.min(state.vmcRecovery, 100));
  const ventilation = 0.33 * state.vmcFlow * (1 - effectiveRecovery / 100);
  const hTotal = transmission + ventilation + state.extras.base;

  const scenarios = [
    buildScenario("TS99", state.ts99, state.indoorTemp, hTotal, state),
    buildScenario("TS99,6", state.ts996, state.indoorTemp, hTotal, state),
    buildScenario("Mínima observada", state.tMin, state.indoorTemp, hTotal, state)
  ];

  const curve = [];
  for (let outdoor = -5; outdoor <= 32; outdoor += 1) {
    curve.push(buildScenario("curve", outdoor, state.indoorTemp, hTotal, state));
  }

  const heatingScenario = scenarios[1];
  const systemScenario = scenarios[2];
  const heatingClass = classifyBySteps(heatingScenario.loadUpper, state.machineSteps);
  const systemClass = classifyBySteps(systemScenario.systemLoad, state.machineSteps);
  const physicalRecommendation = state.machines.find(
    (machinePower) => heatingScenario.loadUpper <= machinePower
  );

  return {
    input: state,
    transmission,
    ventilation,
    hTotal,
    scenarios,
    curve,
    heatingScenario,
    systemScenario,
    heatingClass,
    systemClass,
    physicalRecommendation,
    shortlist: shortlist.map((brand) =>
      buildBrandRecommendation(brand, heatingClass, systemClass)
    ),
    recommendationText: buildRecommendation(heatingClass, systemClass)
  };
}

function normalizeInput(input) {
  return {
    ...input,
    indoorTemp: Number(input.indoorTemp),
    ts99: Number(input.ts99),
    ts996: Number(input.ts996),
    tMin: Number(input.tMin),
    vmcFlow: Number(input.vmcFlow),
    vmcRecovery: Number(input.vmcRecovery),
    designMargin: Number(input.designMargin),
    operationalBuffer: Number(input.operationalBuffer),
    extras: {
      base: Number(input.extras.base)
    },
    machines: [...input.machines].map((machine) => Number(machine)),
    machineSteps: [...input.machineSteps].map((machine) => Number(machine)),
    areas: {
      openings: Number(input.areas.openings),
      facade: Number(input.areas.facade),
      roof: Number(input.areas.roof),
      floor: Number(input.areas.floor)
    },
    uValues: {
      openings: Number(input.uValues.openings),
      facade: Number(input.uValues.facade),
      roof: Number(input.uValues.roof),
      floor: Number(input.uValues.floor)
    }
  };
}

function buildScenario(label, outdoorTemp, indoorTemp, hTotal, state) {
  const delta = Math.max(0, indoorTemp - outdoorTemp);
  const baseLoad = (hTotal * delta) / 1000;
  const marginBand = baseLoad * (state.designMargin / 100);
  const loadLower = Math.max(0, baseLoad - marginBand);
  const loadUpper = baseLoad + marginBand;
  const systemLoad = loadUpper + state.operationalBuffer;

  return {
    label,
    outdoorTemp,
    delta,
    baseLoad,
    marginBand,
    loadLower,
    loadUpper,
    systemLoad,
    margins: state.machines.map((machinePower) => ({
      machinePower,
      margin: machinePower - loadUpper
    }))
  };
}

function classifyBySteps(value, steps) {
  const match = steps.find((step) => value <= step);
  return match ?? "16+";
}

function buildBrandRecommendation(brand, heatingClass, systemClass) {
  const rows = brand.models.map((model) => {
    const coversHeating = coversClass(heatingClass, model.classKw);
    const coversSystem = coversClass(systemClass, model.classKw);
    return {
      ...model,
      coversHeating,
      coversSystem
    };
  });

  const systemMatch = rows.find((row) => row.coversSystem);
  const heatingMatch = rows.find((row) => row.coversHeating);

  return {
    brand: brand.brand,
    rows,
    recommended:
      systemClass === "16+" ? null : systemMatch?.label ?? heatingMatch?.label ?? null,
    summary: buildBrandSummary(brand.brand, rows, heatingClass, systemClass),
    nuance: buildBrandNuance(rows, systemClass)
  };
}

function coversClass(requiredClass, modelClass) {
  if (requiredClass === "16+") {
    return false;
  }

  return modelClass >= requiredClass;
}

function buildBrandSummary(brandName, rows, heatingClass, systemClass) {
  const systemMatch = rows.find((row) => row.coversSystem);

  if (systemClass === "16+") {
    return `La shortlist ${brandName} actual se queda corta para la clase de sistema pedida.`;
  }

  if (systemMatch) {
    return `Pedir ${systemMatch.label}.`;
  }

  const heatingMatch = rows.find((row) => row.coversHeating);
  if (heatingMatch) {
    return `${heatingMatch.label} cubre calefacción clase ${heatingClass}, pero no la reserva global del sistema.`;
  }

  return `${brandName} no cubre la clase térmica resultante con la shortlist actual.`;
}

function buildBrandNuance(rows, systemClass) {
  if (systemClass === "16+") {
    return "Hace falta revisar una gama superior o volver a las hipótesis del modelo.";
  }

  const heatingOnly = rows.find((row) => row.coversHeating && !row.coversSystem);
  if (heatingOnly) {
    return `${heatingOnly.label} cubre calefacción; la clase superior añade margen de sistema.`;
  }

  const systemMatch = rows.find((row) => row.coversSystem);
  if (systemMatch) {
    return `${systemMatch.label} ya cubre la clase de sistema definida.`;
  }

  return "Conviene revisar shortlist o hipótesis de envolvente.";
}

function buildRecommendation(heatingClass, systemClass) {
  if (heatingClass === systemClass) {
    return `La casa cae en una clase ${heatingClass} kW tanto para calefacción como para sistema completo.`;
  }

  return `La calefacción apunta a ${heatingClass} kW, pero el sistema completo sube a ${systemClass} kW al añadir margen y colchón operativo.`;
}
