# Circuit Simulation Design APP

A web-based circuit simulation and design application that allows you to create, simulate, and analyze electronic circuits in your browser.

## Features

- **Interactive Circuit Design**: Click-and-place interface for adding electronic components
- **Component Library**: 
  - Resistors
  - Capacitors
  - Inductors
  - Voltage Sources
  - Current Sources
  - Wires
  - Ground symbols
- **Circuit Simulation**: Real-time simulation using fundamental electrical laws
- **Properties Panel**: Edit component values and properties
- **Save/Load**: Persist your circuit designs using browser localStorage
- **Visual Feedback**: Grid-based canvas with component symbols

## Getting Started

### Installation

No installation required! Simply open `index.html` in any modern web browser.

```bash
# Clone the repository
git clone https://github.com/Gravesjacob778/Circuit-simulation-design-APP.git

# Navigate to the directory
cd Circuit-simulation-design-APP

# Open in browser
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux
```

Alternatively, you can deploy it to any web server or use a local development server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (with npx)
npx serve

# Then open http://localhost:8000 in your browser
```

## How to Use

### Adding Components

1. Click on a component button in the left panel (e.g., "Resistor", "Capacitor")
2. Click on the canvas where you want to place the component
3. The component will appear at the clicked location

### Editing Component Properties

1. Click directly on a component in the canvas (without selecting a tool first)
2. The properties panel on the right will show the component details
3. Edit the value field and click "Update Value"
4. Use the "Delete Component" button to remove the selected component

### Running Simulations

1. Add your circuit components to the canvas
2. Click the "▶ Simulate" button
3. View the simulation results in the right panel, including:
   - Total resistance (for series circuits)
   - Total voltage
   - Current calculations (using Ohm's law: I = V/R)
   - Power calculations (P = V×I)
   - Total capacitance and inductance

### Saving and Loading

- **Save**: Click the "💾 Save" button to store your circuit design in the browser's localStorage
- **Load**: Click the "📂 Load" button to restore a previously saved circuit
- **Clear**: Click the "🗑️ Clear" button to remove all components from the canvas

## Technical Details

### Technologies Used

- **HTML5**: Structure and canvas element
- **CSS3**: Styling with modern gradients and responsive design
- **JavaScript (ES6+)**: Circuit logic, component rendering, and simulation engine

### Simulation Engine

The application uses simplified circuit analysis with series configuration assumptions:
- **Series Resistance**: R_total = R₁ + R₂ + R₃ + ...
- **Series Capacitance**: 1/C_total = 1/C₁ + 1/C₂ + 1/C₃ + ...
- **Series Inductance**: L_total = L₁ + L₂ + L₃ + ...
- **Ohm's Law**: I = V / R
- **Power Calculation**: P = V × I

**Note**: The current version assumes all components are in series. Parallel circuit analysis is planned for a future release.

### Component Classes

- `CircuitComponent`: Base class for all circuit elements with drawing and property methods
- `CircuitSimulator`: Main application controller handling canvas interaction, component management, and simulation

## Browser Compatibility

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Any modern browser with HTML5 Canvas support

## Future Enhancements

Potential improvements for future versions:
- Wire connections between components
- Parallel circuit analysis
- AC circuit analysis
- More component types (diodes, transistors, op-amps)
- Export circuit diagrams as images
- Real-time waveform visualization
- Component dragging functionality
- Undo/redo functionality

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Created by Gravesjacob778

## Acknowledgments

- Inspired by traditional circuit simulation tools like SPICE and CircuitLab
- Built with modern web technologies for accessibility and ease of use
