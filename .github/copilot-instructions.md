# Circuit Simulation Design APP - AI Coding Agent Instructions

## Architecture Overview

This is a **Vue 3 + TypeScript + Vite** circuit simulation application with a canvas-based visual editor. The app uses **Konva.js** for rendering, **Pinia** for state management, and follows a **separation of concerns** pattern with computational utilities extracted to `/lib`.

### Key Directories

- `front-end/src/components/` - Vue components split by domain (layout, workspace)
- `front-end/src/stores/` - Pinia stores for circuit and UI state
- `front-end/src/lib/` - Pure computational utilities (geometry, grid, animation, routing)
- `front-end/src/types/` - TypeScript type definitions
- `front-end/src/config/` - Component definitions and configuration
- `front-end/doc/` - Architecture decision records (ADRs)

## Core Concepts

### Component System

**All two-terminal components are standardized to 60 units length** (see `doc/COMPONENT_LENGTH_STANDARDIZATION.md`):
- Horizontal components: ports at `offsetX: ±30, offsetY: 0`
- Vertical components: ports at `offsetX: 0, offsetY: ±30`
- Component definitions in `config/componentDefinitions.ts` must match renderer logic in `components/workspace/renderers/componentRenderers.ts`

### State Management Pattern

Uses **Pinia stores** with composition API:
- `circuitStore` - manages components, wires, nodes with undo/redo via JSON snapshots
- `uiStore` - manages grid settings, tool modes, panel visibility

**Critical**: When modifying circuit state, components are updated by direct mutation on the ref array, then `saveState()` is called for history.

## Canvas Rendering Architecture

`CircuitCanvas.vue` manages **six Konva layers** (bottom to top) through the **KonvaStage class**:
1. `gridLayer` - background grid
2. `guideLayer` - alignment guides during drag
3. `wireLayer` - wire connections
4. `currentFlowLayer` - current flow animation particles
5. `componentLayer` - circuit components
6. `tempLayer` - temporary wiring preview

**Konva Classes** (in `/utils`):
- **KonvaStage** - Manages stage and layers lifecycle
- **KonvaNodeManager** - Tracks component and wire Konva nodes
- **KonvaRenderer** - Handles drawing logic for components and wires
- **KonvaAnimationManager** - Manages current flow particle animation
- **KonvaEventHandler** - Centralized event binding for stage, components, and ports

**Rendering pattern**:
- Component shapes: `renderers/componentRenderers.ts::drawComponentShape()`
- Wire routing: `lib/smartRouter.ts::smartOrthogonalRoute()`
- Port positions: `lib/geometryUtils.ts::getRotatedPortPosition()`

### Wire Routing System

Implements **smart orthogonal (Manhattan) routing** with lane separation:
- Preview mode uses L-shaped paths (`calculateOrthogonalPath` with `useZShape: false`)
- Final wires use Z-shaped paths to avoid components (`useZShape: true`)
- `buildExistingWireSegments()` detects overlaps and applies lane offsets
- See `doc/WIRING_IMPROVEMENTS.md` for click-to-wire interaction pattern

### Grid System

Grid snapping is handled by `lib/gridUtils.ts`:
- `snapPosition(x, y, gridSize, snapToGrid)` - core snapping logic
- Default grid size: 20 units
- All component positions and wire waypoints snap to grid
- `uiStore.snapPosition()` delegates to `gridUtils` with current settings

## Development Workflows

### Running the App

```bash
cd front-end
npm run dev          # Start dev server (Vite)
npm run build        # Type-check with vue-tsc, then build
npm run preview      # Preview production build
```

### Adding New Components

1. Define in `config/componentDefinitions.ts` with standardized port offsets
2. Add renderer in `renderers/componentRenderers.ts::drawComponentShape()`
3. Ensure ports follow the 60-unit length standard for two-terminal components
4. Test rotation (0°, 90°, 180°, 270°) with `getRotatedPortPosition()`

### Modifying Calculation Logic

**All computational functions live in `/lib`** - never add calculations to Vue components:
- Geometry/coordinates → `lib/geometryUtils.ts`
- Grid snapping/alignment → `lib/gridUtils.ts`
- Animation paths → `lib/animationUtils.ts`
- Wire routing → `lib/smartRouter.ts`

See `src/lib/README.md` for organization principles.

## Project-Specific Conventions

### Vue Component Style

Uses `<script setup lang="ts">` with Composition API:
- Reactive state with `ref()` and `computed()`
- Konva instances stored in module-level `let` variables (not refs)
- Event handlers prefixed with `handle` (e.g., `handlePortClick`)

### Type Definitions

