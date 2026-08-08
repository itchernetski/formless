# Phase 0 — Spike findings (go/no-go)

> Дата: 2026-06-27 · Статус: **GO ✅**

## Что построено

- `extension/` — минимальный MV3-экстеншен (`manifest.json`, `autofill-core.js`, `content.js`, popup).
- `extension/autofill-core.js` — детект форм/полей + заполнение. Тот же файл грузится экстеншеном и тестом.
- `tests/test-form.html` — стенд с тремя сложными кейсами.
- `tests/verify.mjs` — автотест на системном Chrome (Playwright, `channel: "chrome"`, без скачивания chromium).

Запуск: `node tests/verify.mjs` → **8/8 PASS**, заполнено 11/11 полей.

## Ключевой технический вывод

**Native value setter + dispatch `input`/`change` — работает.** Подтверждено на:

| Кейс | Результат |
|---|---|
| Обычные `<input>` | ✅ |
| `<select>` (матч по value и по тексту опции) | ✅ (label «Spain» → value `ES`) |
| `<textarea>` | ✅ |
| **React controlled input** (`_valueTracker`) | ✅ — обновляется и DOM, и React-state |
| **Shadow DOM** (open) | ✅ — рекурсивный обход `shadowRoot` |
| Наивный `el.value = x` на controlled | ❌ ожидаемо — React-state остаётся пустым |

Последняя строка — главное доказательство: наивный путь ломает controlled inputs, а `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set` (прототипный сеттер) обходит React-патч инстанса и заставляет onChange сработать.

## Где ломается / границы (зафиксировано)

- **Closed shadow DOM** — `shadowRoot` недоступен из content script. Редко, но встречается в дизайн-системах. Митигейт: пытаться `attachShadow`-перехват в Phase 1 или fallback на ручной режим.
- **Cross-origin iframes** — нужен `all_frames: true` (уже стоит) + контент-скрипт инжектится в каждый фрейм; но координация между фреймами в Phase 0 не делалась.
- **SPA / поздняя отрисовка** — поля появляются после взаимодействия. Сейчас `fill()` сканирует по запросу (клик в popup), что снимает гонку. Для авто-режима в Phase 1 нужен `MutationObserver`.
- **Эвристика маппинга примитивна** — словарь токенов с границами слов. Хватает для стандартных полей; кастомные/локализованные лейблы и multi-step формы (Workday) потребуют скоринга и AI-маппинга (Phase 1/2).
- **Password / hidden / submit** исключены намеренно.

## Реальные кейсы (LinkedIn Easy Apply, Amazon checkout)

Не прогонялись автоматически: оба требуют авторизованной сессии под аккаунтом — гонять их headless некорректно и небезопасно. **Технические риски этих сайтов уже покрыты стендом:** LinkedIn = React controlled inputs (✅), Amazon = обычные поля + динамика (✅ + нужен MutationObserver в Phase 1).

Для ручной проверки: `chrome://extensions` → Developer mode → Load unpacked → `extension/` → открыть LinkedIn Easy Apply / Amazon checkout → popup → «Fill this form».

## Вердикт

**GO.** Подход к заполнению controlled inputs валиден. Можно переходить к Phase 1 (Vite + TS + React скаффолд, vault, скоринг маппинга, MutationObserver, оверлей+undo).
