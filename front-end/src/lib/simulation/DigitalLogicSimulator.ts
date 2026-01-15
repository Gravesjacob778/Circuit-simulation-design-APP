/**
 * DigitalLogicSimulator.ts - 數位邏輯模擬器
 * 實作數位邏輯閘（AND、OR、NOT、NAND、NOR、XOR、XNOR）的模擬
 * 
 * 數位邏輯閘模擬原理：
 * - 輸入/輸出以布林值表示（HIGH=true=1, LOW=false=0）
 * - 電壓模型：HIGH 對應 VCC（預設 5V），LOW 對應 GND（0V）
 * - 支援多輸入閘（2輸入及以上）
 */

import type { CircuitComponent } from '@/types/circuit';

/**
 * 邏輯電平定義
 */
export const LogicLevel = {
  LOW: 0,
  HIGH: 1,
  UNKNOWN: -1, // 未連接或無效狀態
} as const;

export type LogicLevel = typeof LogicLevel[keyof typeof LogicLevel];

/**
 * 邏輯閘類型
 */
export type LogicGateType = 
  | 'logic_and'
  | 'logic_or'
  | 'logic_not'
  | 'logic_nand'
  | 'logic_nor'
  | 'logic_xor'
  | 'logic_xnor';

/**
 * 數位邏輯模擬選項
 */
export interface DigitalLogicOptions {
  /** HIGH 電平電壓 (預設 5V) */
  vHigh: number;
  /** LOW 電平電壓 (預設 0V) */
  vLow: number;
  /** 電壓門檻 (高於此值視為 HIGH，預設 2.5V) */
  threshold: number;
  /** 傳播延遲 (奈秒，預設 0 表示立即) */
  propagationDelay: number;
}

/**
 * 預設數位邏輯選項 (TTL 邏輯準位)
 */
export const DEFAULT_DIGITAL_OPTIONS: DigitalLogicOptions = {
  vHigh: 5.0,      // 5V = HIGH
  vLow: 0.0,       // 0V = LOW
  threshold: 2.5,  // 2.5V 門檻
  propagationDelay: 0,
};

/**
 * 邏輯閘模擬結果
 */
export interface LogicGateState {
  componentId: string;
  gateType: LogicGateType;
  inputA: LogicLevel;
  inputB?: LogicLevel; // NOT 閘只有一個輸入
  output: LogicLevel;
  outputVoltage: number;
}

/**
 * 數位邏輯模擬結果
 */
export interface DigitalSimulationResult {
  /** 各邏輯閘狀態 */
  gateStates: Map<string, LogicGateState>;
  /** 各節點電壓 (邏輯閘輸出節點) */
  nodeVoltages: Map<string, number>;
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息 */
  error?: string;
}

/**
 * 數位邏輯模擬器類
 */
export class DigitalLogicSimulator {
  private options: DigitalLogicOptions;

  constructor(options: Partial<DigitalLogicOptions> = {}) {
    this.options = { ...DEFAULT_DIGITAL_OPTIONS, ...options };
  }

  /**
   * 判斷元件是否為邏輯閘
   */
  public static isLogicGate(type: string): boolean {
    return type.startsWith('logic_');
  }

  /**
   * 將電壓轉換為邏輯電平
   */
  public voltageToLogic(voltage: number | undefined): LogicLevel {
    if (voltage === undefined) return LogicLevel.UNKNOWN;
    if (voltage >= this.options.threshold) return LogicLevel.HIGH;
    return LogicLevel.LOW;
  }

  /**
   * 將邏輯電平轉換為電壓
   */
  public logicToVoltage(level: LogicLevel): number {
    switch (level) {
      case LogicLevel.HIGH:
        return this.options.vHigh;
      case LogicLevel.LOW:
        return this.options.vLow;
      default:
        return 0; // UNKNOWN 預設為 LOW
    }
  }

  /**
   * 將布林值轉換為邏輯電平
   */
  public boolToLogic(value: boolean | undefined): LogicLevel {
    if (value === undefined) return LogicLevel.UNKNOWN;
    return value ? LogicLevel.HIGH : LogicLevel.LOW;
  }

  /**
   * 評估 AND 閘輸出
   * 真值表：只有當 A 和 B 都為 HIGH 時，輸出才為 HIGH
   */
  public evaluateAND(a: LogicLevel, b: LogicLevel): LogicLevel {
    if (a === LogicLevel.UNKNOWN || b === LogicLevel.UNKNOWN) {
      return LogicLevel.UNKNOWN;
    }
    return (a === LogicLevel.HIGH && b === LogicLevel.HIGH) 
      ? LogicLevel.HIGH 
      : LogicLevel.LOW;
  }

  /**
   * 評估 OR 閘輸出
   * 真值表：只要 A 或 B 任一為 HIGH，輸出即為 HIGH
   */
  public evaluateOR(a: LogicLevel, b: LogicLevel): LogicLevel {
    if (a === LogicLevel.UNKNOWN || b === LogicLevel.UNKNOWN) {
      return LogicLevel.UNKNOWN;
    }
    return (a === LogicLevel.HIGH || b === LogicLevel.HIGH) 
      ? LogicLevel.HIGH 
      : LogicLevel.LOW;
  }

  /**
   * 評估 NOT 閘輸出
   * 真值表：反轉輸入
   */
  public evaluateNOT(a: LogicLevel): LogicLevel {
    if (a === LogicLevel.UNKNOWN) return LogicLevel.UNKNOWN;
    return a === LogicLevel.HIGH ? LogicLevel.LOW : LogicLevel.HIGH;
  }

