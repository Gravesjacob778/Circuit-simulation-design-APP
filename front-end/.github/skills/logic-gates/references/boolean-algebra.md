# Boolean Algebra Reference

Reference guide for Boolean algebra operations used with logic gates.

## Basic Postulates

### Identity Laws
```
A + 0 = A
A • 1 = A
```

### Null Laws
```
A + 1 = 1
A • 0 = 0
```

### Idempotent Laws
```
A + A = A
A • A = A
```

### Complement Laws
```
A + A' = 1
A • A' = 0
```

### Involution Law
```
(A')' = A
```

## Fundamental Theorems

### Commutative Laws
```
A + B = B + A
A • B = B • A
```

### Associative Laws
```
A + (B + C) = (A + B) + C
A • (B • C) = (A • B) • C
```

### Distributive Laws
```
A • (B + C) = (A • B) + (A • C)
A + (B • C) = (A + B) • (A + C)
```

### Absorption Laws
```
A + (A • B) = A
A • (A + B) = A
```

### DeMorgan's Theorems

**First Theorem** (NOR equivalent):
```
(A + B)' = A' • B'
```
The complement of an OR is the AND of the complements.

**Second Theorem** (NAND equivalent):
```
(A • B)' = A' + B'
```
The complement of an AND is the OR of the complements.

### Extended DeMorgan's for Multiple Variables
```
(A + B + C)' = A' • B' • C'
(A • B • C)' = A' + B' + C'
```

## XOR Theorems

### Basic XOR Properties
```
A ⊕ 0 = A
A ⊕ 1 = A'
A ⊕ A = 0
A ⊕ A' = 1
```

### Commutative and Associative
```
A ⊕ B = B ⊕ A
A ⊕ (B ⊕ C) = (A ⊕ B) ⊕ C
```

### XOR with AND/OR
```
A ⊕ B = A'B + AB'
A ⊕ B = (A + B)(A' + B')
```

### XOR Complement
```
(A ⊕ B)' = A ⊕ B' = A' ⊕ B = AB + A'B'
```

## XNOR Theorems

### Basic XNOR Properties
```
A ⊙ B = (A ⊕ B)'
A ⊙ B = AB + A'B'
A ⊙ 0 = A'
A ⊙ 1 = A
```

## Simplification Techniques

### Consensus Theorem
```
AB + A'C + BC = AB + A'C
(A + B)(A' + C)(B + C) = (A + B)(A' + C)
```

### Variable Elimination
```
AB + AB' = A
(A + B)(A + B') = A
```

### Adjacency Combining
```
ABC + ABC' = AB
(A + B + C)(A + B + C') = A + B
```

## Useful Identities

### AND Patterns
```
A • 0 = 0 (forcing to 0)
A • 1 = A (passing through)
A • A = A (idempotent)
A • A' = 0 (contradiction)
```

### OR Patterns
```
A + 0 = A (passing through)
A + 1 = 1 (forcing to 1)
A + A = A (idempotent)
A + A' = 1 (tautology)
```

### NOT Patterns
```
A'' = A (double negation)
0' = 1
1' = 0
```

## Universal Gate Conversions

### Implementing Basic Gates with NAND

**NOT from NAND**:
```
A' = (A • A)' = A NAND A
```

**AND from NAND**:
```
AB = ((A • B)')' = (A NAND B) NAND (A NAND B)
```

**OR from NAND**:
```
A + B = ((A')' + (B')')' = (A NAND A) NAND (B NAND B)
```

### Implementing Basic Gates with NOR

**NOT from NOR**:
```
A' = (A + A)' = A NOR A
```

**OR from NOR**:
```
A + B = ((A + B)')' = (A NOR B) NOR (A NOR B)
```

**AND from NOR**:
```
A • B = ((A')' • (B')')' = (A NOR A) NOR (B NOR B)
```

## Sum of Products (SOP) Form

Standard form where OR connects product terms:
```
F = AB + A'C + BC'
```

**Canonical SOP** (minterms):
```
F = A'B'C + A'BC + ABC
F = Σ(1,3,7)
```

## Product of Sums (POS) Form

Standard form where AND connects sum terms:
```
F = (A + B)(A' + C)(B + C')
```

**Canonical POS** (maxterms):
```
F = (A + B + C)(A + B' + C)(A' + B + C')
F = Π(0,2,4)
```

## Karnaugh Map Simplification Rules

### 2-Variable K-Map
```
    B  B'
A  [  ][  ]
A' [  ][  ]
```

### 3-Variable K-Map
```
      BC BC' B'C' B'C
A   [  ][  ][  ][  ]
A'  [  ][  ][  ][  ]
```

### 4-Variable K-Map
```
      CD CD' C'D' C'D
AB  [  ][  ][  ][  ]
AB' [  ][  ][  ][  ]
A'B'[  ][  ][  ][  ]
A'B [  ][  ][  ][  ]
```

### Grouping Rules
- Group 1s in powers of 2 (1, 2, 4, 8, 16...)
- Larger groups = simpler terms
- Groups can overlap
- Groups can wrap around edges
- Each 1 must be in at least one group

## Minimization Techniques

### Algebraic Manipulation
1. Apply DeMorgan's theorems to eliminate complements
2. Use distributive law to factor common terms
3. Apply absorption laws to eliminate redundant terms
4. Use consensus theorem to remove implied terms

### Example Simplification
```
Original: F = A'B'C + A'BC + AB'C + ABC

Step 1 - Factor BC:
F = BC(A' + A) + A'B'C

Step 2 - Apply A' + A = 1:
F = BC + A'B'C

Step 3 - Factor C:
F = C(B + A'B')

Step 4 - Apply B + A'B' = B + A':
F = C(B + A')

Final: F = BC + A'C
```

## Common Simplification Patterns

### Pattern 1: Adjacent Minterms
```
A'B'C + A'BC = A'C
```

### Pattern 2: Symmetric Differences
```
AB + A'B' = (A ⊕ B)'
AB' + A'B = A ⊕ B
```

### Pattern 3: Full Coverage
```
ABC + ABC' + AB'C + AB'C' = A
```

### Pattern 4: Three Terms to Two
```
AB + BC + A'C = AB + A'C
```

## Operator Precedence

When evaluating Boolean expressions without parentheses:
1. **NOT** (') - highest precedence
2. **AND** (•) - middle precedence  
3. **OR** (+) - lowest precedence
4. **XOR** (⊕) - same as OR

Example: `A • B + C'` means `(A • B) + (C')`, not `A • (B + C')`

## Tips for Working with Boolean Algebra

1. Always work step-by-step, showing each transformation
2. Identify which theorem/law you're applying at each step
3. Check your work by creating truth tables
4. Look for common patterns (factoring, absorption, etc.)
5. Use K-maps for visual simplification when algebraic methods are complex
6. Verify final result has fewer terms/literals than original
7. Consider both SOP and POS forms - one may simplify better
