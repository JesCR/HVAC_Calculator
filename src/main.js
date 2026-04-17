import {
  hvacClimateProfile,
  hvacControlGroups,
  hvacControls,
  hvacDefaults,
  machineShortlist
} from "./data/site.js";
import { calculateHvacScenario } from "./utils/hvac.js";

const hvacSummary = document.querySelector("#hvac-summary");
const hvacForm = document.querySelector("#hvac-form");
const hvacMarginCard = document.querySelector("#hvac-margin-card");
const hvacResetButton = document.querySelector("#hvac-reset-button");
const hvacExportButton = document.querySelector("#hvac-export-button");
const hvacResults = document.querySelector("#hvac-results");
const hvacChart = document.querySelector("#hvac-chart");
const hvacChartWrap = hvacChart?.closest(".hvac-chart-wrap");
const hvacChartInsights = document.querySelector("#hvac-chart-insights");
const hvacChartInfoButton = document.querySelector("#hvac-chart-info-button");
const hvacChartInfoModal = document.querySelector("#hvac-chart-info-modal");

const hvacState = structuredClone(hvacDefaults);
let lastHvacResult = calculateHvacScenario(hvacState, machineShortlist);

renderHvacSummary();
renderHvacForm();
updateHvacOutput();
bindHvacChartInfoModal();

function bindHvacChartInfoModal() {
  if (!hvacChartInfoButton || !hvacChartInfoModal) {
    return;
  }

  hvacChartInfoButton.addEventListener("click", () => {
    hvacChartInfoModal.showModal();
  });
}

function renderHvacSummary() {
  if (!hvacSummary) {
    return;
  }

  hvacSummary.innerHTML = `
    <div class="summary-metric">
      <span class="summary-label">Modelo actual</span>
      <strong>Carga base + margen ± + colchón operativo</strong>
    </div>
    <div class="summary-metric">
      <span class="summary-label">Uso previsto</span>
      <strong>Carga térmica + clase calefacción + clase sistema</strong>
    </div>
    <div class="summary-metric">
      <span class="summary-label">Salida exportable</span>
      <strong>Gráfica + inputs + recomendaciones en PDF imprimible</strong>
    </div>
  `;
}

function renderHvacForm() {
  renderHvacMarginControl();

  hvacForm.innerHTML = hvacControlGroups
    .filter((group) => group.id !== "dimensioning")
    .map((group) => {
      const controlsMarkup = hvacControls
        .filter(
          (control) =>
            control.group === group.id ||
            (group.id === "ventilation" && control.key === "operationalBuffer")
        )
        .map((control) => {
          const initialValue = readControlValue(control.key);
          const displayValue = formatControlValue(control, initialValue);

          return `
            <label class="control-row">
              <span class="control-copy">
                <span class="control-label">${control.label}</span>
              </span>
              <span class="control-input-row">
                <span class="control-range-wrap">
                  <input
                    class="control-range"
                    type="range"
                    min="${control.min}"
                    max="${control.max}"
                    step="${control.step}"
                    value="${initialValue}"
                    data-control="${control.key}"
                  />
                </span>
                <span class="control-value" data-display="${control.key}">${displayValue}</span>
              </span>
            </label>
          `;
        })
        .join("");

      return `
        <fieldset class="control-group" data-control-group="${group.id}">
          <legend class="control-group-title">${group.title}</legend>
          <p class="control-group-note">${group.note}</p>
          <div class="control-group-body">${controlsMarkup}</div>
        </fieldset>
      `;
    })
    .join("");

  hvacForm.addEventListener("input", handleControlInput);

  if (hvacMarginCard && hvacMarginCard.dataset.boundInput !== "true") {
    hvacMarginCard.dataset.boundInput = "true";
    hvacMarginCard.addEventListener("input", handleControlInput);
  }

  if (hvacResetButton && hvacResetButton.dataset.boundReset !== "true") {
    hvacResetButton.dataset.boundReset = "true";
    hvacResetButton.addEventListener("click", () => {
      resetHvacState();
      syncHvacFormControls();
      updateHvacOutput();
    });
  }

  if (hvacExportButton && hvacExportButton.dataset.boundExport !== "true") {
    hvacExportButton.dataset.boundExport = "true";
    hvacExportButton.addEventListener("click", exportHvacPdf);
  }
}

function handleControlInput(event) {
  const input = event.target.closest("[data-control]");
  if (!input) {
    return;
  }

  writeControlValue(input.dataset.control, Number(input.value));
  const control = hvacControls.find((entry) => entry.key === input.dataset.control);

  document
    .querySelectorAll(`[data-display="${input.dataset.control}"]`)
    .forEach((node) => (node.textContent = formatControlValue(control, Number(input.value))));

  updateHvacOutput();
}

function renderHvacMarginControl() {
  if (!hvacMarginCard) {
    return;
  }

  const control = hvacControls.find((entry) => entry.key === "designMargin");
  const initialValue = readControlValue(control.key);
  const displayValue = formatControlValue(control, initialValue);

  hvacMarginCard.innerHTML = `
    <div class="hvac-margin-copy">
      <span class="control-group-title hvac-margin-title">Margen de dimensionado</span>
      <p class="control-group-note hvac-margin-note">
        Ajusta la banda sombreada alrededor de la carga base.
      </p>
    </div>
    <label class="control-row hvac-margin-row">
      <span class="control-input-row">
        <span class="control-range-wrap">
          <input
            class="control-range"
            type="range"
            min="${control.min}"
            max="${control.max}"
            step="${control.step}"
            value="${initialValue}"
            data-control="${control.key}"
          />
        </span>
        <span class="control-value" data-display="${control.key}">${displayValue}</span>
      </span>
    </label>
  `;
}

