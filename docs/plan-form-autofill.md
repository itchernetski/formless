# План реализации — AI Form Autofill Extension

> Источник: `~/Cursor/new-ideas/ventures/form-autofill/form-autofill.md`
> Создан: 2026-06-27
> Обновлён: 2026-08-08 — закрыты «Доделки» (переключатель профиля в popup, встроенная help-страница) и Phase 4 (OSS release) в части, не требующей аккаунтов и живого браузера. Имя продукта: **Formless**. Runbook: `docs/oss-release.md`.
> Обновлён: 2026-06-28 — выполнены Phase 2 (локальный AI), Phase 3 (импорт CV/LinkedIn), Phase 3.5 (захват из форм); Phase 2.5 перенесён в Phase 4.5.
> Стратегия: Сценарий A с элементами B — универсальный экстеншен, маркетинг и первый use case на job applications.

---

## Модель монетизации (ключевое решение)

Не BYOK (пользователь не вводит свой API-ключ). Гибрид:

- **Free tier** — локальная модель в браузере (Chrome Built-in AI / Gemini Nano через Prompt API; fallback WebLLM). Заполнение форм + базовая AI-генерация. $0 на нас, всё на устройстве — главный privacy-аргумент и OSS-фича.
- **Paid tier ($5-8/мес)** — прокси-бэкенд на Claude Sonnet 4.6 под нашим ключом. Качественные cover letters / bio, синхронизация профиля между устройствами.

**Экономика paid (cover letter ≈ 3k input + 800 output токенов):**

| Модель | Цена за 1M (in/out) | 1 генерация | 50 ген/мес |
|---|---|---|---|
| Haiku 4.5 | $1 / $5 | ~$0.007 | ~$0.35 |
| **Sonnet 4.6 (дефолт)** | $3 / $15 | ~$0.02 | ~$1.0 |
| Opus 4.8 | $5 / $25 | ~$0.035 | ~$1.75 |

При подписке $5-8/мес и Sonnet — маржа 80%+ с запасом на abuse.

---

## Архитектура (целевая)

```
extension/                       # браузерный экстеншен
├── manifest.json                # Manifest V3
├── src/
│   ├── background/              # service worker: роутинг, вызовы AI (local/proxy)
│   ├── content/                 # content scripts: детект форм, заполнение, оверлей
│   ├── popup/                   # быстрый доступ: профиль, вкл/выкл, статус, тариф
│   ├── options/                 # настройки: профиль, аккаунт, whitelist сайтов
│   ├── vault/                   # local-first storage (IndexedDB + шифрование)
│   ├── ai/
│   │   ├── local/              # Chrome Built-in AI (Gemini Nano) / WebLLM — free tier
│   │   └── proxy/              # клиент к нашему бэкенду — paid tier
│   ├── detection/              # эвристики маппинга полей (label, name, autocomplete)
│   └── shared/                 # типы, утилиты, messaging
├── tests/
└── docs/

backend/                         # тонкий прокси (paid tier) — появляется в Phase 4.5
├── api/                         # /generate (auth → Claude), /me, /billing webhook
├── auth/                        # аккаунты, токены подписки
└── infra/                       # rate-limit, token caps, кэш
```

**Стек экстеншена:** TypeScript + Vite (`@crxjs/vite-plugin`) + React (popup/options) + Vitest + Playwright.
**Стек бэкенда:** TypeScript (Hono/Fastify) на Cloudflare Workers или Node + Anthropic SDK; Supabase (auth + Postgres) + Stripe.

**Принципы:** профиль и данные форм всегда local-first (IndexedDB, шифрование at-rest). На сервер уходит только контекст страницы + нужный кусок CV при генерации в paid tier. В free tier данные не покидают устройство вообще. MIT-лицензия с первого коммита.

---

## Phase 0 — Spike / Proof-of-Concept (1 день)

Цель: доказать feasibility до вложений в архитектуру.

