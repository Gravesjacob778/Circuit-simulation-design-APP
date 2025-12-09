// Circuit Simulation Design APP
// Main JavaScript file

class CircuitComponent {
    constructor(type, x, y) {
        this.id = Date.now() + Math.random();
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 40;
        this.value = this.getDefaultValue();
        this.connections = [];
        this.selected = false;
    }

    getDefaultValue() {
        const defaults = {
            'resistor': 1000,      // 1kΩ
            'capacitor': 0.000001, // 1µF
            'inductor': 0.001,     // 1mH
            'voltage-source': 5,   // 5V
            'current-source': 0.001, // 1mA
            'wire': 0,
            'ground': 0
        };
        return defaults[this.type] || 0;
    }

    draw(ctx) {
        ctx.save();
        
        // Draw selection highlight
        if (this.selected) {
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
        }

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;

        switch (this.type) {
            case 'resistor':
                this.drawResistor(ctx);
                break;
            case 'capacitor':
                this.drawCapacitor(ctx);
                break;
            case 'inductor':
                this.drawInductor(ctx);
                break;
            case 'voltage-source':
                this.drawVoltageSource(ctx);
                break;
            case 'current-source':
                this.drawCurrentSource(ctx);
                break;
            case 'ground':
                this.drawGround(ctx);
                break;
            case 'wire':
                this.drawWire(ctx);
                break;
        }

        // Draw connection points
        this.drawConnectionPoints(ctx);

        ctx.restore();
    }

    drawResistor(ctx) {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.fill();
        ctx.stroke();
        
        // Zigzag pattern
        ctx.beginPath();
        const zigzagY = this.y + this.height / 2;
        ctx.moveTo(this.x, zigzagY);
        for (let i = 0; i < 6; i++) {
            const xPos = this.x + (i * this.width / 6);
            const yPos = i % 2 === 0 ? zigzagY - 8 : zigzagY + 8;
            ctx.lineTo(xPos, yPos);
        }
        ctx.lineTo(this.x + this.width, zigzagY);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('R', this.x + this.width / 2 - 5, this.y - 5);
    }

    drawCapacitor(ctx) {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.fill();
        ctx.stroke();

        // Two parallel lines
        const centerX = this.x + this.width / 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 2, this.y + 5);
        ctx.lineTo(centerX - 2, this.y + this.height - 5);
        ctx.moveTo(centerX + 2, this.y + 5);
        ctx.lineTo(centerX + 2, this.y + this.height - 5);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('C', this.x + this.width / 2 - 5, this.y - 5);
    }

    drawInductor(ctx) {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.fill();
        ctx.stroke();

        // Coil pattern
        ctx.beginPath();
        const coilY = this.y + this.height / 2;
        ctx.moveTo(this.x, coilY);
        for (let i = 0; i < 4; i++) {
            const xPos = this.x + (i * this.width / 4);
            ctx.arc(xPos + this.width / 8, coilY, this.width / 8, Math.PI, 0, false);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('L', this.x + this.width / 2 - 5, this.y - 5);
    }

    drawVoltageSource(ctx) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const radius = Math.min(this.width, this.height) / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Plus and minus symbols
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('+', centerX - radius / 2 - 5, centerY + 5);
        ctx.fillText('-', centerX + radius / 2 - 5, centerY + 5);

        // Label
        ctx.font = '10px Arial';
        ctx.fillText('V', centerX - 5, this.y - 5);
    }

    drawCurrentSource(ctx) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const radius = Math.min(this.width, this.height) / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Arrow
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius / 2);
        ctx.lineTo(centerX, centerY + radius / 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius / 2);
        ctx.lineTo(centerX - 5, centerY - radius / 2 + 8);
        ctx.lineTo(centerX + 5, centerY - radius / 2 + 8);
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('I', centerX - 5, this.y - 5);
    }

    drawGround(ctx) {
        const centerX = this.x + this.width / 2;
        const topY = this.y;

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, topY);
        ctx.lineTo(centerX, topY + this.height / 2);
        ctx.stroke();

        // Three horizontal lines
        for (let i = 0; i < 3; i++) {
            const lineY = topY + this.height / 2 + (i * 8);
            const lineWidth = this.width / 2 - (i * 8);
            ctx.beginPath();
            ctx.moveTo(centerX - lineWidth / 2, lineY);
            ctx.lineTo(centerX + lineWidth / 2, lineY);
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('GND', this.x + this.width / 2 - 12, this.y - 5);
    }

    drawWire(ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width, this.y + this.height / 2);
        ctx.stroke();
    }

    drawConnectionPoints(ctx) {
        const points = this.getConnectionPoints();
        ctx.fillStyle = '#007bff';
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    getConnectionPoints() {
        const centerY = this.y + this.height / 2;
        return [
            { x: this.x, y: centerY, side: 'left' },
            { x: this.x + this.width, y: centerY, side: 'right' }
        ];
    }

    isPointInside(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }
}

