# Circuit Design Rule Specification（CDRS）v1

> 本文件定義 AI 輔助電路設計 App 的**線路準則（Circuit Rules）**，用於在模擬與輸出前，驗證電路是否符合基本物理、工程與可實作性原則。本文件屬於**高規格設計文件（High-Level + Executable Spec）**，可直接作為 LLM 修改專案程式碼、實作 Rule Engine、或生成測試案例的依據。

---

## 1. 文件目的（Purpose）

本規範的目標是：

1. 在電路模擬前即偵測「物理上不合理」或「工程上高風險」的設計
2. 提供一致、可機器判斷的規則定義（非純文字教學）
3. 作為 AI / LLM 的**權威規則來源（Source of Truth）**
4. 區分「必須阻止模擬」與「可提示但允許模擬」的情境

---

## 2. 適用範圍（Scope）

本規範適用於：
- Schematic-level 電路設計（非 PCB Layout）
- DC / AC / Transient 模擬前檢查
- 初學者到中階工程師使用情境

不包含：
- 製程規範（DFM）
- 高速訊號完整性（SI）與 EMC 細節
- PCB 幾何設計規則（另立文件）

---

## 3. 名詞定義（Terminology）

| 名稱 | 定義 |
|---|---|
| Node | 電氣節點，具有相同電位的連接點 |
| Ground (GND) | 參考節點，node id 固定為 `0` |
| Ideal Source | 無內阻、可輸出無限電流的理想源 |
| Series Element | 與負載串聯、可限制電流或能量的元件 |
| Floating Node | 未與參考地或閉合回路連接的節點 |
| Non-linear Device | I–V 非線性的元件（LED、Diode、BJT） |

---

## 4. 規則分級系統（Rule Severity Model）

| 等級 | 代碼 | 定義 | 系統行為 |
|---|---|---|---|
| Error | ERROR | 違反物理定律或必然失效 | 阻止模擬 |
| Warning | WARNING | 高風險或非理想設計 | 允許模擬，顯示警告 |
| Info | INFO | 教學或最佳化建議 | 僅提示 |

---

## 5. 電源與參考節點規則（Power & Reference Rules）

### Rule PWR-001：缺少接地參考
- **Severity**：ERROR
- **條件**：
  - Circuit 中不存在 nodeId = `0`
- **說明**：
  - 無參考地將導致節點電位無定義
- **建議修正**：
  - 新增 Ground 元件並連接至電路

---

### Rule PWR-002：理想電壓源短路（含等效 0Ω 路徑）
- **Severity**：ERROR
- **條件（Formal）**：
  - 在電壓源正負端之間，存在一條僅由 **wire** 或 **等效電阻 ≤ 10mΩ** 的元件所構成的連通路徑
- **等效 0Ω 定義（Normative）**：
  - 明確標示為 R = 0Ω 的元件
  - 或 solver/模型層宣告 `effectiveResistance <= 10mΩ`
  - Switch（閉合狀態）、Ammeter、Ideal Wire 若在 solver 中以小電阻實作，**一律視為 0Ω 元件**
- **不納入**：
  - 電感（即使 DC 下阻抗趨近 0，仍不視為 0Ω 元件）
- **說明**：
  - 理想電壓源經由等效 0Ω 路徑短路，將導致無界電流
- **建議修正**：
  - 插入明確的限流/限阻元件（例如 resistor ≥ 1Ω）

---


## 6. 電流控制與能量限制規則（Current & Energy Control）

### Rule CUR-001：LED 缺少可計算之電流限制
- **Severity**：ERROR
- **條件（Formal）**：
  - 在 LED 的任一端子至其回路中的理想電壓源之間，**不存在可計算的電阻性限流元件**
- **可計算限流定義（Normative）**：
  - 至少存在一個滿足 `R >= R_min` 的電阻性元件
  - 預設 `R_min = 10Ω`（可由系統參數覆寫）
- **拓樸要求**：
  - 該電阻需位於 LED 與電壓源之間的 **所有簡單路徑（all simple paths）** 上
  - 僅存在於回路其他支路（parallel branch）的電阻 **不算限流**
- **不合格示例**：
  - 電阻與 LED 並聯
  - 電阻僅存在於回路另一支路
- **說明**：
  - LED 為電流驅動元件，需保證所有可能電流路徑皆受限
- **建議修正**：
  - 在 LED 任一端串聯 resistor（典型 220Ω–1kΩ）

---


### Rule CUR-002：非線性元件直接接理想源
- **Severity**：WARNING
- **條件**：
  - Diode / LED / BJT 直接接於理想電壓源，且無明顯限流元件
- **說明**：
  - 可能導致浪湧電流或模擬不穩定

---

## 7. 儲能元件瞬態風險規則（Reactive Component Rules）

### Rule REA-001：電容直接接理想電壓源
- **Severity**：WARNING
- **條件**：
  - Capacitor 與理想電壓源直接形成回路，無串聯阻抗
- **說明**：
  - 啟動瞬間可能產生高浪湧電流

---

### Rule REA-002：電感直接接理想電壓源
- **Severity**：WARNING
- **條件**：
  - Inductor 與理想電壓源直接形成回路，無串聯阻抗
- **說明**：
  - 可能產生極高 di/dt

---

## 8. 拓樸完整性規則（Topology Integrity）

### Rule TOP-001：浮接節點
- **Severity**：WARNING
- **條件**：
  - 非 GND 節點僅連接至單一元件或未形成閉合回路
- **說明**：
  - 模擬結果可能不穩定或無意義

---

### Rule TOP-002：未閉合回路（含儲能元件判定）
- **Severity**：ERROR
- **條件（Formal）**：
  - 電壓或電流源存在，但在拓樸圖中 **不存在由 source 正端到負端的連通回路**
- **儲能元件判定（Normative）**：
  - Capacitor / Inductor **可作為回路的一部分**，因此：
    - 不因其存在而否定回路成立
    - 但若回路僅由 source + C / L + wire 組成，仍需同時觸發：
      - TOP-002：不觸發（回路成立）
      - REA-001 / REA-002：觸發 WARNING（浪湧風險）
- **說明**：
  - 本規則僅關注拓樸閉合性，不評估瞬態安全
- **建議修正**：
  - 檢查是否存在斷線、浮接端子或缺失回路

---


## 9. 規則輸出格式（Machine-Readable Contract）

```json
{
  "ruleId": "CUR-001",
  "severity": "ERROR",
  "componentIds": ["LED1"],
  "message": "LED has no current limiting element.",
  "recommendation": "Add a series resistor between LED and voltage source."
}
```

---

## 10. 與 LLM 的互動規範（LLM Integration Contract）

LLM **不得推翻或忽略**本文件中的 ERROR / WARNING 定義。

LLM 僅可：
- 解釋原因（Why）
- 提供修改方式（How）
- 教學補充（Conceptual explanation）

LLM 不得：
- 建議忽略 ERROR 級規則
- 修改規則判定邏輯

---

## 11. 版本與擴充

- 本文件為 v1（Schematic Level）
- v2 將擴充：
  - OpAmp 偏壓檢查
  - BJT/MOSFET Bias Region 判斷
  - 與 SPICE Error 對齊規則

---

**本文件為 AI 電路設計系統的核心工程規範。**

