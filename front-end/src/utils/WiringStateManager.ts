/**
 * WiringStateManager.ts
 * 
 * 統一管理接線互動狀態，避免分散的模組級變數
 */

export interface PortInfo {
  componentId: string;
  portId: string;
  x: number;
  y: number;
}

/**
 * 接線狀態管理器
 * 
 * 職責：
 * - 管理接線模式的開始和結束狀態
 * - 提供起始端點查詢
 * - 驗證端點連接有效性
 */
export class WiringStateManager {
  private isWiring = false;
  private wiringStartPort: PortInfo | null = null;

  /**
   * 檢查是否處於接線模式
   */
  isInWiringMode(): boolean {
    return this.isWiring;
  }

  /**
   * 獲取接線起始端點
   */
  getStartPort(): PortInfo | null {
    return this.wiringStartPort;
  }

  /**
   * 開始接線
   * @param portInfo 起始端點信息
   */
  startWiring(portInfo: PortInfo): void {
    this.isWiring = true;
    this.wiringStartPort = portInfo;
  }

  /**
   * 結束接線（成功連接）
   */
  endWiring(): void {
    this.isWiring = false;
    this.wiringStartPort = null;
  }

  /**
   * 取消接線
   */
  cancelWiring(): void {
    this.isWiring = false;
    this.wiringStartPort = null;
  }

  /**
   * 檢查是否是同一個端點
   * （接線時不能連接到同一端點）
   */
  isSamePort(componentId: string, portId: string): boolean {
    if (!this.wiringStartPort) return false;
    return (
      this.wiringStartPort.componentId === componentId &&
      this.wiringStartPort.portId === portId
    );
  }
}