class CircuitSimulator {
    constructor() {
        this.canvas = document.getElementById('circuit-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.components = [];
        this.selectedComponent = null;
        this.selectedTool = null;
        this.setupEventListeners();
        this.draw();
    }

    setupEventListeners() {
        // Component buttons
        document.querySelectorAll('.component-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.component-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTool = btn.dataset.type;
            });
        });

        // Canvas clicks
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.selectedTool) {
                this.addComponent(this.selectedTool, x, y);
            } else {
                this.selectComponent(x, y);
            }
        });

        // Action buttons
        document.getElementById('simulate-btn').addEventListener('click', () => this.simulate());
        document.getElementById('clear-btn').addEventListener('click', () => this.clear());
        document.getElementById('save-btn').addEventListener('click', () => this.save());
        document.getElementById('load-btn').addEventListener('click', () => this.load());
    }

    addComponent(type, x, y) {
        const component = new CircuitComponent(type, x - 30, y - 20);
        this.components.push(component);
        this.draw();
    }

    selectComponent(x, y) {
        // Deselect all components
        this.components.forEach(c => c.selected = false);
        
        // Find and select clicked component
        for (let i = this.components.length - 1; i >= 0; i--) {
            if (this.components[i].isPointInside(x, y)) {
                this.components[i].selected = true;
                this.selectedComponent = this.components[i];
                this.showProperties(this.components[i]);
                this.draw();
                return;
            }
        }
        
        this.selectedComponent = null;
        this.hideProperties();
        this.draw();
    }

    showProperties(component) {
        const container = document.getElementById('properties-content');
        const units = {
            'resistor': 'Ω',
            'capacitor': 'F',
            'inductor': 'H',
            'voltage-source': 'V',
            'current-source': 'A'
        };

        container.innerHTML = `
            <div class="property-item">
                <label>Type:</label>
                <input type="text" value="${component.type}" readonly>
            </div>
            <div class="property-item">
                <label>Value ${units[component.type] || ''}:</label>
                <input type="number" id="component-value" value="${component.value}" step="any">
            </div>
            <div class="property-item">
                <button id="update-value-btn" class="action-btn">Update Value</button>
            </div>
            <div class="property-item">
                <button id="delete-component-btn" class="action-btn" style="background: #dc3545;">Delete Component</button>
            </div>
        `;

        document.getElementById('update-value-btn').addEventListener('click', () => {
            const newValue = parseFloat(document.getElementById('component-value').value);
            if (!isNaN(newValue)) {
                component.value = newValue;
                this.draw();
            }
        });

        document.getElementById('delete-component-btn').addEventListener('click', () => {
            this.components = this.components.filter(c => c.id !== component.id);
            this.hideProperties();
            this.draw();
        });
    }

    hideProperties() {
        document.getElementById('properties-content').innerHTML = '<p class="hint">Select a component to view properties</p>';
    }

    simulate() {
        // Simple simulation: calculate total resistance in series
        const resistors = this.components.filter(c => c.type === 'resistor');
        const voltageSources = this.components.filter(c => c.type === 'voltage-source');
        
        if (resistors.length === 0 && voltageSources.length === 0) {
            alert('Add components to simulate!');
            return;
        }

        const resultsContainer = document.getElementById('results-content');
        let results = '';

        // Calculate total resistance (series assumption)
        if (resistors.length > 0) {
            const totalResistance = resistors.reduce((sum, r) => sum + r.value, 0);
            results += `<div class="result-item">
                <span class="result-label">Total Resistance (Series):</span><br>
                <span class="result-value">${totalResistance.toFixed(2)} Ω</span>
            </div>`;
        }

        // Calculate total voltage
        if (voltageSources.length > 0) {
            const totalVoltage = voltageSources.reduce((sum, v) => sum + v.value, 0);
            results += `<div class="result-item">
                <span class="result-label">Total Voltage:</span><br>
                <span class="result-value">${totalVoltage.toFixed(2)} V</span>
            </div>`;

            // Calculate current using Ohm's law if resistors exist
            if (resistors.length > 0) {
                const totalResistance = resistors.reduce((sum, r) => sum + r.value, 0);
                const current = totalVoltage / totalResistance;
                results += `<div class="result-item">
                    <span class="result-label">Current (I = V/R):</span><br>
                    <span class="result-value">${(current * 1000).toFixed(2)} mA</span>
                </div>`;

                // Calculate power
                const power = totalVoltage * current;
                results += `<div class="result-item">
                    <span class="result-label">Power (P = V×I):</span><br>
                    <span class="result-value">${(power * 1000).toFixed(2)} mW</span>
                </div>`;
            }
        }

        // Capacitor info
        const capacitors = this.components.filter(c => c.type === 'capacitor');
        if (capacitors.length > 0) {
            const totalCapacitance = capacitors.reduce((sum, c) => sum + c.value, 0);
            results += `<div class="result-item">
                <span class="result-label">Total Capacitance:</span><br>
                <span class="result-value">${(totalCapacitance * 1000000).toFixed(2)} µF</span>
            </div>`;
        }

        // Inductor info
        const inductors = this.components.filter(c => c.type === 'inductor');
        if (inductors.length > 0) {
            const totalInductance = inductors.reduce((sum, l) => sum + l.value, 0);
            results += `<div class="result-item">
                <span class="result-label">Total Inductance:</span><br>
                <span class="result-value">${(totalInductance * 1000).toFixed(2)} mH</span>
            </div>`;
        }

        resultsContainer.innerHTML = results || '<p class="hint">No results to display</p>';
    }

    clear() {
        if (confirm('Are you sure you want to clear all components?')) {
            this.components = [];
            this.selectedComponent = null;
            this.hideProperties();
            document.getElementById('results-content').innerHTML = '<p class="hint">Run simulation to see results</p>';
            this.draw();
        }
    }

    save() {
        const data = JSON.stringify(this.components.map(c => ({
            type: c.type,
            x: c.x,
            y: c.y,
            value: c.value
        })));
        
        localStorage.setItem('circuit-design', data);
        alert('Circuit saved successfully!');
    }

    load() {
        const data = localStorage.getItem('circuit-design');
        if (data) {
            try {
                const savedComponents = JSON.parse(data);
                this.components = savedComponents.map(c => {
                    const component = new CircuitComponent(c.type, c.x, c.y);
                    component.value = c.value;
                    return component;
                });
                this.draw();
                alert('Circuit loaded successfully!');
            } catch (e) {
                alert('Error loading circuit!');
            }
        } else {
            alert('No saved circuit found!');
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw all components
        this.components.forEach(component => {
            component.draw(this.ctx);
        });
    }
}

// Initialize the simulator when the page loads
window.addEventListener('load', () => {
    new CircuitSimulator();
});