- [x] Минимальный content script, детектит `<form>` и `<input>` на странице — `extension/content.js` + `autofill-core.js` (2026-06-27)
- [x] Заполнение полей из захардкоженного JS-профиля (имя, email, телефон, адрес) — `autofill-core.js` PROFILE, заполнено 11/11 на стенде (2026-06-27)
- [~] Проверка на 2 реальных кейсах: LinkedIn Easy Apply + Amazon checkout — отложено на ручной прогон (нужна авторизованная сессия); тех. риски обоих покрыты стендом. См. `docs/phase0-findings.md`
- [x] Зафиксировать, где ломается (SPA, React controlled inputs, shadow DOM) — `docs/phase0-findings.md` раздел «Где ломается» (2026-06-27)
- [x] Вывод: go/no-go по техническому подходу к заполнению controlled inputs (native setter + dispatch `input`/`change`) — **GO**, автотест `tests/verify.mjs` 8/8 PASS (2026-06-27; спайк и харнесс удалены перед OSS-релизом, покрытие перенесено в `extension/tests/fill.test.ts`)

---

## Phase 1 — MVP: локальный профиль + автозаполнение (2-3 недели)

Цель: рабочий экстеншен, заполняющий стандартные поля из локального профиля.

**Инфраструктура**
- [x] Скаффолд: Vite + `@crxjs/vite-plugin` + TS + React, Manifest V3 — `extension/` (Vite root), `vite build` → `dist/` OK (2026-06-27)
- [x] CI: lint + typecheck + test (GitHub Actions) — `.github/workflows/ci.yml` (lint→typecheck→test→build) (2026-06-27)
- [x] Структура папок по архитектуре выше — `extension/src/{vault,detection,content,background,popup,options,shared,ui}` (2026-06-27)

**Vault (local storage)**
- [x] Схема профиля: identity, contact, address, work, education, custom-поля — `src/vault/schema.ts` (2026-06-27)
- [x] IndexedDB-обёртка (idb) с CRUD — `src/vault/db.ts` + `src/vault/index.ts`, тесты в `tests/vault.test.ts` (2026-06-27)
- [x] Шифрование at-rest (WebCrypto AES-GCM, ключ из мастер-пароля/passkey) — `src/vault/crypto.ts` (PBKDF2 210k + AES-GCM), unlock/lock в `index.ts`, ключ в `chrome.storage.session` (`session.ts`) (2026-06-27)
- [x] Экспорт/импорт профиля (JSON) для бэкапа — `src/vault/io.ts`, round-trip тест PASS (2026-06-27)

**Детект и маппинг полей**
- [x] Эвристики: `autocomplete`, `name`, `id`, `placeholder`, связанный `<label>`, `aria-label` — `src/detection/signals.ts` + `fielddefs.ts` (2026-06-27)
- [x] Скоринг кандидатов → сопоставление с полями профиля — `src/detection/mapping.ts` (взвешенный скоринг, порог), 7 тестов PASS (2026-06-27)
- [x] Заполнение controlled inputs (React/Vue) через native value setter + событие — `src/detection/fill.ts` (порт Phase-0 техники) (2026-06-27)
- [x] Поддержка select, checkbox, radio, textarea, date — `fill.ts` (select по value/тексту/префиксу; checkbox/radio; date ISO) (2026-06-27)
- [x] Оверлей-подсветка заполненных полей + кнопка undo — `src/content/overlay.ts` (shadow-root toast) + `undoFill` в `detection/index.ts` (2026-06-27)

**UI**
- [x] Popup: вкл/выкл, текущий профиль, «заполнить форму», статус — `src/popup/Popup.tsx` (+ unlock, whitelist-gate) (2026-06-27)
- [x] Options: редактор профиля, whitelist сайтов, настройки — `src/options/{Options,ProfileEditor}.tsx` (+ encryption toggle, export/import, мульти-профили) (2026-06-27)
- [x] Onboarding: первый запуск → создать профиль — `src/options/Onboarding.tsx`, открывается на install (`background/index.ts`) (2026-06-27)