function updateHvacOutput() {
  const result = calculateHvacScenario(hvacState, machineShortlist);
  lastHvacResult = result;

  const coefficientRows = [
    {
      label: "H transmisión",
      value: `${formatNumber(result.transmission)} W/K`,
      note: "Coeficiente constante: depende de superficies y U base."
    },
    {
      label: "H ventilación neta",
      value: `${formatNumber(result.ventilation)} W/K`,
      note: "Depende de caudal VMC, recuperación y pérdidas extra."
    },
    {
      label: "H total",
      value: `${formatNumber(result.hTotal)} W/K`,
      note: "Htotal = Htransmisión + Hventilación + extras."
    }
  ];

  const loadRows = [
    {
      label: "Carga TS99",
      value: `${formatNumber(result.scenarios[0].baseLoad)} kW`,
      note: `Banda ± margen ${formatNumber(result.scenarios[0].loadLower)}–${formatNumber(result.scenarios[0].loadUpper)} kW.`
    },
    {
      label: "Carga TS99,6",
      value: `${formatNumber(result.scenarios[1].baseLoad)} kW`,
      note: `Banda ± margen ${formatNumber(result.scenarios[1].loadLower)}–${formatNumber(result.scenarios[1].loadUpper)} kW.`
    },
    {
      label: "Carga Tmin",
      value: `${formatNumber(result.scenarios[2].baseLoad)} kW`,
      note: `Sistema ${formatNumber(result.scenarios[2].systemLoad)} kW al añadir colchón operativo.`
    }
  ];

  const classRows = [
    {
      label: "Clase calefacción sugerida",
      value: formatClass(result.heatingClass),
      note: "Clase de máquina por calefacción con margen de diseño."
    },
    {
      label: "Clase sistema sugerida",
      value: formatClass(result.systemClass),
      note: "Clase de máquina al añadir colchón ACS/operativo."
    },
    {
      label: "Recomendación física",
      value: formatClass(result.physicalRecommendation ?? result.input.machines.at(-1)),
      note: result.recommendationText
    }
  ];

  const renderSummaryRows = (rows) =>
    rows
      .map(
        (row) => `
          <div class="auto-summary-row">
            <span>${row.label}</span>
            <strong>${row.value}</strong>
            <p>${row.note}</p>
          </div>
        `
      )
      .join("");

  const scenarioCards = result.scenarios
    .map(
      (scenario) => `
        <article class="scenario-card">
          <p class="brand-name">${scenario.label}</p>
          <strong>${formatNumber(scenario.baseLoad)} kW</strong>
          <p class="brand-copy">Carga base para mantener la vivienda estable.</p>
          <p class="brand-copy brand-copy-muted">
            Banda ± margen ${formatNumber(scenario.loadLower)}–${formatNumber(scenario.loadUpper)} kW${
              scenario.label === "Mínima observada"
                ? ` · sistema ${formatNumber(scenario.systemLoad)} kW`
                : ""
            }
          </p>
        </article>
      `
    )
    .join("");

  const shortlistMarkup = result.shortlist
    .map(
      (brand) => `
        <div class="brand-result">
          <p class="brand-name">${brand.brand}</p>
          <strong>${brand.recommended ?? "Shortlist insuficiente"}</strong>
          <p class="brand-copy">${brand.summary}</p>
          <p class="brand-copy brand-copy-muted">${brand.nuance}</p>
        </div>
      `
    )
    .join("");

  const machineRows = result.input.machines
    .map((machinePower) => {
      const margin = result.heatingScenario.margins.find(
        (entry) => entry.machinePower === machinePower
      )?.margin;
      const state = margin >= 0 ? "ok" : "warn";

      return `
        <div class="machine-pill machine-pill-${state}">
          <span>${machinePower.toFixed(0)} kW</span>
          <strong>${margin >= 0 ? "+" : ""}${formatNumber(margin)} kW</strong>
        </div>
      `;
    })
    .join("");

  hvacResults.innerHTML = `
    <div class="result-block">
      <p class="eyebrow">Resumen automático</p>
      <p class="result-context">
        <strong>H</strong> varía con <strong>U</strong>, superficies, ventilación, recuperación y
        extras: <strong>Htotal = Htransmisión + Hventilación + extras</strong><br />
        La <strong>carga</strong> varía con <strong>T interior</strong> o <strong>T exterior</strong>:
        <strong>P = H × ΔT</strong>.
      </p>
      <div class="auto-summary-section">
        <p class="auto-summary-title">Coeficientes H del modelo</p>
        <div class="auto-summary-grid">${renderSummaryRows(coefficientRows)}</div>
      </div>
      <div class="auto-summary-section">
        <p class="auto-summary-title">Cargas para temperaturas de cálculo</p>
        <div class="auto-summary-grid">${renderSummaryRows(loadRows)}</div>
      </div>
      <div class="auto-summary-section">
        <p class="auto-summary-title">Clases derivadas</p>
        <div class="auto-summary-grid">${renderSummaryRows(classRows)}</div>
      </div>
    </div>
    <div class="result-block">
      <p class="eyebrow">Escenarios climáticos</p>
      <div class="scenario-grid">${scenarioCards}</div>
    </div>
    <div class="result-block">
      <p class="eyebrow">Shortlist de marca</p>
      <div class="brand-selector-grid">${shortlistMarkup}</div>
    </div>
    <div class="result-block">
      <p class="eyebrow">Margen en TS99,6 carga + margen</p>
      <div class="machine-pills">${machineRows}</div>
      <p class="recommendation-copy">
        ${result.recommendationText} La carga base en TS99,6 queda en
        ${formatNumber(result.heatingScenario.baseLoad)} kW y la banda superior sube a
        ${formatNumber(result.heatingScenario.loadUpper)} kW al aplicar el margen de diseño.
      </p>
    </div>
  `;

  renderHvacChart(result);
}

