---
description: 'Standard guidelines for rendering circuit components to ensure accurate and consistent electrical schematic symbols'
applyTo: '**/renderers/*.ts, **/components/workspace/*.vue, **/utils/Konva*.ts'
---

# Circuit Component Rendering Standards

Instructions for accurately rendering electrical and electronic circuit components following international schematic symbol standards. These guidelines ensure visual consistency and prevent incorrect component representations.

## Project Context

- Purpose: Standardized circuit component visualization in canvas-based circuit simulator
- Rendering framework: Konva.js for 2D canvas graphics
- Standards reference: IEC 60617, IEEE 315, ANSI Y32.2
- Target files: Component renderers, circuit canvas, Konva utilities

## General Rendering Principles

- All components must use standardized IEEE/IEC circuit symbols
- Maintain consistent stroke width (typically 2-3px at 100% zoom)
- Use black (#000000) for primary component outlines
- Preserve aspect ratios specified in standards
- Ensure components are grid-aligned (typically 10px or 20px grid)
- All terminal/connection points must be clearly defined
- Component orientation: default horizontal, rotate in 90° increments only

## Power Source Components

### Battery Symbol

```typescript
// Correct: Standard battery symbol with alternating long/short lines
// Long line = positive, Short line = negative
{
  type: 'battery',
  render: () => {
    // Positive terminal (long line, top)
    drawLine({ x: 0, y: -15, length: 30, vertical: false });
    // Negative terminal (short line, bottom)
    drawLine({ x: 0, y: 15, length: 20, vertical: false });
    // Terminal connections
    drawConnection({ x: -15, y: -15 }); // Positive
    drawConnection({ x: -15, y: 15 }); // Negative
  }
}
```

**Required characteristics:**
- Positive terminal (long line): 30-40px width
- Negative terminal (short line): 20-25px width
- Spacing between terminals: 30px minimum
- For multiple cells: alternate long/short lines with equal spacing

### DC Voltage Source

```typescript
// Circle with + and - symbols, horizontal line through center
{
  type: 'dcVoltageSource',
  render: () => {
    drawCircle({ radius: 20, center: { x: 0, y: 0 } });
    drawLine({ x: -20, y: 0, length: 40, horizontal: true }); // Horizontal line
    drawText({ text: '+', position: { x: -8, y: -10 } });
    drawText({ text: '-', position: { x: -8, y: 10 } });
  }
}
```

### AC Voltage Source

```typescript
// Circle with sine wave inside
{
  type: 'acVoltageSource',
  render: () => {
    drawCircle({ radius: 20, center: { x: 0, y: 0 } });
    // Sine wave: one complete cycle within circle
    drawSineWave({ 
      amplitude: 10, 
      frequency: 1, 
      startX: -15, 
      endX: 15 
    });
  }
}
```

### Ground Symbol

```typescript
// Three horizontal lines decreasing in length, downward pointing
{
  type: 'ground',
  render: () => {
    // Connection point from above
    drawLine({ x: 0, y: 0, length: 10, vertical: true });
    // Three decreasing horizontal lines
    drawLine({ x: -15, y: 10, length: 30, horizontal: true }); // Longest
    drawLine({ x: -10, y: 14, length: 20, horizontal: true }); // Medium
    drawLine({ x: -5, y: 18, length: 10, horizontal: true }); // Shortest
  }
}
```

## Passive Components

### Resistor Symbol

```typescript
// IEEE/ANSI Standard: Zigzag pattern (6 peaks)
// IEC Standard: Rectangle
{
  type: 'resistor',
  style: 'ieee', // or 'iec'
  render: () => {
    if (style === 'ieee') {
      // Zigzag with 6 peaks, total length 60px
      const zigzagPoints = [
        { x: -30, y: 0 },
        { x: -25, y: -8 },
        { x: -15, y: 8 },
        { x: -5, y: -8 },
        { x: 5, y: 8 },
        { x: 15, y: -8 },
        { x: 25, y: 8 },
        { x: 30, y: 0 }
      ];
      drawPolyline(zigzagPoints);
      // Terminal wires extending 15px each side
      drawLine({ x: -45, y: 0, length: 15, horizontal: true });
      drawLine({ x: 30, y: 0, length: 15, horizontal: true });
    } else {
      // IEC: Rectangle 60px × 20px
      drawRectangle({ x: -30, y: -10, width: 60, height: 20 });
      drawLine({ x: -45, y: 0, length: 15, horizontal: true });
      drawLine({ x: 30, y: 0, length: 15, horizontal: true });
    }
  }
}
```

**Critical rules:**
- Zigzag must have 6-8 peaks for IEEE style
- Rectangle dimensions: 3:1 ratio (length:width)
- Terminal wires must extend beyond symbol body
- Value label positioned above or below, never overlapping

### Capacitor Symbol

```typescript
// Two parallel lines (non-polarized) or one curved (polarized)
{
  type: 'capacitor',
  polarized: false,
  render: () => {
    if (!polarized) {
      // Non-polarized: Two equal parallel lines
      drawLine({ x: -2, y: -15, length: 30, vertical: true });
      drawLine({ x: 2, y: -15, length: 30, vertical: true });
      // Terminal wires
      drawLine({ x: -20, y: 0, length: 18, horizontal: true });
      drawLine({ x: 2, y: 0, length: 18, horizontal: true });
    } else {
      // Polarized: One straight, one curved
      drawLine({ x: -2, y: -15, length: 30, vertical: true }); // Negative
      drawArc({ 
        x: 2, 
        y: 0, 
        radius: 15, 
        startAngle: -90, 
        endAngle: 90, 
        curveLeft: true 
      }); // Positive (curved)
      // + symbol near curved side
      drawText({ text: '+', position: { x: 10, y: -15 } });
    }
  }
}
```

**Polarized capacitor rules:**
- Curved line always represents positive terminal
- Mark positive side with '+' symbol
- Straight line represents negative terminal
- Gap between plates: 4-6px

### Inductor Symbol

```typescript
// Series of semicircular loops (typically 3-4 loops)
{
  type: 'inductor',
  render: () => {
    const loops = 4;
    const loopWidth = 15;
    const startX = -30;
    
    // Draw series of arcs representing coiled wire
    for (let i = 0; i < loops; i++) {
      drawArc({
        x: startX + (i * loopWidth),
        y: 0,
        radius: loopWidth / 2,
        startAngle: 180,
        endAngle: 0,
        direction: 'top'
      });
    }
    // Terminal wires
    drawLine({ x: -45, y: 0, length: 15, horizontal: true });
    drawLine({ x: startX + loops * loopWidth, y: 0, length: 15, horizontal: true });
  }
}
```

**Required characteristics:**
- 3-4 semicircular loops minimum
- Uniform loop size and spacing
- Loops should touch but not overlap
- Core can be represented by straight line through center (optional)

## Semiconductor Components

### Diode Symbol

```typescript
// Triangle pointing to vertical line (bar)
// Arrow direction shows current flow: anode to cathode
{
  type: 'diode',
  render: () => {
    // Triangle (arrow) pointing right
    drawTriangle({ 
      points: [
        { x: -10, y: -12 }, // Top left
        { x: -10, y: 12 },  // Bottom left
        { x: 10, y: 0 }     // Right point (cathode side)
      ],
      filled: true
    });
    // Vertical bar (cathode)
    drawLine({ x: 10, y: -12, length: 24, vertical: true });
    // Terminal wires
    drawLine({ x: -25, y: 0, length: 15, horizontal: true }); // Anode
    drawLine({ x: 10, y: 0, length: 15, horizontal: true }); // Cathode
  }
}
```

### Zener Diode Symbol

```typescript
// Standard diode with bent cathode bar (Z-shape)
{
  type: 'zenerDiode',
  render: () => {
    // Triangle (same as regular diode)
    drawTriangle({ 
      points: [
        { x: -10, y: -12 },
        { x: -10, y: 12 },
        { x: 10, y: 0 }
      ],
      filled: true
    });
    // Bent cathode bar (Z-shape)
    drawPolyline([
      { x: 10, y: -12 },
      { x: 10, y: 12 },
      { x: 5, y: 15 } // Bottom bend
    ]);
    drawLine({ x: 10, y: -12, length: 5, horizontal: true, direction: 'left' }); // Top bend
  }
}
```

### LED Symbol

```typescript
// Diode symbol with two arrows pointing outward (light emission)
{
  type: 'led',
  render: () => {
    // Standard diode triangle and bar
    drawTriangle({ 
      points: [
        { x: -10, y: -12 },
        { x: -10, y: 12 },
        { x: 10, y: 0 }
      ],
      filled: true
    });
    drawLine({ x: 10, y: -12, length: 24, vertical: true });
    
    // Light emission arrows (two arrows pointing away at 45° angle)
    drawArrow({ 
      start: { x: 5, y: -10 }, 
      end: { x: 15, y: -20 },
      arrowhead: true
    });
    drawArrow({ 
      start: { x: 10, y: -5 }, 
      end: { x: 20, y: -15 },
      arrowhead: true
    });
  }
}
```

### BJT Transistor (NPN/PNP)

```typescript
// Circle with three terminals: Collector, Base, Emitter
// Arrow direction distinguishes NPN (out) from PNP (in)
{
  type: 'bjt',
  variant: 'npn', // or 'pnp'
  render: () => {
    // Outer circle
    drawCircle({ radius: 20, center: { x: 0, y: 0 } });
    
    // Base line (vertical, left side)
    drawLine({ x: -10, y: -12, length: 24, vertical: true });
    
    if (variant === 'npn') {
      // Collector (top right, 45° angle)
      drawLine({ x: -10, y: -8, length: 20, angle: 45 });
      // Emitter (bottom right, -45° angle) with arrow pointing OUT
      drawLineWithArrow({ 
        x: -10, y: 8, 
        length: 20, 
        angle: -45, 
        arrowAtEnd: true 
      });
    } else {
      // PNP: Emitter arrow points IN
      drawLineWithArrow({ 
        x: -10, y: -8, 
        length: 20, 
        angle: 45, 
        arrowAtStart: true // Arrow points toward base
      });
      drawLine({ x: -10, y: 8, length: 20, angle: -45 });
    }
    
    // External connections
    drawLine({ x: -30, y: 0, length: 10, horizontal: true }); // Base
    drawLine({ x: 10, y: -15, length: 10, vertical: true }); // Collector
    drawLine({ x: 10, y: 15, length: 10, vertical: true }); // Emitter
  }
}
```

**Critical transistor rules:**
- NPN: Arrow points OUT from emitter (Not Pointing iN)
- PNP: Arrow points IN to emitter (Pointing iN Permanently)
- Base line must not extend beyond circle
- Arrow must be clearly visible and properly oriented

### MOSFET Symbol

```typescript
// Gate-Source-Drain configuration with channel line
{
  type: 'mosfet',
  channel: 'n', // or 'p'
  enhancement: true, // or depletion
  render: () => {
    // Gate line (vertical, left)
    drawLine({ x: -15, y: -20, length: 40, vertical: true });
    
    // Channel segments (three short lines for enhancement, one long for depletion)
    if (enhancement) {
      drawLine({ x: -5, y: -15, length: 8, vertical: true }); // Drain side
      drawLine({ x: -5, y: -2, length: 4, vertical: true }); // Middle
      drawLine({ x: -5, y: 7, length: 8, vertical: true }); // Source side
    } else {
      drawLine({ x: -5, y: -15, length: 30, vertical: true }); // Continuous channel
    }
    
    // Substrate connection (arrow for body diode)
    if (channel === 'n') {
      drawLineWithArrow({ x: 0, y: 0, length: 10, horizontal: true, arrowAtEnd: true });
    } else {
      drawLineWithArrow({ x: 0, y: 0, length: 10, horizontal: true, arrowAtStart: true });
    }
    
    // External terminals
    drawLine({ x: -25, y: 0, length: 10, horizontal: true }); // Gate
    drawLine({ x: 5, y: -15, length: 15, horizontal: true }); // Drain
    drawLine({ x: 5, y: 15, length: 15, horizontal: true }); // Source
  }
}
```

## Integrated Circuits

### Op-Amp Symbol

```typescript
// Triangle pointing right with two inputs and one output
{
  type: 'opamp',
  render: () => {
    // Triangle body
    drawTriangle({
      points: [
        { x: -20, y: -20 }, // Top left
        { x: -20, y: 20 },  // Bottom left
        { x: 20, y: 0 }     // Right point (output)
      ],
      filled: false,
      strokeWidth: 2
    });
    
    // Input terminals
    drawLine({ x: -30, y: -10, length: 10, horizontal: true }); // Non-inverting (+)
    drawLine({ x: -30, y: 10, length: 10, horizontal: true }); // Inverting (-)
    drawText({ text: '+', position: { x: -15, y: -10 } });
    drawText({ text: '−', position: { x: -15, y: 10 } }); // Use minus sign, not hyphen
    
    // Output terminal
    drawLine({ x: 20, y: 0, length: 10, horizontal: true });
    
    // Optional power supply connections (top/bottom)
    // drawLine({ x: 0, y: -20, length: 10, vertical: true }); // V+
    // drawLine({ x: 0, y: 20, length: 10, vertical: true }); // V-
  }
}
```

**Op-amp rules:**
- Triangle must point right (output on right)
- '+' input (non-inverting) on top
- '−' input (inverting) on bottom
- Use proper minus symbol (−), not hyphen (-)
- Power supply pins optional in simplified schematics

### Logic Gates

```typescript
// Standard logic gate shapes per IEEE 91-1984
const logicGates = {
  AND: {
    // D-shaped gate
    shape: 'rectangle-with-semicircle-right',
    width: 40,
    height: 30
  },
  OR: {
    // Curved shield shape
    shape: 'curved-shield',
    width: 40,
    height: 30
  },
  NOT: {
    // Triangle with circle (inverter)
    shape: 'triangle-with-bubble',
    width: 30,
    height: 20
  },
  NAND: {
    // AND gate with output bubble
    shape: 'and-with-bubble',
    width: 40,
    height: 30
  },
  NOR: {
    // OR gate with output bubble
    shape: 'or-with-bubble',
    width: 40,
    height: 30
  },
  XOR: {
    // OR gate with extra input curve
    shape: 'or-with-extra-curve',
    width: 40,
    height: 30
  }
};

// Inversion bubble (for NOT, NAND, NOR)
function drawInversionBubble(x: number, y: number) {
  drawCircle({ radius: 3, center: { x, y }, filled: false });
}
```

### Microcontroller/IC Package

```typescript
// Rectangle with pin numbering
{
  type: 'ic',
  pinCount: 8, // DIP-8, DIP-14, DIP-16, etc.
  render: () => {
    const pinSpacing = 15;
    const pinsPerSide = pinCount / 2;
    const height = (pinsPerSide - 1) * pinSpacing + 20;
    
    // IC body (rectangle)
    drawRectangle({ 
      x: -25, 
      y: -height / 2, 
      width: 50, 
      height: height,
      cornerRadius: 2
    });
    
    // Notch or dot indicating pin 1 orientation
    drawArc({ x: 0, y: -height / 2, radius: 5, startAngle: 0, endAngle: 180 });
    
    // Draw pins with numbering
    for (let i = 0; i < pinsPerSide; i++) {
      const yPos = -height / 2 + 10 + i * pinSpacing;
      // Left side pins (1, 2, 3...)
      drawLine({ x: -25, y: yPos, length: 10, horizontal: true, direction: 'left' });
      drawText({ text: String(i + 1), position: { x: -20, y: yPos } });
      
      // Right side pins (counted counter-clockwise from bottom-right)
      const rightPinNum = pinCount - i;
      drawLine({ x: 25, y: yPos, length: 10, horizontal: true, direction: 'right' });
      drawText({ text: String(rightPinNum), position: { x: 15, y: yPos } });
    }
    
    // IC label (center)
    drawText({ 
      text: 'IC NAME', 
      position: { x: 0, y: 0 }, 
      fontSize: 10,
      align: 'center'
    });
  }
}
```

## Switches and Connections

### SPST Switch (Single Pole Single Throw)

```typescript
// Two terminals with pivoting line
{
  type: 'spst',
  state: 'open', // or 'closed'
  render: () => {
    // Fixed terminal (left)
    drawCircle({ radius: 2, center: { x: -20, y: 0 }, filled: true });
    drawLine({ x: -30, y: 0, length: 10, horizontal: true });
    
    // Movable terminal (right)
    drawCircle({ radius: 2, center: { x: 20, y: 0 }, filled: true });
    drawLine({ x: 20, y: 0, length: 10, horizontal: true });
    
    // Switch arm (pivots from left terminal)
    if (state === 'closed') {
      drawLine({ x: -20, y: 0, length: 40, horizontal: true });
    } else {
      drawLine({ x: -20, y: 0, length: 40, angle: -30 }); // 30° open angle
    }
  }
}
```

### Wire Connection/Junction

```typescript
// Dot indicates connected wires, no dot means crossing without connection
{
  type: 'junction',
  connected: true,
  render: () => {
    if (connected) {
      // Filled circle indicates electrical connection
      drawCircle({ 
        radius: 4, 
        center: { x: 0, y: 0 }, 
        filled: true,
        fillColor: '#000000'
      });
    } else {
      // Crossing wires without connection: use bridge or no marking
      // Modern standard: no special marking needed for non-connected crossings
      // Optional: small semicircular bridge over one wire
    }
  }
}
```

**Critical connection rules:**
- ALWAYS use filled dot for connected junctions
- NEVER use dot for crossing wires that don't connect
- Dot radius: 3-5px typically
- Use wire bridging (small arc) for clarity if needed

### Transformer

```typescript
// Two inductor coils with parallel lines between (core)
{
  type: 'transformer',
  coreType: 'iron', // or 'air'
  render: () => {
    // Primary coil (left)
    drawInductorCoils({ x: -20, y: 0, loops: 3, direction: 'vertical' });
    
    // Secondary coil (right)
    drawInductorCoils({ x: 20, y: 0, loops: 3, direction: 'vertical' });
    
    // Core representation
    if (coreType === 'iron') {
      // Two parallel lines for iron core
      drawLine({ x: -5, y: -20, length: 40, vertical: true });
      drawLine({ x: 5, y: -20, length: 40, vertical: true });
    }
    // Air core: no lines between coils
    
    // Terminal connections
    drawLine({ x: -35, y: -10, length: 15, horizontal: true }); // Primary top
    drawLine({ x: -35, y: 10, length: 15, horizontal: true }); // Primary bottom
    drawLine({ x: 20, y: -10, length: 15, horizontal: true }); // Secondary top
    drawLine({ x: 20, y: 10, length: 15, horizontal: true }); // Secondary bottom
  }
}
```

## Common Rendering Mistakes to Avoid

### ❌ Incorrect Resistor

```typescript
// WRONG: Random zigzag without consistent peaks
drawPath('M -30 0 L -20 5 L -10 -3 L 0 8 L 10 -5 L 20 2 L 30 0');

// WRONG: Too few peaks (less than 6)
drawPath('M -30 0 L -15 8 L 0 -8 L 15 8 L 30 0');
```

### ❌ Incorrect Diode

```typescript
// WRONG: Arrow pointing away from bar (reversed polarity)
drawTriangle({ x: 10, y: 0, direction: 'left' }); // Arrow left
drawLine({ x: -10, y: -12, vertical: true, length: 24 }); // Bar on left

// WRONG: Bar not vertical or broken
drawLine({ x: 10, y: -12, length: 20, angle: 15 }); // Tilted bar
```

### ❌ Incorrect Transistor

```typescript
// WRONG: Arrow direction incorrect for NPN
drawLineWithArrow({ arrowAtStart: true }); // Arrow pointing IN on NPN

// WRONG: Base line extending outside circle
drawLine({ x: -10, y: -15, vertical: true, length: 30 }); // Too long
```

### ❌ Incorrect Wire Connections

```typescript
// WRONG: Using dot for crossing wires that don't connect
drawCircle({ filled: true }); // at wire crossing without electrical connection

// WRONG: Not using dot for actual connections
// Just crossing lines without junction marker at T-junction
```

## Component Labeling Standards

### Label Positioning

```typescript
{
  label: {
    position: 'auto', // or 'top', 'bottom', 'left', 'right'
    rules: {
      // Horizontal components: labels on top or bottom
      horizontal: ['top', 'bottom'],
      // Vertical components: labels on left or right
      vertical: ['left', 'right'],
      // Avoid overlapping with wires or other components
      clearance: 5 // pixels minimum
    }
  }
}
```

### Label Format

- **Reference designators**: R1, R2, C1, C2, L1, Q1, U1, etc.
  - Resistors: R + number
  - Capacitors: C + number
  - Inductors: L + number
  - Transistors: Q + number
  - ICs: U + number
  - Diodes: D + number

- **Values**: Include units
  - `10kΩ` or `10k` (resistor)
  - `100µF` or `100uF` (capacitor)
  - `50mH` (inductor)
  - `5V` (voltage source)

## Terminal/Connection Points

### Required Terminal Attributes

```typescript
interface Terminal {
  position: { x: number; y: number }; // Exact pixel coordinates
  direction: 'left' | 'right' | 'top' | 'bottom'; // Wire approach direction
  voltage: number | null; // Simulation voltage
  current: number | null; // Simulation current
  type: 'input' | 'output' | 'bidirectional';
}

// Visual representation
function drawTerminal(terminal: Terminal) {
  // Small circle or visible connection point
  drawCircle({ 
    radius: 3, 
    center: terminal.position,
    fillColor: '#FF0000', // Red for unconnected
    strokeColor: '#000000'
  });
}
```

### Terminal Spacing Standards

- Minimum spacing between terminals: 10px (1 grid unit)
- Standard spacing: 20px (2 grid units)
- DIP IC pin spacing: 2.54mm (100mil) scale equivalent
- Terminal markers should be visually distinct from wire junctions

## Color Coding (Optional Enhancement)

While standard schematics use black, color can aid understanding:

```typescript
const colorCodes = {
  power: {
    positive: '#FF0000', // Red
    negative: '#000000', // Black
    ground: '#00FF00'    // Green
  },
  wires: {
    default: '#000000',     // Black
    selected: '#0000FF',    // Blue
    simulating: '#FF6600',  // Orange
    error: '#FF0000'        // Red
  },
  components: {
    default: '#000000',
    active: '#00CC00',      // Active/powered
    inactive: '#666666',    // Inactive/unpowered
    error: '#FF0000'        // Malfunction
  }
};
```

**Color usage rules:**
- Use color only as supplementary information
- Schematic must be readable in black and white
- Never rely solely on color to convey critical information

## Validation Checklist

Before rendering any component, verify:

- [ ] Symbol matches IEEE/IEC standards
- [ ] All connection points are defined and accessible
- [ ] Component orientation is clear and standard
- [ ] Labels don't overlap with component graphics
- [ ] Polarity marks are present where needed (+/- for capacitors, arrows for diodes)
- [ ] Terminal spacing meets minimum standards
- [ ] Symbol scales proportionally with zoom
- [ ] Component fits within grid system
- [ ] No ambiguous wire connections (dots where needed)

## Implementation Example

```typescript
// Example: Complete resistor renderer with validation
class ResistorRenderer implements ComponentRenderer {
  render(component: ResistorComponent, context: CanvasContext): void {
    const { x, y, rotation, value, label } = component;
    const style = 'ieee'; // or get from settings
    
    // Validate before rendering
    if (!this.validate(component)) {
      this.renderErrorIndicator(x, y);
      return;
    }
    
    // Apply transformation
    context.save();
    context.translate(x, y);
    context.rotate(rotation * Math.PI / 180);
    
    // Render symbol based on standard
    if (style === 'ieee') {
      this.renderIEEEZigzag(context);
    } else {
      this.renderIECRectangle(context);
    }
    
    // Render terminals
    this.renderTerminals(context, [-45, 0], [45, 0]);
    
    // Render label
    this.renderLabel(context, label, value);
    
    context.restore();
  }
  
  private validate(component: ResistorComponent): boolean {
    return component.value > 0 && 
           component.terminals.length === 2 &&
           component.x != null &&
           component.y != null;
  }
  
  private renderIEEEZigzag(context: CanvasContext): void {
    const points = [
      { x: -30, y: 0 }, { x: -25, y: -8 },
      { x: -15, y: 8 }, { x: -5, y: -8 },
      { x: 5, y: 8 }, { x: 15, y: -8 },
      { x: 25, y: 8 }, { x: 30, y: 0 }
    ];
    
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => context.lineTo(p.x, p.y));
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.stroke();
  }
}
```

## Testing and Verification

### Visual Regression Tests

Create reference images for each component type:

```typescript
describe('Component Rendering', () => {
  it('renders resistor matching IEEE standard', () => {
    const rendered = renderComponent({ type: 'resistor', style: 'ieee' });
    expect(rendered).toMatchImageSnapshot();
  });
  
  it('renders NPN transistor with correct arrow direction', () => {
    const rendered = renderComponent({ type: 'bjt', variant: 'npn' });
    const arrow = findArrowInImage(rendered);
    expect(arrow.direction).toBe('outward'); // From emitter
  });
});
```

### Standards Compliance Validation

```typescript
function validateComponentSymbol(component: Component): ValidationResult {
  const standard = getApplicableStandard(component.type);
  
  return {
    matchesStandard: compareWithReference(component, standard),
    hasCorrectPolarity: checkPolarity(component),
    hasProperLabeling: validateLabels(component),
    terminalsAccessible: checkTerminals(component),
    gridAligned: isGridAligned(component)
  };
}
```

## Reference Resources

- **IEEE 315**: Graphic Symbols for Electrical and Electronics Diagrams
- **IEC 60617**: Graphical symbols for diagrams
- **ANSI Y32.2**: Graphic Symbols for Electrical and Electronics Diagrams
- **Circuit Symbol Standards**: [Wonderful PCB Guide](https://www.wonderfulpcb.com/zh-TW/blog/introduction-to-circuit-symbols/)

## Updates and Maintenance

When adding new component types:

1. Research the standard symbol representation
2. Document the exact geometric specifications
3. Create renderer implementation following this guide
4. Add visual regression tests
5. Update this instructions file with the new component
6. Verify with circuit simulation team

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Maintained By**: Circuit Simulator Development Team