**Тесты**
- [x] Unit: детект/маппинг на фикстурах HTML — `tests/{mapping,fill,vault}.test.ts`, **19/19 PASS** (Vitest+jsdom, incl. shadow DOM, encryption, export/import) (2026-06-27)
- [x] E2E (Playwright): набор тестовых форм + 3-5 реальных сайтов — `tests/e2e-extension.mjs` (грузит реальный `dist/`, http-фикстура, fill из service-worker) написан и корректен; в headless-песочнице MV3-экстеншен не грузится → **graceful SKIP (exit 2)**. Гонять на десктопе с дисплеем. Реальные сайты — ручной прогон (требуют авторизации). См. `docs/phase1-mvp.md`.

**Выход фазы:** ставится локально, заполняет стандартные формы на whitelist топ-сайтов. — ✅ собирается (`dist/`), unit-логика покрыта; ручная установка: `chrome://extensions` → Load unpacked → `extension/dist`.

---

## Phase 2 — AI-генерация: локальная модель (free) (1-2 недели)

Цель: дифференциатор — генерация длинного контента под контекст страницы, без сервера.

- [x] AI-слой: единый интерфейс `AIProvider` (availability + generate, стриминг) — `src/ai/types.ts` + роутер `src/ai/index.ts` (выбор провайдера по предпочтению, fallback на downloadable) (2026-06-28)
- [x] Реализация `local/`: Chrome Built-in AI (Gemini Nano, Prompt API); feature-detect — `src/ai/local/gemini-nano.ts` (детект new `LanguageModel` + old `ai.languageModel`, нормализация стрима delta/snapshot) (2026-06-28)
- [x] Fallback `local/`: WebLLM — `src/ai/local/webllm.ts` как extension-point (модель не бандлим, WebGPU-детект + слот `globalThis.__autofillWebLLM`); опционально (2026-06-28)
- [x] Сбор контекста страницы: заголовок вакансии, описание, компания — `src/ai/context.ts` (JSON-LD JobPosting → OG/meta → H1/DOM), тесты `tests/ai-context.test.ts` (2026-06-28)
- [x] Промпты: cover letter, bio, why this company — `src/ai/prompts.ts` (system по type/tone/length + user из контекста и профиля, anti-hallucination), тесты `tests/prompts.test.ts` (2026-06-28)
- [x] Детект длинных текстовых полей (textarea, contenteditable) → классификация по типу — `src/detection/longfields.ts`, тесты `tests/longfields.test.ts` (2026-06-28)
- [x] UI ревью: показать сгенерированный текст, дать отредактировать до вставки — `src/content/gen-panel.ts` (shadow-DOM панель, стриминг в editable textarea, insert) + кнопка «✨ Generate with AI» в popup (2026-06-28)
- [x] Управление длиной/тоном (short/medium/long, formal/casual) — селекторы в gen-panel → промпт (2026-06-28)
- [x] Graceful degradation: модель недоступна → `NoProviderError` → подсказка про Pro/server в панели (2026-06-28)

**Выход фазы:** на странице вакансии экстеншен генерирует cover letter локально, $0 на нас. — ✅ собирается (`dist/`), unit-логика покрыта (37/37 тестов). Ручной прогон AI-панели — в Chrome с включённым Built-in AI (Gemini Nano), headless недоступен.

---

## Phase 3 — Импорт данных (2 недели)

Цель: убрать трение онбординга — профиль из CV/LinkedIn за минуты.

- [x] Загрузка CV (PDF) → парсинг текста (pdf.js) → AI-структурирование — `src/import/pdf.ts` (pdfjs-dist, lazy + bundled worker) + `src/import/cv.ts` (промпт → строгий JSON → `parseCvJson`, anti-hallucination), тесты `tests/cv.test.ts` (2026-06-28)
- [x] Импорт из LinkedIn — `src/import/linkedin.ts`: парсер data-export CSV (Profile/Positions/Email Addresses), свой RFC-4180 CSV-ридер. Выбран export, не scraper (надёжнее, без ToS-рисков). Тесты `tests/linkedin.test.ts` (2026-06-28)
- [x] Маппинг распарсенных данных в схему vault с ручной коррекцией — `src/import/merge.ts` (`diffProfile` new/update/same + `applyDiff`) + `src/options/ImportReview.tsx` (чекбоксы, редактируемые значения), тесты `tests/merge.test.ts`. Общий слой с Phase 3.5 (2026-06-28)
- [x] Поддержка нескольких профилей — реализовано в Phase 1 (`createProfile`/`setActiveProfile`); импорт идёт в активный профиль (2026-06-28)

