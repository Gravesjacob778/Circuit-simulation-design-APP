# Circuit Simulation Design APP - Copilot Instructions

## Repository Summary

A **Vue 3 + TypeScript + Vite** circuit simulation application with a canvas-based visual editor. Uses **Konva.js** for rendering, **Pinia** for state management, and **Vitest** for testing. The app enables users to design, simulate, and visualize electronic circuits with DC/AC analysis.

## Build, Test, and Validation Commands

**IMPORTANT**: Always run these commands from the `front-end/` directory.

```bash
cd front-end

# 1. Install dependencies (ALWAYS run first after cloning or when package.json changes)
npm install

# 2. Run tests (fast, ~500ms) - ALWAYS run before and after making changes
npm run test

# 3. Build for production (includes TypeScript type-checking via vue-tsc)
npm run build

# 4. Start development server (port 3000, auto-opens browser)
npm run dev

# 5. Preview production build
npm run preview
```

### Known Build Issues

The build (`npm run build`) currently has **pre-existing TypeScript errors** (TS6133 unused imports, TS6196 unused declarations, TS2345 type mismatches, TS1117 duplicate properties) in files like `BodePlot.vue`, `FrequencyAnalysisPanel.vue`, `ACSweepSolver.ts`, and `rlcCalculations.ts`. These are NOT caused by your changes - they exist in the baseline. The test suite (`npm run test`) passes successfully with all 35 tests.

**Validation workflow**: Run `npm run test` to validate changes. Tests are located in `front-end/src/lib/simulation/__tests__/`.

## Project Structure

```
front-end/
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite bundler configuration
├── vitest.config.ts          # Test configuration
├── tsconfig.json             # TypeScript config (references tsconfig.app.json, tsconfig.node.json)
├── index.html                # Entry HTML
├── doc/                      # Architecture Decision Records (ADRs)
└── src/
    ├── main.ts               # App entry point
    ├── App.vue               # Root component
    ├── components/           # Vue components
    │   ├── layout/           # AppHeader, LeftSidebar, RightPanel
    │   └── workspace/        # CircuitCanvas, WaveformViewer, renderers/
    ├── stores/               # Pinia stores
    │   ├── circuitStore.ts   # Circuit state (components, wires, simulation)
    │   └── uiStore.ts        # UI state (grid, tool modes)
    ├── lib/                   # Pure computational utilities (NO UI dependencies)
    │   ├── geometryUtils.ts   # Coordinate transformations
    │   ├── gridUtils.ts       # Grid snapping
    │   ├── animationUtils.ts  # Animation path calculations
    │   ├── smartRouter.ts     # Wire routing algorithms
    │   └── simulation/        # MNA solver, transient analysis, rule engine
    │       └── __tests__/     # Unit tests
    ├── utils/                 # Konva.js integration classes
    │   ├── KonvaStage.ts      # Stage and layers management
    │   ├── KonvaRenderer.ts   # Drawing logic
    │   └── KonvaNodeManager.ts
    ├── config/               # componentDefinitions.ts
    ├── types/                # TypeScript type definitions (circuit.ts)
    └── composables/          # Vue composables
```

## Key Conventions

### Code Organization Rules

1. **Computation logic** → `src/lib/` (pure functions, no Vue/Konva dependencies)
2. **Konva.js logic** → `src/utils/Konva*.ts` classes
3. **Vue components** use `<script setup lang="ts">` with Composition API
4. **Event handlers** prefix with `handle` (e.g., `handlePortClick`)

### Component System

- Two-terminal components standardized to **60 units length**
- Horizontal: ports at `offsetX: ±30, offsetY: 0`
- Vertical: ports at `offsetX: 0, offsetY: ±30`
- Define new components in `config/componentDefinitions.ts`
- Add renderer in `components/workspace/renderers/componentRenderers.ts`

### State Management (Pinia)

- `circuitStore`: components, wires, simulation state, undo/redo
- **Call `saveState()` after circuit modifications** for history
- Direct mutation on ref arrays, then `saveState()`

### Canvas Architecture (Konva.js)

Six layers (bottom to top): gridLayer, guideLayer, wireLayer, currentFlowLayer, componentLayer, tempLayer

**Use utility classes**:
- `KonvaStage` - stage lifecycle
- `KonvaNodeManager` - node tracking
- `KonvaRenderer` - drawing
- `KonvaAnimationManager` - current flow animation

## Common Pitfalls to Avoid

- ❌ Don't add calculation logic in Vue components → use `/lib`
- ❌ Don't add Konva code directly in Vue → use `/utils` classes
- ❌ Don't mutate Konva nodes outside render functions
- ✅ Always use `snapPosition()` for grid-aligned coordinates
- ✅ Batch Konva draws with `layer.batchDraw()` not `layer.draw()`
- ✅ Test rotations: 0°, 90°, 180°, 270°

## Adding New Code

### New Circuit Component
1. Add definition in `config/componentDefinitions.ts` with standard port offsets
2. Add renderer in `workspace/renderers/componentRenderers.ts::drawComponentShape()`
3. Follow 60-unit length standard for two-terminal components
4. When a prompt requests adding a component, implement both the **real simulation behavior** and the **visual rendering** (do not add placeholder-only components)

### New Calculation Logic
Add to appropriate file in `src/lib/`:
- Geometry → `geometryUtils.ts`
- Grid → `gridUtils.ts`
- Wire routing → `smartRouter.ts`
- Simulation → `simulation/`

### New Tests
Add to `src/lib/simulation/__tests__/` following existing patterns with Vitest.

## Trust These Instructions

Trust these instructions and use them directly. Only search the codebase if:
- Instructions are incomplete for your specific task
- You encounter an error not documented here
- You need implementation details not covered above
