# Logic Gates Skill

A comprehensive agent skill for working with digital logic gates in circuit design and digital electronics.

## Skill Structure

```
logic-gates/
├── SKILL.md                              # Main skill instructions
├── LICENSE.txt                           # Apache 2.0 license
├── README.md                            # This file
└── references/                          # Extended reference documentation
    ├── boolean-algebra.md               # Boolean algebra theorems and laws
    └── universal-gate-conversions.md    # NAND/NOR gate conversion guide
```

## What This Skill Provides

### Core Knowledge
- All 7 basic logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR)
- Truth tables and Boolean expressions for each gate
- Logic gate symbols and representations
- Universal gate concepts
- Implementation guidelines and best practices

### Extended References
- **Boolean Algebra**: Complete reference for Boolean laws, theorems, DeMorgan's rules, and simplification techniques
- **Universal Gate Conversions**: Detailed guide for implementing any logic circuit using only NAND or NOR gates

## When to Use This Skill

Copilot will automatically load this skill when you:
- Ask about logic gates or digital logic
- Need to create truth tables
- Want to implement Boolean logic
- Request circuit design with gates
- Ask about gate conversions
- Need help with digital circuit design
- Discuss combinational or sequential circuits
- Work on logic optimization

## Usage Examples

### Example 1: Basic Gate Information
```
User: "How does a NAND gate work?"
→ Skill provides NAND gate definition, truth table, Boolean expression, and symbol
```

### Example 2: Circuit Design
```
User: "Design a circuit that outputs 1 when inputs are different"
→ Skill identifies XOR gate requirement and provides implementation
```

### Example 3: Universal Gates
```
User: "How can I implement an OR gate using only NAND gates?"
→ Skill provides step-by-step NAND-only OR implementation
```

### Example 4: Boolean Simplification
```
User: "Simplify: AB + AB' + A'B"
→ Skill applies Boolean algebra rules from references
```

## Integration with Circuit Design Application

This skill is particularly useful for the Circuit Simulation Design Application, providing:
- Logic gate component specifications
- Validation rules for logic circuits
- Truth table generation for testing
- Gate-level simulation guidance
- Boolean expression evaluation

## Skill Loading

The skill uses progressive loading:
1. **Discovery**: Name and description always available for matching
2. **Main Content**: SKILL.md loads when topic is relevant
3. **References**: Boolean algebra and conversion guides load when specifically needed

## Contributing

When extending this skill:
- Keep SKILL.md focused on essential gate information
- Add detailed examples to reference documents
- Update truth tables if adding new gate types
- Maintain consistent Boolean notation
- Test all conversion examples

## Related Skills

This skill works well with:
- Circuit simulation skills
- Digital design skills
- Hardware description language skills
- Boolean algebra solvers
- Truth table generator tools

## Version

- **Created**: January 2026
- **License**: Apache 2.0
- **Status**: Production ready

## References

Primary knowledge sourced from:
- Digital electronics fundamentals
- Logic design principles
- Boolean algebra standards
- Universal gate theory
- Circuit design best practices
