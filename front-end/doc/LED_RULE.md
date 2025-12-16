In addition to Circuit Design Rule Specification v1,
apply the following normative extension:

📘 Circuit Design Rule Specification v1.1（LED 擴充）
Section 8.1 – LED Behavioral & Visibility Rules
Rule LED-001：LED 未達可見發光條件

Severity：INFO
（教學模式可升級為 WARNING）

Rule Intent（規則目的）

區分「電氣上已導通」與「視覺上可見發光」，避免使用者誤解 LED 行為。

Formal Conditions（正式判定條件）

當同時滿足以下條件時，觸發本規則：

LED 處於導通狀態

V_LED >= V_f


LED 電流低於可見發光門檻

I_LED < I_emit_min

Default Parameters（可配置）
{
  "V_f_default": {
    "Red": 1.8,
    "Green": 2.1,
    "Blue": 3.0,
    "White": 3.0
  },
  "I_emit_min": 0.001
}


單位：

電壓：Volt

電流：Ampere

Explanation（說明）

LED 已進入導通區域，但電流不足以產生人眼可辨識的亮度

屬於「物理正確，但視覺上不明顯」的狀態

不代表電路錯誤

UI Behavior Recommendation（非規範性建議）

LED icon 顯示為：

關閉

或極低亮度（dim）

Tooltip 顯示：

LED current below visible emission threshold

Non-goals（刻意不處理）

不模擬精確亮度（cd/m²）

不依溫度、老化調整 Vf

不取代 datasheet 精密模型

This rule is normative and must not be reinterpreted.