function renderHvacChart(result) {
  const width = 720;
  const height = 280;
  const padding = { top: 28, right: 108, bottom: 36, left: 48 };
  const chartRight = width - padding.right;
  const xMin = hvacClimateProfile.chartRange.min;
  const xMax = hvacClimateProfile.chartRange.max;
  const yMax = Math.max(
    10.5,
    ...result.curve.flatMap((entry) => [
      entry.loadLower,
      entry.baseLoad,
      entry.loadUpper,
      entry.systemLoad
    ]),
    ...result.input.machines
  );

  const xScale = (value) =>
    padding.left + ((value - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
  const chartBottom = height - padding.bottom;
  const yScale = (value) => chartBottom - (value / yMax) * (height - padding.top - padding.bottom);
  const modulationAtTemp = (outdoorTemp) => {
    const delta = Math.max(0, result.input.indoorTemp - outdoorTemp);
    const baseLoad = (result.hTotal * delta) / 1000;
    return baseLoad * (1 + result.input.designMargin / 100);
  };

  const densityBaseY = chartBottom - 6;
  const densityBandHeight = 56;
  const gaussianDensity = (temp) => {
    const { mean, stdDev } = hvacClimateProfile.gaussian;
    const variance = stdDev ** 2;
    return (1 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-((temp - mean) ** 2) / (2 * variance));
  };

  const densitySamples = [];
  for (let temp = xMin; temp <= xMax; temp += 0.25) {
    densitySamples.push({ temp, density: gaussianDensity(temp) });
  }

  const maxDensity = Math.max(...densitySamples.map((entry) => entry.density));
  const densityYScale = (density) => densityBaseY - (density / maxDensity) * densityBandHeight;

  const densityLine = densitySamples
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(entry.temp)} ${densityYScale(entry.density)}`
    )
    .join(" ");

  const densityArea = `
    ${densityLine}
    L ${xScale(densitySamples.at(-1).temp)} ${densityBaseY}
    L ${xScale(densitySamples[0].temp)} ${densityBaseY}
    Z
  `;

  const percentileBands = hvacClimateProfile.percentileIntervals
    .map((interval) => {
      const start = xScale(Math.max(interval.from, xMin));
      const end = xScale(Math.min(interval.to, xMax));
      const bandWidth = end - start;
      const label =
        bandWidth > 56
          ? `<text class="chart-percentile-caption" x="${start + bandWidth / 2}" y="${
              padding.top + 16
            }" text-anchor="middle">${interval.label}</text>`
          : "";

      return `
        <rect
          class="chart-percentile-band chart-percentile-band-${interval.slug}"
          x="${start}"
          y="${padding.top}"
          width="${bandWidth}"
          height="${chartBottom - padding.top}"
        ></rect>
        ${label}
      `;
    })
    .join("");

  const percentileLines = hvacClimateProfile.percentileMarkers
    .map(
      (marker) => `
        <line
          class="chart-percentile-line chart-percentile-line-${marker.tone}"
          x1="${xScale(marker.temperature)}"
          x2="${xScale(marker.temperature)}"
          y1="${padding.top}"
          y2="${chartBottom}"
        ></line>
        ${
          marker.showLabel
            ? `<text class="chart-percentile-caption" x="${xScale(marker.temperature)}" y="${
                padding.top + 30
              }" text-anchor="middle">${marker.shortLabel}</text>`
            : ""
        }
      `
    )
    .join("");

  const lowerPath = result.curve
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(entry.outdoorTemp)} ${yScale(entry.loadLower)}`
    )
    .join(" ");

  const basePath = result.curve
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(entry.outdoorTemp)} ${yScale(entry.baseLoad)}`
    )
    .join(" ");

  const upperPath = result.curve
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(entry.outdoorTemp)} ${yScale(entry.loadUpper)}`
    )
    .join(" ");

  const systemPath = result.curve
    .map(
      (entry, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(entry.outdoorTemp)} ${yScale(entry.systemLoad)}`
    )
    .join(" ");

  const bandAreaPath = `
    ${upperPath}
    L ${xScale(result.curve.at(-1).outdoorTemp)} ${yScale(result.curve.at(-1).loadLower)}
    ${[...result.curve]
      .reverse()
      .slice(1)
      .map((entry) => `L ${xScale(entry.outdoorTemp)} ${yScale(entry.loadLower)}`)
      .join(" ")}
    Z
  `;

  const operationalBandAreaPath = `
    ${systemPath}
    L ${xScale(result.curve.at(-1).outdoorTemp)} ${yScale(result.curve.at(-1).loadUpper)}
    ${[...result.curve]
      .reverse()
      .slice(1)
      .map((entry) => `L ${xScale(entry.outdoorTemp)} ${yScale(entry.loadUpper)}`)
      .join(" ")}
    Z
  `;

  const chartPowerLevels = [...new Set([1, 2, ...result.input.machines])].sort((a, b) => a - b);

  const grid = chartPowerLevels
    .map(
      (machinePower) => `
        <line class="chart-machine-line" x1="${padding.left}" x2="${chartRight}" y1="${yScale(
          machinePower
        )}" y2="${yScale(machinePower)}"></line>
        <text class="chart-machine-label" x="${width - 10}" y="${yScale(
          machinePower
        ) - 6}" text-anchor="end">${machinePower} kW</text>
      `
    )
    .join("");

  const ticks = Array.from({ length: xMax - xMin + 1 }, (_, index) => xMin + index)
    .filter((value) => value % 5 === 0)
    .map(
      (value) => `
        <line class="chart-grid-line" x1="${xScale(value)}" x2="${xScale(value)}" y1="${padding.top}" y2="${
          chartBottom
        }"></line>
        <text class="chart-axis-label" x="${xScale(value)}" y="${height - 12}">${value}°</text>
      `
    )
    .join("");

  const markers = result.scenarios
    .map(
      (scenario) => `
        <circle class="chart-point" cx="${xScale(scenario.outdoorTemp)}" cy="${yScale(
          scenario.baseLoad
        )}" r="5"></circle>
      `
    )
    .join("");

  const modulationCardWidth = 156;
  const modulationCardHeight = 72;
  const modulationCardX = chartRight - 16 - modulationCardWidth;
  const modulationCardY = padding.top + 8;
  const modulationTs99 = result.scenarios[0].loadUpper;
  const modulation18 = modulationAtTemp(18);
  const modulationCard = `
    <g class="chart-modulation-card" transform="translate(${modulationCardX} ${modulationCardY})">
      <rect class="chart-modulation-card-surface" width="${modulationCardWidth}" height="${modulationCardHeight}" rx="14"></rect>
      <text class="chart-modulation-card-title" x="12" y="16">Modulación TS99 - 18 ºC</text>
      <text class="chart-modulation-card-subtitle" x="12" y="29">Carga + margen</text>
      <line class="chart-modulation-card-line" x1="12" y1="36" x2="144" y2="36"></line>
      <text class="chart-modulation-card-row-label" x="12" y="50">
        TS99 (${formatNumber(result.input.ts99)} ºC)
      </text>
      <text class="chart-modulation-card-row-value" x="144" y="50" text-anchor="end">
        ${formatNumber(modulationTs99)} kW
      </text>
      <text class="chart-modulation-card-row-label" x="12" y="63">18 ºC</text>
      <text class="chart-modulation-card-row-value" x="144" y="63" text-anchor="end">
        ${formatNumber(modulation18)} kW
      </text>
    </g>
  `;

  hvacChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  hvacChart.innerHTML = `
    <rect class="chart-surface" x="0" y="0" width="${width}" height="${height}" rx="24"></rect>
    ${percentileBands}
    ${ticks}
    ${grid}
    <path class="chart-density-area" d="${densityArea}"></path>
    <path class="chart-density-line" d="${densityLine}"></path>
    ${percentileLines}
    <line class="chart-axis" x1="${padding.left}" x2="${chartRight}" y1="${
      chartBottom
    }" y2="${chartBottom}"></line>
    <path class="chart-margin-band" d="${bandAreaPath}"></path>
    <path class="chart-operational-band" d="${operationalBandAreaPath}"></path>
    <path class="chart-path chart-path-base" d="${basePath}"></path>
    ${markers}
    ${modulationCard}
    <g class="chart-hover-state" aria-hidden="true">
      <line class="chart-hover-line" x1="${padding.left}" x2="${padding.left}" y1="${padding.top}" y2="${chartBottom}"></line>
      <circle class="chart-hover-dot chart-hover-dot-system" cx="${padding.left}" cy="${chartBottom}" r="4.5"></circle>
      <circle class="chart-hover-dot chart-hover-dot-low" cx="${padding.left}" cy="${chartBottom}" r="4.5"></circle>
      <circle class="chart-hover-dot chart-hover-dot-high" cx="${padding.left}" cy="${chartBottom}" r="4.5"></circle>
      <circle class="chart-hover-dot chart-hover-dot-margin" cx="${padding.left}" cy="${chartBottom}" r="4.5"></circle>
    </g>
    <text class="chart-legend chart-legend-base" x="${padding.left}" y="20">Carga base</text>
    <text class="chart-legend chart-legend-margin" x="${padding.left + 112}" y="20">Banda ± margen</text>
    <text class="chart-legend chart-legend-distribution" x="${padding.left + 258}" y="20">Gauss T exterior</text>
    <text class="chart-legend chart-legend-percentiles" x="${padding.left + 404}" y="20">Bandas percentiles</text>
    <rect
      class="chart-hit-area"
      x="${padding.left}"
      y="${padding.top}"
      width="${chartRight - padding.left}"
      height="${chartBottom - padding.top}"
      rx="20"
    ></rect>
  `;

  if (hvacChartInsights) {
    hvacChartInsights.innerHTML = `
      <article class="chart-insight-card">
        <p class="chart-insight-title">Lectura de clases</p>
        <div class="chart-insight-row">
          <span>Clase calefacción</span>
          <strong>${formatClass(result.heatingClass)}</strong>
        </div>
        <p class="chart-insight-copy">
          Carga + margen = ${formatNumber(result.heatingScenario.loadUpper)} kW. No incluye aún colchón ACS/operativo.
        </p>
        <div class="chart-insight-row">
          <span>Clase sistema</span>
          <strong>${formatClass(result.systemClass)}</strong>
        </div>
        <p class="chart-insight-copy">
          Sistema = ${formatNumber(result.systemScenario.systemLoad)} kW. Aquí sí entra el buffer ACS/operativo.
        </p>
      </article>
      <article class="chart-insight-card">
        <p class="chart-insight-title">Lectura rápida</p>
        <p class="chart-insight-copy">
          En este modelo no se dibuja <strong>H</strong> frente a la temperatura exterior porque sería
          una horizontal. La gráfica representa la <strong>carga</strong>, que sí cambia con la
          temperatura porque <strong>P = H × ΔT</strong>.
        </p>
        <div class="chart-zone-row">
          <span class="chart-zone-range">&lt;1 kW</span>
          <span class="chart-zone-copy">posible zona de ciclos ocasionales</span>
        </div>
        <div class="chart-zone-row">
          <span class="chart-zone-range">1-3 kW</span>
          <span class="chart-zone-copy">zona donde manda la modulación mínima</span>
        </div>
        <div class="chart-zone-row">
          <span class="chart-zone-range">3-5 kW</span>
          <span class="chart-zone-copy">zona de calefacción normal de invierno</span>
        </div>
      </article>
    `;
  }

  bindHvacChartInteraction(result, {
    width,
    padding,
    xMin,
    xMax,
    xScale,
    yScale
  });
}

function bindHvacChartInteraction(result, chartConfig) {
  if (!hvacChart || !hvacChartWrap) {
    return;
  }

  const hoverState = hvacChart.querySelector(".chart-hover-state");
  const hoverLine = hvacChart.querySelector(".chart-hover-line");
  const systemDot = hvacChart.querySelector(".chart-hover-dot-system");
  const lowDot = hvacChart.querySelector(".chart-hover-dot-low");
  const highDot = hvacChart.querySelector(".chart-hover-dot-high");
  const marginDot = hvacChart.querySelector(".chart-hover-dot-margin");
  const tooltip = ensureHvacChartTooltip();

  if (!hoverState || !hoverLine || !systemDot || !lowDot || !highDot || !marginDot || !tooltip) {
    return;
  }

  const { width, padding, xMin, xMax, xScale, yScale } = chartConfig;
  const usableWidth = width - padding.left - padding.right;
  const scenarioSnapThreshold = 0.3;

  const buildHoverScenario = (outdoorTemp) => {
    const delta = Math.max(0, result.input.indoorTemp - outdoorTemp);
    const baseLoad = (result.hTotal * delta) / 1000;
    const marginBand = baseLoad * (result.input.designMargin / 100);
    const loadLower = Math.max(0, baseLoad - marginBand);
    const loadUpper = baseLoad + marginBand;
    const systemLoad = loadUpper + result.input.operationalBuffer;

    return {
      outdoorTemp,
      baseLoad,
      loadLower,
      loadUpper,
      systemLoad
    };
  };

  const showHoverState = (clientX) => {
    const svgRect = hvacChart.getBoundingClientRect();
    const wrapRect = hvacChartWrap.getBoundingClientRect();
    const relativeX = ((clientX - svgRect.left) / svgRect.width) * width;
    const clampedX = clamp(relativeX, padding.left, width - padding.right);
    const outdoorTemp = roundTo(
      xMin + ((clampedX - padding.left) / usableWidth) * (xMax - xMin),
      0.1
    );
    const scenario = buildHoverScenario(outdoorTemp);
    const hoverX = xScale(outdoorTemp);
    const markerMatch = result.scenarios.find(
      (entry) => Math.abs(entry.outdoorTemp - outdoorTemp) <= scenarioSnapThreshold
    );

    hoverState.classList.add("is-visible");
    tooltip.classList.add("is-visible");
    hoverLine.setAttribute("x1", `${hoverX}`);
    hoverLine.setAttribute("x2", `${hoverX}`);
    systemDot.setAttribute("cx", `${hoverX}`);
    systemDot.setAttribute("cy", `${yScale(scenario.systemLoad)}`);
    lowDot.setAttribute("cx", `${hoverX}`);
    lowDot.setAttribute("cy", `${yScale(scenario.loadLower)}`);
    highDot.setAttribute("cx", `${hoverX}`);
    highDot.setAttribute("cy", `${yScale(scenario.baseLoad)}`);
    marginDot.setAttribute("cx", `${hoverX}`);
    marginDot.setAttribute("cy", `${yScale(scenario.loadUpper)}`);

    tooltip.innerHTML = `
      <div class="chart-tooltip-head">
        ${markerMatch ? `${markerMatch.label} · ` : ""}T exterior ${formatNumber(outdoorTemp)} °C
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-series">
          <span class="chart-tooltip-swatch chart-tooltip-swatch-system"></span>
          Carga + margen + colchón
        </span>
        <strong>${formatNumber(scenario.systemLoad)} kW</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-series">
          <span class="chart-tooltip-swatch chart-tooltip-swatch-margin"></span>
          Carga + margen
        </span>
        <strong>${formatNumber(scenario.loadUpper)} kW</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-series">
          <span class="chart-tooltip-swatch chart-tooltip-swatch-high"></span>
          Carga base
        </span>
        <strong>${formatNumber(scenario.baseLoad)} kW</strong>
      </div>
      <div class="chart-tooltip-row">
        <span class="chart-tooltip-series">
          <span class="chart-tooltip-swatch chart-tooltip-swatch-low"></span>
          Carga - margen
        </span>
        <strong>${formatNumber(scenario.loadLower)} kW</strong>
      </div>
    `;

    const tooltipWidth = tooltip.offsetWidth;
    const hoverXPx = svgRect.left - wrapRect.left + (hoverX / width) * svgRect.width;
    const left = clamp(hoverXPx - tooltipWidth / 2, 12, wrapRect.width - tooltipWidth - 12);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${svgRect.top - wrapRect.top + 14}px`;
  };

  const hideHoverState = () => {
    hoverState.classList.remove("is-visible");
    tooltip.classList.remove("is-visible");
  };

  hvacChart.onpointerenter = (event) => showHoverState(event.clientX);
  hvacChart.onpointermove = (event) => showHoverState(event.clientX);
  hvacChart.onpointerleave = () => hideHoverState();
  hvacChart.onpointerdown = (event) => {
    hvacChart.setPointerCapture(event.pointerId);
    showHoverState(event.clientX);
  };
  hvacChart.onpointerup = (event) => {
    if (hvacChart.hasPointerCapture(event.pointerId)) {
      hvacChart.releasePointerCapture(event.pointerId);
    }
    if (event.pointerType !== "mouse") {
      hideHoverState();
    }
  };
  hvacChart.onpointercancel = () => hideHoverState();
}