**Выход фазы:** новый пользователь загружает CV → готовый профиль. — ✅ собирается (pdf.js в lazy-чанк options-страницы), unit-логика покрыта. Ручной прогон парсинга PDF + AI-структурирования — в Chrome (нужна Built-in AI).

---

## Phase 3.5 — Захват данных из форм («запомнить заполненное») (1 неделя)

Цель: обратный поток данных — учиться у пользователя. Во время заполнения формы он дозаполняет/правит поля вручную; кнопка в экстеншене парсит эти поля и добавляет их в профиль. Снижает трение онбординга наравне с импортом CV, но работает на любых сайтах и без файлов.

- [x] Трекинг происхождения значений (provenance) — `autofilledValues: Map<Element,string>` в `src/content/index.ts`, наполняется при FILL; захват пропускает неизменённые autofilled-поля, но ловит отредактированные (2026-06-28)
- [x] Кнопка «＋ Save filled fields to profile» в popup — `AUTOFILL_CAPTURE` → stash в `chrome.storage.session` → открытие options `#capture` (2026-06-28)
- [x] Скан текущей формы: собрать заполненные, отфильтровать autofilled и пустые — `src/detection/capture.ts` `captureForm` (2026-06-28)
- [x] Реверс-маппинг через `detection/mapping.ts` — `captureForm` зовёт `mapField` (та же эвристика, обратное направление) (2026-06-28)
- [x] Дедупликация и diff — переиспользован `src/import/merge.ts` `diffProfile` (new/update/same) + dedup по path в `captureForm` (2026-06-28)
- [x] UI ревью перед записью — `ImportReview.tsx` (общий с Phase 3) через flow `#capture`; чекбоксы, правка, маппинг unmapped → `custom.<slug>` (2026-06-28)
- [x] Запись в vault (шифрование) + undo последнего захвата — `applyReview` → `saveProfile` (шифрует если включено) + `undoLastApply` (snapshot профиля, баннер Undo) (2026-06-28)
- [x] Приватность: blocklist чувствительных полей — `src/detection/sensitive.ts` (password/cc-*/cvv/otp/pin/ssn/card по type+autocomplete+токенам), тесты `tests/sensitive.test.ts` (2026-06-28)
- [x] Тесты: provenance, реверс-маппинг, фильтр чувствительных, diff/merge — `tests/capture.test.ts` (8) + `tests/sensitive.test.ts` (4) + `tests/merge.test.ts` (5) (2026-06-28)

**Выход фазы:** пользователь заполняет форму руками один раз → жмёт кнопку → профиль пополняется; в следующий раз автозаполнение покрывает эти поля. — ✅ собирается, unit-логика покрыта (66/66 тестов). Ручной прогон popup→options flow — в Chrome.

---

## Доделки (перед Phase 4)

Мелкие задачи, которые надо закрыть до OSS-релиза.

- [x] Выбор профиля прямо в popup экстеншена: дропдаун/переключатель активного профиля (мульти-профили из Phase 1/3 уже в vault) с быстрым переключением без захода в Options — `src/popup/Popup.tsx` (`switchProfile` → `setActiveProfile`; дропдаун при 2+ профилях, иначе pill), тесты `tests/vault.test.ts` «multi-profile switching» (2) (2026-08-08)
- [x] Кнопка Help в экстеншене → встроенная офлайн-страница справки — `extension/help.html` + `src/help/{Help,main}.tsx` (4 секции, 13 вопросов, ссылки на GitHub issues/discussions), `src/shared/help.ts` (`helpUrl`/`openHelp`); входы: popup footer, заголовок Options, onboarding «How it works»; в манифесте `web_accessible_resources` + отдельный rollup-input (2026-08-08)

