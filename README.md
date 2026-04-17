# HVAC Calculator

Calculadora web estática para estimar la carga térmica de calefacción de una vivienda y recomendar una clase de máquina HVAC a partir de hipótesis simplificadas de envolvente, ventilación y margen de diseño.

## Qué hace

- Calcula la carga base a partir de transmisión, ventilación y pérdidas extra.
- Compara tres escenarios exteriores: `TS99`, `TS99,6` y `Tmin observada`.
- Aplica un margen de dimensionado y un colchón operativo para elevar la recomendación de clase.
- Genera una recomendación física de potencia y una shortlist por marca.
- Permite exportar un resumen imprimible en PDF desde la propia interfaz.

## Modelo de cálculo

El cálculo principal se basa en:

- `Htransmisión = Σ(area × U)`
- `Hventilación = 0.33 × caudal VMC × (1 - recuperación)`
- `Htotal = Htransmisión + Hventilación + extras`
- `Carga = Htotal × (Tin - Tout) / 1000`

Sobre esa carga se aplica:

- un margen de diseño configurable
- un colchón operativo adicional para la recomendación de sistema

La lógica principal está en `src/utils/hvac.js` y los datos base del escenario están en `src/data/site.js`.

## Estructura

- `index.html`: shell estático de la app.
- `src/main.js`: renderizado de controles, resultados y exportación.
- `src/utils/hvac.js`: motor de cálculo y recomendación.
- `src/data/site.js`: valores por defecto, controles y perfil climático.
- `scripts/build-static.mjs`: copia `index.html` y `src/` a `dist/`.
- `netlify.toml`: configuración de build/publicación para Netlify.

## Scripts

```bash
npm run check
npm run build
npm run deploy
```

## Desarrollo local

```bash
npm run check
npm run build
open dist/index.html
```

No hay bundler ni framework: el proyecto se sirve como sitio estático.

## Deploy

El despliegue de producción usa Netlify y publica el contenido de `dist`:

```bash
npm run deploy
```

Ese script:

1. reconstruye `dist`
2. ejecuta `netlify deploy --prod --dir=dist --no-build`

## Repositorio

GitHub: <https://github.com/JesCR/HVAC_Calculator>