function ensureHvacChartTooltip() {
  if (!hvacChartWrap) {
    return null;
  }

  let tooltip = hvacChartWrap.querySelector(".chart-tooltip");
  if (tooltip) {
    return tooltip;
  }

  tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("aria-hidden", "true");
  hvacChartWrap.appendChild(tooltip);
  return tooltip;
}

function exportHvacPdf() {
  const result = lastHvacResult ?? calculateHvacScenario(hvacState, machineShortlist);
  const exportWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!exportWindow) {
    window.alert("No se pudo abrir la ventana de exportación. Revisa el bloqueador de popups.");
    return;
  }

  exportWindow.document.write(buildExportDocument(result));
  exportWindow.document.close();
}

function buildExportDocument(result) {
  const inputRows = buildInputRows(result)
    .map(
      (row) => `
        <tr>
          <td>${row.group}</td>
          <td>${row.label}</td>
          <td>${row.value}</td>
        </tr>
      `
    )
    .join("");

  const resultRows = buildRecommendationRows(result)
    .map(
      (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${row.value}</td>
          <td>${row.note}</td>
        </tr>
      `
    )
    .join("");

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Exportación HVAC</title>
      <base href="${document.baseURI}" />
      <style>
        :root {
          --bg: #f6f0e9;
          --paper: #fffaf5;
          --ink: #191613;
          --muted: #6b6057;
          --line: rgba(25, 22, 19, 0.14);
          --accent: #d64c2f;
          --sage: #79866d;
          --system: rgba(124, 210, 94, 0.9);
          --ui-font: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
          --display-font: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
          --mono-font: "SFMono-Regular", Menlo, Consolas, monospace;
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 2.2cm 1.6cm 1.6cm;
          color: var(--ink);
          background: white;
          font-family: var(--ui-font);
        }
        h1, h2, h3, p { margin: 0; }
        .export-header {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 0.9rem;
          align-items: center;
          margin-bottom: 1.2rem;
        }
        .export-header img {
          width: 3.1rem;
          height: 3.1rem;
          object-fit: contain;
          border-radius: 0.8rem;
        }
        .export-kicker {
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 0.68rem;
          font-weight: 700;
        }
        .export-title {
          font-family: var(--display-font);
          font-size: 2rem;
          line-height: 0.96;
          letter-spacing: -0.04em;
        }
        .export-copy {
          margin-top: 0.45rem;
          color: var(--muted);
          line-height: 1.45;
          font-size: 0.92rem;
        }
        .export-meta {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin: 0.9rem 0 1.15rem;
          color: var(--muted);
          font-size: 0.82rem;
        }
        .export-meta strong { color: var(--ink); }
        .export-block {
          margin-top: 1.15rem;
          padding-top: 0.95rem;
          border-top: 1px solid var(--line);
        }
        .export-block-title {
          margin-bottom: 0.7rem;
          font-family: var(--mono-font);
          font-size: 0.88rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .export-chart-card {
          padding: 0.9rem;
          border: 1px solid var(--line);
          border-radius: 1rem;
          background: var(--paper);
        }
        .export-chart-card svg {
          width: 100%;
          height: auto;
          display: block;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th, td {
          padding: 0.52rem 0.55rem;
          border: 1px solid var(--line);
          vertical-align: top;
          text-align: left;
          font-size: 0.86rem;
          line-height: 1.4;
        }
        th {
          background: #f5ede4;
          font-weight: 700;
        }
        .export-footer-note {
          margin-top: 1rem;
          color: var(--muted);
          font-size: 0.8rem;
          line-height: 1.45;
        }
        .chart-surface { fill: rgba(255, 255, 255, 0.62); }
        .chart-grid-line { stroke: rgba(25, 22, 19, 0.08); stroke-width: 1; }
        .chart-percentile-band { fill: rgba(121, 134, 109, 0.04); }
        .chart-percentile-band-extreme { fill: rgba(214, 76, 47, 0.06); }
        .chart-percentile-band-design { fill: rgba(214, 76, 47, 0.045); }
        .chart-percentile-band-winter { fill: rgba(178, 112, 67, 0.05); }
        .chart-percentile-band-habitual { fill: rgba(92, 148, 255, 0.09); }
        .chart-percentile-band-warm { fill: rgba(214, 76, 47, 0.08); }
        .chart-axis { stroke: rgba(25, 22, 19, 0.2); stroke-width: 1.5; }
        .chart-density-area { fill: rgba(121, 134, 109, 0.12); }
        .chart-density-line {
          fill: none;
          stroke: rgba(121, 134, 109, 0.72);
          stroke-width: 2;
          stroke-linecap: round;
        }
        .chart-path { fill: none; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
        .chart-path-base { stroke: var(--accent); }
        .chart-margin-band { fill: rgba(25, 22, 19, 0.18); }
        .chart-operational-band { fill: rgba(124, 210, 94, 0.52); }
        .chart-machine-line { stroke: rgba(25, 22, 19, 0.18); stroke-dasharray: 7 8; }
        .chart-percentile-line { stroke: rgba(25, 22, 19, 0.14); stroke-width: 1.1; stroke-dasharray: 3 7; }
        .chart-percentile-line-design { stroke: rgba(214, 76, 47, 0.32); }
        .chart-percentile-line-winter { stroke: rgba(150, 98, 54, 0.34); }
        .chart-percentile-line-habitual { stroke: rgba(121, 134, 109, 0.38); }
        .chart-machine-label, .chart-axis-label, .chart-legend {
          fill: var(--muted);
          font-size: 12px;
          font-family: var(--mono-font);
        }
        .chart-percentile-caption {
          fill: rgba(25, 22, 19, 0.5);
          font-size: 10px;
          font-family: var(--mono-font);
        }
        .chart-legend-base { fill: var(--accent); }
        .chart-legend-margin { fill: rgba(25, 22, 19, 0.68); }
        .chart-legend-distribution { fill: rgba(121, 134, 109, 0.82); }
        .chart-legend-percentiles { fill: rgba(25, 22, 19, 0.5); }
        .chart-point { fill: var(--accent); stroke: rgba(255, 255, 255, 0.95); stroke-width: 2; }
        .chart-modulation-card-surface { fill: rgba(252, 247, 240, 0.92); stroke: rgba(25, 22, 19, 0.08); stroke-width: 1; }
        .chart-modulation-card-title, .chart-modulation-card-subtitle, .chart-modulation-card-row-label, .chart-modulation-card-row-value {
          font-family: var(--mono-font);
        }
        .chart-modulation-card-title { fill: var(--ink); font-size: 7.8px; }
        .chart-modulation-card-subtitle { fill: rgba(25, 22, 19, 0.62); font-size: 7.4px; }
        .chart-modulation-card-line { stroke: rgba(25, 22, 19, 0.58); stroke-width: 1.4; stroke-dasharray: 4 4; stroke-linecap: round; }
        .chart-modulation-card-row-label { fill: var(--muted); font-size: 7.4px; }
        .chart-modulation-card-row-value { fill: var(--ink); font-size: 7.8px; font-weight: 700; }
        .chart-hover-state, .chart-hit-area { display: none; }

        @page { size: A4 portrait; margin: 1.3cm; }
      </style>
    </head>
    <body>
      <header class="export-header">
        <img src="./src/assets/ui/montenovo-mark.png" alt="" />
        <div>
          <p class="export-kicker">Montenovo · HVAC Calculator</p>
          <h1 class="export-title">Exportación de cálculo HVAC</h1>
          <p class="export-copy">
            Gráfica de carga térmica, tabla de inputs y lectura resumida de resultados y recomendaciones.
          </p>
        </div>
      </header>

      <div class="export-meta">
        <span><strong>T interior:</strong> ${formatNumber(result.input.indoorTemp)} °C</span>
        <span><strong>TS99:</strong> ${formatNumber(result.input.ts99)} °C</span>
        <span><strong>TS99,6:</strong> ${formatNumber(result.input.ts996)} °C</span>
        <span><strong>Margen:</strong> ${Math.round(result.input.designMargin)} %</span>
      </div>

      <section class="export-block">
        <h2 class="export-block-title">Gráfica</h2>
        <div class="export-chart-card">
          ${hvacChart.outerHTML}
        </div>
      </section>

      <section class="export-block">
        <h2 class="export-block-title">Valores de los inputs</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 28%">Bloque</th>
              <th style="width: 44%">Parámetro</th>
              <th style="width: 28%">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${inputRows}
          </tbody>
        </table>
      </section>

      <section class="export-block">
        <h2 class="export-block-title">Resultados y recomendaciones</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 26%">Lectura</th>
              <th style="width: 18%">Valor</th>
              <th style="width: 56%">Nota</th>
            </tr>
          </thead>
          <tbody>
            ${resultRows}
          </tbody>
        </table>
      </section>

      <p class="export-footer-note">
        La exportación abre el diálogo de impresión del navegador para guardar el documento como PDF.
      </p>

      <script>
        window.addEventListener("load", () => {
          setTimeout(() => window.print(), 250);
        });
        window.addEventListener("afterprint", () => window.close());
      </script>
    </body>
  </html>`;
}

function buildInputRows(result) {
  const groupMap = new Map(hvacControlGroups.map((group) => [group.id, group.title]));
  return hvacControls.map((control) => ({
    group: groupMap.get(control.group) ?? control.group,
    label: control.label,
    value: formatControlValue(control, readValueFromResult(result.input, control.key))
  }));
}

function buildRecommendationRows(result) {
  const shortlistRows = result.shortlist.map((brand) => ({
    label: `Recomendación ${brand.brand}`,
    value: brand.recommended ?? "Insuficiente",
    note: `${brand.summary} ${brand.nuance}`
  }));

  return [
    {
      label: "H transmisión",
      value: `${formatNumber(result.transmission)} W/K`,
      note: "Suma de huecos, fachada, cubierta y suelo con sus U activas."
    },
    {
      label: "H ventilación neta",
      value: `${formatNumber(result.ventilation)} W/K`,
      note: "Caudal VMC corregido por recuperación y pérdidas extra."
    },
    {
      label: "H total",
      value: `${formatNumber(result.hTotal)} W/K`,
      note: "Coeficiente final del modelo para calcular la carga."
    },
    {
      label: "Carga TS99",
      value: `${formatNumber(result.scenarios[0].baseLoad)} kW`,
      note: `Con margen: ${formatNumber(result.scenarios[0].loadUpper)} kW.`
    },
    {
      label: "Carga TS99,6",
      value: `${formatNumber(result.scenarios[1].baseLoad)} kW`,
      note: `Con margen: ${formatNumber(result.scenarios[1].loadUpper)} kW.`
    },
    {
      label: "Carga Tmin",
      value: `${formatNumber(result.scenarios[2].baseLoad)} kW`,
      note: `Con sistema: ${formatNumber(result.scenarios[2].systemLoad)} kW.`
    },
    {
      label: "Clase calefacción",
      value: formatClass(result.heatingClass),
      note: "Se dimensiona con la carga superior de TS99,6."
    },
    {
      label: "Clase sistema",
      value: formatClass(result.systemClass),
      note: "Añade colchón ACS / operativo sobre la banda superior."
    },
    {
      label: "Recomendación base",
      value: result.physicalRecommendation ? formatClass(result.physicalRecommendation) : "16+ kW",
      note: result.recommendationText
    },
    ...shortlistRows
  ];
}

function readValueFromResult(input, key) {
  switch (key) {
    case "areaOpenings":
      return input.areas.openings;
    case "areaFacade":
      return input.areas.facade;
    case "areaRoof":
      return input.areas.roof;
    case "areaFloor":
      return input.areas.floor;
    case "uOpenings":
      return input.uValues.openings;
    case "uFacade":
      return input.uValues.facade;
    case "uRoof":
      return input.uValues.roof;
    case "uFloor":
      return input.uValues.floor;
    case "extraLosses":
      return input.extras.base;
    default:
      return input[key];
  }
}

function readControlValue(key) {
  switch (key) {
    case "areaOpenings":
      return hvacState.areas.openings;
    case "areaFacade":
      return hvacState.areas.facade;
    case "areaRoof":
      return hvacState.areas.roof;
    case "areaFloor":
      return hvacState.areas.floor;
    case "uOpenings":
      return hvacState.uValues.openings;
    case "uFacade":
      return hvacState.uValues.facade;
    case "uRoof":
      return hvacState.uValues.roof;
    case "uFloor":
      return hvacState.uValues.floor;
    case "extraLosses":
      return hvacState.extras.base;
    default:
      return hvacState[key];
  }
}

function resetHvacState() {
  Object.assign(hvacState, structuredClone(hvacDefaults));
}

function syncHvacFormControls() {
  hvacControls.forEach((control) => {
    const value = readControlValue(control.key);
    document.querySelectorAll(`[data-control="${control.key}"]`).forEach((input) => {
      input.value = value;
    });
    document.querySelectorAll(`[data-display="${control.key}"]`).forEach((displayNode) => {
      displayNode.textContent = formatControlValue(control, value);
    });
  });
}

function writeControlValue(key, value) {
  switch (key) {
    case "areaOpenings":
      hvacState.areas.openings = value;
      break;
    case "areaFacade":
      hvacState.areas.facade = value;
      break;
    case "areaRoof":
      hvacState.areas.roof = value;
      break;
    case "areaFloor":
      hvacState.areas.floor = value;
      break;
    case "uOpenings":
      hvacState.uValues.openings = value;
      break;
    case "uFacade":
      hvacState.uValues.facade = value;
      break;
    case "uRoof":
      hvacState.uValues.roof = value;
      break;
    case "uFloor":
      hvacState.uValues.floor = value;
      break;
    case "extraLosses":
      hvacState.extras.base = value;
      break;
    default:
      hvacState[key] = value;
      break;
  }
}

function formatControlValue(control, value) {
  if (!control) {
    return formatNumber(value);
  }

  if (control.unit === "%") {
    return `${Math.round(value)} %`;
  }

  if (control.unit === "kW") {
    return `${value.toFixed(1)} ${control.unit}`;
  }

  if (control.unit === "m²" || control.unit === "m³/h" || control.unit === "W/K") {
    return `${formatNumber(value)} ${control.unit}`;
  }

  return `${Number(value).toFixed(2)} ${control.unit}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(value);
}

function formatClass(value) {
  return typeof value === "number" ? `${value} kW` : `${value} kW`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}