  /**
   * 評估 NAND 閘輸出 (AND + NOT)
   */
  public evaluateNAND(a: LogicLevel, b: LogicLevel): LogicLevel {
    return this.evaluateNOT(this.evaluateAND(a, b));
  }

  /**
   * 評估 NOR 閘輸出 (OR + NOT)
   */
  public evaluateNOR(a: LogicLevel, b: LogicLevel): LogicLevel {
    return this.evaluateNOT(this.evaluateOR(a, b));
  }

  /**
   * 評估 XOR 閘輸出
   * 真值表：當輸入不同時輸出 HIGH
   */
  public evaluateXOR(a: LogicLevel, b: LogicLevel): LogicLevel {
    if (a === LogicLevel.UNKNOWN || b === LogicLevel.UNKNOWN) {
      return LogicLevel.UNKNOWN;
    }
    return a !== b ? LogicLevel.HIGH : LogicLevel.LOW;
  }

  /**
   * 評估 XNOR 閘輸出 (XOR + NOT)
   * 真值表：當輸入相同時輸出 HIGH
   */
  public evaluateXNOR(a: LogicLevel, b: LogicLevel): LogicLevel {
    return this.evaluateNOT(this.evaluateXOR(a, b));
  }

  /**
   * 根據閘類型評估輸出
   */
  public evaluateGate(
    gateType: string,
    inputA: LogicLevel,
    inputB?: LogicLevel
  ): LogicLevel {
    switch (gateType) {
      case 'logic_and':
        return this.evaluateAND(inputA, inputB ?? LogicLevel.UNKNOWN);
      case 'logic_or':
        return this.evaluateOR(inputA, inputB ?? LogicLevel.UNKNOWN);
      case 'logic_not':
        return this.evaluateNOT(inputA);
      case 'logic_nand':
        return this.evaluateNAND(inputA, inputB ?? LogicLevel.UNKNOWN);
      case 'logic_nor':
        return this.evaluateNOR(inputA, inputB ?? LogicLevel.UNKNOWN);
      case 'logic_xor':
        return this.evaluateXOR(inputA, inputB ?? LogicLevel.UNKNOWN);
      case 'logic_xnor':
        return this.evaluateXNOR(inputA, inputB ?? LogicLevel.UNKNOWN);
      default:
        return LogicLevel.UNKNOWN;
    }
  }

  /**
   * 模擬所有邏輯閘
   * @param components 電路元件列表
   * @param _nodeVoltages 類比模擬的節點電壓結果（可選，用於從電壓推導邏輯電平）
   */
  public simulate(
    components: CircuitComponent[],
    _nodeVoltages?: Map<string, number>
  ): DigitalSimulationResult {
    const gateStates = new Map<string, LogicGateState>();
    const outputVoltages = new Map<string, number>();

    // 找出所有邏輯閘
    const logicGates = components.filter(c => DigitalLogicSimulator.isLogicGate(c.type));

    if (logicGates.length === 0) {
      return {
        gateStates,
        nodeVoltages: outputVoltages,
        success: true,
      };
    }

    // 評估每個邏輯閘
    for (const gate of logicGates) {
      // 取得輸入電平（優先使用元件上設定的邏輯輸入值）
      let inputA: LogicLevel;
      let inputB: LogicLevel = LogicLevel.UNKNOWN;
      const isNotGate = gate.type === 'logic_not' as string;

      if (gate.logicInputA !== undefined) {
        // 使用設定的邏輯輸入值
        inputA = this.boolToLogic(gate.logicInputA);
      } else {
        // 如果沒有設定，預設為 LOW
        inputA = LogicLevel.LOW;
      }

      if (gate.logicInputB !== undefined) {
        inputB = this.boolToLogic(gate.logicInputB);
      } else if (!isNotGate) {
        // 雙輸入閘，如果沒有設定 B，預設為 LOW
        inputB = LogicLevel.LOW;
      }

      // 計算輸出
      const output = this.evaluateGate(gate.type, inputA, inputB);
      const outputVoltage = this.logicToVoltage(output);

      // 記錄狀態
      const state: LogicGateState = {
        componentId: gate.id,
        gateType: gate.type as LogicGateType,
        inputA,
        inputB: !isNotGate ? inputB : undefined,
        output,
        outputVoltage,
      };

      gateStates.set(gate.id, state);
      outputVoltages.set(gate.id, outputVoltage);
    }

    return {
      gateStates,
      nodeVoltages: outputVoltages,
      success: true,
    };
  }

  /**
   * 取得 AND 閘真值表 (用於文檔/顯示)
   */
  public static getANDTruthTable(): Array<{ a: number; b: number; y: number }> {
    return [
      { a: 0, b: 0, y: 0 },
      { a: 0, b: 1, y: 0 },
      { a: 1, b: 0, y: 0 },
      { a: 1, b: 1, y: 1 },
    ];
  }

  /**
   * 取得 OR 閘真值表 (用於文檔/顯示)
   */
  public static getORTruthTable(): Array<{ a: number; b: number; y: number }> {
    return [
      { a: 0, b: 0, y: 0 },
      { a: 0, b: 1, y: 1 },
      { a: 1, b: 0, y: 1 },
      { a: 1, b: 1, y: 1 },
    ];
  }

  /**
   * 格式化邏輯電平為字串
   */
  public static formatLogicLevel(level: LogicLevel): string {
    switch (level) {
      case LogicLevel.HIGH: return 'HIGH (1)';
      case LogicLevel.LOW: return 'LOW (0)';
      default: return 'UNKNOWN (X)';
    }
  }
}

// 匯出單例實例供便捷使用
export const digitalLogicSimulator = new DigitalLogicSimulator();