---

## Phase 4 — OSS release (1 неделя)

Цель: публичный запуск, доверие, distribution.

> Runbook исполнения и разделение «сделано / блокировано на тебе»: `docs/oss-release.md`.
> Публичные ссылки намеренно стоят как `itchernetski/formless` — заменить одной sed-командой (шаг 1 runbook), потом **пересобрать** (плейсхолдер попадает в бандл help-страницы).

- [x] README (positioning: privacy-first, local, AI generation), скриншоты, GIF-демо — `README.md` (позиционирование, фичи, приватность, permissions-таблица, архитектура, roadmap); скриншоты генерируются `scripts/screenshots.mjs` → `docs/assets/{popup,popup-single-profile,options,help}.png` (headless Chromium + chrome-стаб + сид IndexedDB). **GIF-демо и оверлей/AI-панель — ручной захват** (нужен живой extension host), чеклист в `docs/store-listing.md` (2026-08-08)
- [x] LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, issue/PR templates — `LICENSE`, `CONTRIBUTING.md` (ground rules: zero-network, no auto-submit/CAPTCHA; гайд по detection-слою), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (scope/threat model), `PRIVACY.md`, `CHANGELOG.md`; `.github/ISSUE_TEMPLATE/{site-not-working,bug-report,feature-request}.yml` + `config.yml`, `.github/PULL_REQUEST_TEMPLATE.md`; `.github/workflows/release.yml` (tag → zip'ы в GitHub Release) (2026-08-08)
- [x] Брендинг: имя продукта, лого, иконки (открытый вопрос #1 из ресерча) — **Formless** (решено 2026-08-08); `brand/icon.svg` + `brand/logo.svg`, PNG 16/32/48/128 → `extension/public/icons/`, подключены в манифест (`icons` + `action.default_icon`); ребренд UI: манифест, popup/options/help titles, заголовки Popup/Options/Onboarding (2026-08-08)
- [~] Сборка и публикация в Chrome Web Store (privacy policy обязательна) — **сборка готова**: `npm run package` → `release/formless-0.1.0-chrome.zip`; листинг, short/detailed description, permission justifications, data-disclosure ответы, single-purpose statement — `docs/store-listing.md`; пошаговая процедура публикации (аккаунт → поля дашборда → privacy-таб → rejection playbook → апдейты) — `docs/chrome-web-store.md`; privacy policy — `PRIVACY.md` + хостируемая `landing/privacy.html`. **Публикация блокирована**: нужен dev-аккаунт ($5), публичный URL политики, 4 скриншота 1280×800, ручной прогон в Chrome. Перед первой подачей проверить снятие permission `tabs` (§0.1)
- [x] Firefox + Edge сборки как fallback — `scripts/package.mjs` (3 таргета; для Gecko: `background.scripts` вместо `service_worker`, `browser_specific_settings.gecko`, чистка `use_dynamic_url`). Edge = байт-в-байт Chromium-сборка. **Firefox-манифест сгенерирован, но в Firefox не проверялся** — предупреждение печатает сам скрипт (2026-08-08)
- [x] Landing page (фичи, приватность, ссылка на стор и GitHub) — `landing/index.html` (hero, zero-requests proof-блок, 6 фич, приватность, «что не делаем», install, FAQ) + `landing/privacy.html` как публичный URL политики для стора; ассеты в `landing/assets/`; отрендерено в Chromium (desktop + mobile, без ошибок и битых запросов) (2026-08-08)
- [x] Product Hunt launch kit — `docs/launch/product-hunt.md`: tagline-варианты, maker-комментарий, план галереи, почасовой сценарий дня, заготовленные ответы (vs password managers, vs job-бots, Gemini Nano quality, почему не BYOK), метрики (2026-08-08)
- [ ] Alpha-прогон в Telegram/среди знакомых, сбор фидбека — блокировано: сначала ручной прогон в Chrome (шаг 3 runbook) и публикация репо

**Выход фазы:** установка из стора, репозиторий публичен, PH-лонч готов. — ⏳ репозиторий подготовлен (`git init -b main`, без коммита), все артефакты в репо; остались действия, требующие аккаунтов и живого браузера — см. `docs/oss-release.md` § «What's done vs. what's blocked».

---

## Phase 4.5 — Прокси-бэкенд + подписка (paid AI) (2-3 недели)

> Перенесён из Phase 2.5 (2026-06-28): монетизацию запускаем после OSS-релиза и валидации спроса.

Цель: качественная генерация на Claude под нашим ключом, монетизация по подписке.

**Бэкенд**
- [ ] Скаффолд: Hono/Fastify на Cloudflare Workers (или Node), Anthropic SDK
- [ ] `POST /generate`: auth → сборка промпта → Claude Sonnet 4.6 → ответ (стриминг)
- [ ] Auth: Supabase (email/passkey), JWT в экстеншене
- [ ] Биллинг: Stripe Checkout + webhook, статус подписки на `/me`
- [ ] Abuse-контроль: rate-limit на юзера, дневные token caps, `max_tokens`
- [ ] Кэш одинаковых запросов; лог стоимости на юзера для контроля маржи

**Экстеншен**
- [ ] Реализация `proxy/` провайдера: вызов `/generate` с JWT
- [ ] Роутинг в `ai/`: free → local, paid → proxy (выбор по статусу подписки)
- [ ] Аккаунт-флоу в Options/Popup: вход, статус тарифа, upgrade-кнопка
- [ ] Приватность: на сервер уходит только page-context + нужный кусок CV, не весь профиль

**Выход фазы:** платный пользователь генерирует cover letters на Sonnet 4.6; первый MRR.

---

## Phase 5 — Cloud sync + team-план (расширение paid) (2-3 недели)

Цель: добавить синхронизацию к уже существующей подписке (бэкенд готов с Phase 4.5).

- [ ] Sync профиля через Supabase: end-to-end шифрование (сервер хранит шифротекст)
- [ ] Sync-протокол: разрешение конфликтов, версионирование профиля
- [ ] Включить sync в paid tier (та же подписка, что и AI-генерация)
- [ ] Team-план (HR/рекрутёры) $15-20/user/mo — отдельный milestone
- [ ] Аналитика конверсии free→paid (privacy-respecting)

**Выход фазы:** синхронизация между устройствами как часть подписки; team-план.

---

## Открытые вопросы (решить по ходу)

1. ~~Имя продукта и бренд — нужен до Phase 4.~~ **Решено (2026-08-08): Formless.** Иконка/лого — `brand/`, ребренд прошёл по манифесту и UI. Домен под лендинг ещё не занят.
2. Качество локальной модели (Gemini Nano) для cover letters — проверить на Phase 2; если слабо, сделать free tier только «черновик», полную генерацию увести в paid.
3. Платная модель: Sonnet 4.6 дефолт; Haiku 4.5 как «эконом»-режим при росте объёмов.
4. CAPTCHA / bot-detection на Workday и подобных — заполнять, но не сабмитить автоматически; не обходить защиту.
5. PDF-формы (визы, гос) — отложить в Phase 3+, не в MVP.
6. Лимиты free tier по генерациям, чтобы стимулировать upgrade (например N локальных/день — или безлимит локально, paid = качество).

## Ключевые риски (из ресерча)

- Google встроит AI в нативный autofill → moat: OSS + local privacy + генерация под CV.
- Form detection ломается на сложных SPA → итеративный whitelist топ-сайтов (LinkedIn, Workday, Greenhouse, Lever, Amazon).

---

## Как исполнять

Фазы запускаются по команде «execute phase N». Критический путь: Phase 0 → Phase 1 → Phase 2 (локальный AI, $0) → Phase 3 (импорт) → Phase 3.5 (захват) → Phase 4 (OSS). Phase 4.5 (прокси + подписка) запускать после OSS-релиза и валидации спроса. Phase 5 (sync) — расширение готового бэкенда.
