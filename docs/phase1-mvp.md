# Phase 1 — MVP findings & how-to

> Дата: 2026-06-27 · Статус: **DONE** (E2E полного экстеншена — ручной прогон на десктопе)

## Что построено

Полноценный MV3-экстеншен на **Vite + @crxjs/vite-plugin + TypeScript + React**, project root = `extension/`.

```
extension/
├── manifest.config.ts        # crxjs defineManifest (MV3)
├── vite.config.ts, vitest.config.ts, tsconfig.json, .eslintrc.cjs
├── popup.html, options.html  # entry-points
├── src/
│   ├── vault/                # local-first хранилище
│   │   ├── schema.ts         # Profile: identity/contact/address/work/education/custom
│   │   ├── db.ts             # idb-обёртка (stores: profiles, meta) + CRUD
│   │   ├── crypto.ts         # AES-GCM + PBKDF2-SHA256 (210k), encrypt/decrypt JSON
│   │   ├── session.ts        # unlocked key в chrome.storage.session (memory-only)
│   │   ├── index.ts          # публичный API: CRUD, lock/unlock, enableEncryption
│   │   └── io.ts             # export/import профилей (JSON, валидация)
│   ├── detection/
│   │   ├── fielddefs.ts      # словарь полей: autocomplete + токены
│   │   ├── signals.ts        # извлечение сигналов (label/aria/name/...) + word-boundary
│   │   ├── mapping.ts        # взвешенный скоринг → лучший profile-path
│   │   ├── fill.ts           # native value setter + select/checkbox/radio/date
│   │   └── index.ts          # autofill() / undoFill() / collectFields() (+ shadow DOM)
│   ├── content/index.ts      # content script: fill/undo/detect + overlay state
│   ├── content/overlay.ts    # подсветка + shadow-root toast с Undo
│   ├── background/index.ts   # service worker: onboarding на install
│   ├── popup/                # React popup
│   ├── options/              # React options + ProfileEditor + Onboarding
│   └── shared/messaging.ts   # типы сообщений + whitelist (hostAllowed)
└── tests/                    # Vitest (jsdom): mapping, fill, vault
```

Phase-0 спайк и его харнесс `tests/verify.mjs` удалены перед публикацией репозитория — техника native-setter теперь покрыта `extension/tests/fill.test.ts` и `tests/e2e-extension.mjs`.

## Архитектурные решения

- **Vault живёт в extension-origin (popup/options/background)** — они делят один IndexedDB. Content script **не** читает vault напрямую (в content script IndexedDB — это origin страницы, не расширения). Поток: popup берёт активный профиль из vault → шлёт его в content script сообщением `AUTOFILL_FILL` → content делает detect→map→fill в DOM.
- **Шифрование опциональное.** Без мастер-пароля профиль хранится как plaintext-запись. С паролем — `enableEncryption()` перешифровывает все профили в AES-GCM; разблокировка через `unlock()` кладёт сырой ключ в `chrome.storage.session` (очищается при закрытии браузера). Неверный пароль ловится через GCM-auth-fail.
- **Не перезаписываем заполненные пользователем поля** (кроме чекбоксов). Undo возвращает предыдущие значения и снимает подсветку.
- **Whitelist хостов**: пусто = везде; `*.greenhouse.io` матчит сабдомены. Popup гейтит кнопку Fill по whitelist.

## Проверки (CI-эквивалент)

```bash
cd extension
npm run lint        # eslint v8 — clean
npm run typecheck   # tsc --noEmit — clean
npm test            # vitest run — 19/19 PASS
npm run build       # tsc + vite build → dist/ — OK
```

Unit-покрытие: маппинг (autocomplete/name/label/placeholder/aria, word-boundary, first-vs-full name), fill (text/select/checkbox/события), autofill e2e на jsdom (7 полей, captcha не трогается, не перезаписывает, **shadow DOM**), undo, vault CRUD, шифрование round-trip через lock/unlock, export/import.

## E2E полного экстеншена

`node tests/e2e-extension.mjs` (из корня репо) — грузит реальный `extension/dist` в Chrome, поднимает http-сервер с `tests/e2e-forms.html`, инициирует fill из контекста service worker, проверяет значения полей.

- На **десктопе с дисплеем** прогоняет полный путь (12 проверок, включая `country → ES`).
- В этой **headless-песочнице** Chrome не грузит unpacked MV3-экстеншен (нет дисплея, `--headless=new` недоступен) → скрипт делает **graceful SKIP (exit 2)**, не фейлит.

Реальные сайты (LinkedIn / Greenhouse / Lever / Amazon) — ручной прогон, требуют авторизованной сессии. Технические риски покрыты Phase-0 (controlled inputs, shadow DOM) и unit-тестами.

## Ручная установка

`chrome://extensions` → Developer mode → **Load unpacked** → выбрать `extension/dist` (после `npm run build`). При первой установке откроется onboarding.

## Что дальше

Phase 2 — локальный AI (Chrome Built-in AI / Gemini Nano) для генерации cover letters. Точки расширения уже есть: `detection` детектит длинные textarea; `shared/messaging` — место для новых типов сообщений; provider-интерфейс добавится в `src/ai/`.