Core types in `types/circuit.ts`:
- `ComponentType` - union of string literals (not enum)
- `CircuitComponent` - includes computed `selected` boolean
- `Wire` - stores connection IDs + optional `points` for custom routing
- Ports use relative `offsetX/offsetY` from component center

### Current Flow Animation

Particles flow along wire paths using `animationUtils`:
1. `getAllWirePathsWithDirection()` traces from power source positive terminal
2. BFS traversal determines flow direction per wire (1 = forward, -1 = reverse)
3. `Konva.Animation` updates particle positions via `getPositionOnPath()`
4. State controlled by `circuitStore.isCurrentAnimating`

### Visual Feedback Patterns

Click-to-wire mode (see `WIRING_IMPROVEMENTS.md`):
- Click port → pulse animation + hint text on `tempLayer`
- Hover valid port → green glow + pointer cursor
- Hover same port → red border + not-allowed cursor
- Mouse move → yellow dashed preview line
- Cancel via ESC/background click → stops animation

## Integration Points

### Konva.js Integration

Components are `Konva.Group` nodes with:
- Custom shapes added via `drawComponentShape()`
- Port circles marked with `.name('port')` for event targeting
- Draggable only when `component.selected && !isWiring`
- Position updates trigger `renderAllWires()` for wire reflow

### Pinia Store Patterns

Stores use composition API return pattern:
```typescript
return {
  // State
  myState,
  // Getters
  myComputed,
  // Actions
  myFunction,
};
```

Watch store changes in components with `watch(() => store.property, callback, options)`.

## Common Pitfalls

- **Don't** add computation logic to Vue components - extract to `/lib`
- **Don't** add Konva logic directly to Vue components - use `/utils` classes
- **Don't** mutate Konva nodes outside render functions - use `destroyChildren()` + redraw
- **Do** call `saveState()` after circuit modifications for undo/redo
- **Do** use `snapPosition()` for all coordinate calculations involving user input
- **Do** batch Konva draws with `layer.batchDraw()` instead of multiple `layer.draw()` calls
- **Do** use KonvaStage, KonvaNodeManager, KonvaRenderer classes for Konva operations

## Konva Classes Quick Reference

### Initialization Pattern

```typescript
import { KonvaStage } from '@/utils/KonvaStage';
import { KonvaNodeManager } from '@/utils/KonvaNodeManager';
import { KonvaRenderer } from '@/utils/KonvaRenderer';
import { KonvaAnimationManager } from '@/utils/KonvaAnimationManager';
import { KonvaEventHandler } from '@/utils/KonvaEventHandler';

// Setup
const konvaStage = new KonvaStage();
konvaStage.initialize(container, width, height);

const nodeManager = new KonvaNodeManager();
const renderer = new KonvaRenderer(nodeManager);
const animationManager = new KonvaAnimationManager();
const eventHandler = new KonvaEventHandler();

// Initialize animation manager
animationManager.initialize(konvaStage.getCurrentFlowLayer());

// Cleanup on unmount
onUnmounted(() => {
  konvaStage.destroy();
});
```

### Key Classes

1. **KonvaStage** - Stage and layer lifecycle
   - `initialize(container, w, h)` - create stage and layers
   - `getStage()`, `getComponentLayer()`, `getWireLayer()`, etc.
   - `resize(w, h)` - responsive resizing
   - `destroy()` - cleanup

2. **KonvaNodeManager** - Track Konva nodes
   - `setComponentNode(id, node)` / `getComponentNode(id)`
   - `setWireNode(id, node)` / `getWireNode(id)`
   - `clearComponentNodes()` / `clearWireNodes()`

3. **KonvaRenderer** - Drawing and updates
   - `createComponentNode(comp, callbacks)` - with event bindings
   - `renderAllComponents(components, layer, createFn)`
   - `renderAllWires(wires, layer, components, gridSize, canvasSize)`
   - `updateWireSelection(wireId, isSelected, layer)`

4. **KonvaAnimationManager** - Current flow animation
   - `createParticles(paths)` - from `getAllWirePathsWithDirection()`
   - `start(getPositionOnPath)` - animate particles
   - `stop()` - stop and cleanup
   - `reinitializeParticles(paths)` - when wires change

5. **KonvaEventHandler** - Event callbacks
   - `setStageCallbacks({ onStageClick, onStageWheel, ... })`
   - `setComponentCallbacks({ onComponentDragMove, ... })`
   - `setPortCallbacks({ onPortClick, ... })`
   - `bindStageEvents(stage)` - attach to stage

## Testing Suggestions

When modifying wire routing or component rendering:
1. Test all 4 rotations (0°, 90°, 180°, 270°)
2. Verify grid snapping at different zoom levels
3. Check wire routing avoids overlaps with multiple parallel connections
4. Validate current animation direction with DC sources
