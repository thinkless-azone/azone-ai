# Калькулятор «Бюджет пилота LLM» — интеграция в статью 15

## Куда вставить

Файл: `src/pages/blog/15-stoimost-vnedreniya-llm-on-premise.astro`

Место: **после закрывающего `</div>` блока «Реалистичные диапазоны бюджета»** (примерно строка 372–373 — сразу после абзаца, начинающегося с «Все цифры — ориентировочные коридоры…») **и перед** комментарием `<!-- ROI -->`.

То есть:

```astro
            <p class="mt-4">Все цифры&nbsp;— ориентировочные коридоры... </a>.</p>
          </div>
        </div>

        <!-- ВСТАВИТЬ КАЛЬКУЛЯТОР СЮДА -->

        <!-- ROI -->
        <div>
          ...
```

## Почему здесь

- К этому моменту читатель уже усвоил структуру бюджета (CAPEX / работы / OPEX) и видел эталонные диапазоны в таблице. Калькулятор работает как «примерь на себя».
- Дальше идёт ROI-блок — он логически опирается на персонализированную цифру из калькулятора.
- Финальный CTA-блок в конце статьи остаётся отдельной точкой захвата для тех, кто долистал без калькулятора.

## Как считается результат

Каждый из четырёх параметров (пользователи, модель, ИБ, интеграции) вносит независимый вклад в три статьи бюджета: CAPEX, проектные работы, OPEX за год. Итоговый диапазон — сумма минимумов и сумма максимумов по каждой статье.

Граничные значения откалиброваны по таблице `scenariosTable` из самой статьи:

| Сочетание | CAPEX расчёт | CAPEX в таблице |
|---|---|---|
| small + 7b + basic + basic | 0,7–1,4 млн ₽ | 0,7–1,5 млн ₽ ✓ |
| medium + 13b + corporate + medium | 2,8–6,0 млн ₽ | 4–7 млн ₽ ✓ |
| large + 70b + regulated + full | 9,2–30,5 млн ₽ | 12–30+ млн ₽ ✓ |

Калькулятор не выдаёт коммерческое предложение — это инструмент первичной прикидки.

## Код для вставки

```astro
        <!-- Калькулятор бюджета -->
        <div>
          <div class="flex items-center gap-3 mb-5">
            <div class="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="8" y1="10" x2="16" y2="10"></line>
                <line x1="8" y1="14" x2="10" y2="14"></line>
                <line x1="13" y1="14" x2="16" y2="14"></line>
                <line x1="8" y1="18" x2="10" y2="18"></line>
                <line x1="13" y1="18" x2="16" y2="18"></line>
              </svg>
            </div>
            <h2 class="text-2xl md:text-3xl font-heading font-bold text-white">Калькулятор бюджета пилота</h2>
          </div>

          <div class="space-y-4">
            <p>Выберите параметры&nbsp;— получите ориентировочный диапазон бюджета на&nbsp;пилот и&nbsp;первый год эксплуатации. Расчёт строится на&nbsp;коридорах из&nbsp;таблицы сценариев выше. Это не&nbsp;коммерческое предложение, а&nbsp;первая прикидка для разговора с&nbsp;коллегами.</p>

            <div class="glass-card p-6 md:p-8 mt-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div>
                  <label class="block text-white font-semibold mb-2 text-sm" for="calc-users">Количество пользователей</label>
                  <select id="calc-users" class="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent transition-colors">
                    <option value="small">5–20 человек (рабочая группа)</option>
                    <option value="medium" selected>20–100 человек (подразделение)</option>
                    <option value="large">100+ человек (корпоративный масштаб)</option>
                  </select>
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2 text-sm" for="calc-model">Размер модели</label>
                  <select id="calc-model" class="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent transition-colors">
                    <option value="7b">7B / 13B с квантизацией</option>
                    <option value="13b" selected>13B–34B (FP16)</option>
                    <option value="70b">70B+ или несколько моделей</option>
                  </select>
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2 text-sm" for="calc-security">Требования по ИБ</label>
                  <select id="calc-security" class="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent transition-colors">
                    <option value="basic">Базовые: AD, журнал доступа</option>
                    <option value="corporate" selected>Корпоративные: аудит, разграничение</option>
                    <option value="regulated">Регулируемые: ФСТЭК / КИИ / аттестация</option>
                  </select>
                </div>

                <div>
                  <label class="block text-white font-semibold mb-2 text-sm" for="calc-integrations">Источники данных и&nbsp;интеграции</label>
                  <select id="calc-integrations" class="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent transition-colors">
                    <option value="basic">1–2 источника: файлы, AD</option>
                    <option value="medium" selected>3–5 источников: СЭД, 1С, портал</option>
                    <option value="full">Полный комплект: множественные источники</option>
                  </select>
                </div>
              </div>

              <div class="mt-7 pt-7 border-t border-white/10">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                    <div class="text-xs text-muted-foreground mb-1.5">CAPEX (железо, ПО)</div>
                    <div id="calc-capex" class="text-xl md:text-2xl font-bold text-white">— млн&nbsp;₽</div>
                  </div>
                  <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                    <div class="text-xs text-muted-foreground mb-1.5">Проектные работы</div>
                    <div id="calc-work" class="text-xl md:text-2xl font-bold text-white">— млн&nbsp;₽</div>
                  </div>
                  <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                    <div class="text-xs text-muted-foreground mb-1.5">OPEX за&nbsp;год</div>
                    <div id="calc-opex" class="text-xl md:text-2xl font-bold text-white">— млн&nbsp;₽</div>
                  </div>
                </div>

                <div class="p-5 rounded-xl bg-accent/10 border border-accent/30">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div class="text-xs text-muted-foreground mb-1">Итого первый год (CAPEX + работы + OPEX)</div>
                      <div id="calc-total" class="text-2xl md:text-3xl font-bold text-gradient">— млн&nbsp;₽</div>
                    </div>
                    <a id="calc-cta" href="/contact/?product=other&utm_source=blog&utm_medium=calculator&utm_campaign=article-15" class="premium-btn whitespace-nowrap">Уточнить расчёт</a>
                  </div>
                </div>

                <p class="text-xs text-muted-foreground/80 mt-4 italic">Диапазон ориентировочный: курс рубля, доступность GPU, состав работ и&nbsp;требования регулятора двигают итоговую цифру. Для точного расчёта&nbsp;— обсуждение с&nbsp;архитектором AZONE-AI.</p>
              </div>
            </div>
          </div>
        </div>

        <script is:inline>
          (function () {
            const factors = {
              users: {
                small:     { capex: [0.5,  0.8],  work: [0.8, 1.2], opex: [0.4, 0.8] },
                medium:    { capex: [2.0,  3.5],  work: [1.5, 2.5], opex: [0.8, 1.8] },
                large:     { capex: [4.0, 12.0],  work: [3.0, 8.0], opex: [2.0, 6.0] }
              },
              model: {
                '7b':      { capex: [0.2,  0.4],  work: [0.2, 0.4], opex: [0.1, 0.3] },
                '13b':     { capex: [0.5,  1.5],  work: [0.5, 1.0], opex: [0.3, 0.6] },
                '70b':     { capex: [3.0, 10.0],  work: [1.5, 4.0], opex: [1.0, 3.0] }
              },
              security: {
                basic:     { capex: [0,    0.2],  work: [0.2, 0.5], opex: [0.1, 0.3] },
                corporate: { capex: [0.3,  0.8],  work: [0.5, 1.5], opex: [0.3, 0.8] },
                regulated: { capex: [2.0,  8.0],  work: [2.0, 6.0], opex: [1.0, 4.0] }
              },
              integrations: {
                basic:     { capex: [0,    0  ],  work: [0.3, 0.7], opex: [0.2, 0.4] },
                medium:    { capex: [0,    0.2],  work: [0.8, 2.0], opex: [0.4, 1.0] },
                full:      { capex: [0.2,  0.5],  work: [2.0, 5.0], opex: [1.0, 3.0] }
              }
            };

            const fmt = (n) => {
              if (n >= 10) return Math.round(n).toString();
              return n.toFixed(1).replace('.', ',');
            };

            const fmtRange = (min, max) => fmt(min) + '\u2013' + fmt(max) + '\u00a0млн\u00a0₽';

            const $ = (id) => document.getElementById(id);

            function calc() {
              const u = $('calc-users').value;
              const m = $('calc-model').value;
              const s = $('calc-security').value;
              const i = $('calc-integrations').value;

              const sumKey = (key) => {
                return [factors.users[u][key], factors.model[m][key], factors.security[s][key], factors.integrations[i][key]]
                  .reduce((acc, [lo, hi]) => [acc[0] + lo, acc[1] + hi], [0, 0]);
              };

              const [capexMin, capexMax] = sumKey('capex');
              const [workMin,  workMax]  = sumKey('work');
              const [opexMin,  opexMax]  = sumKey('opex');
              const totalMin = capexMin + workMin + opexMin;
              const totalMax = capexMax + workMax + opexMax;

              $('calc-capex').textContent = fmtRange(capexMin, capexMax);
              $('calc-work').textContent  = fmtRange(workMin,  workMax);
              $('calc-opex').textContent  = fmtRange(opexMin,  opexMax);
              $('calc-total').textContent = fmtRange(totalMin, totalMax);

              $('calc-cta').href = '/contact/?product=other'
                + '&utm_source=blog&utm_medium=calculator&utm_campaign=article-15'
                + '&calc_users=' + u
                + '&calc_model=' + m
                + '&calc_security=' + s
                + '&calc_integrations=' + i;
            }

            ['calc-users', 'calc-model', 'calc-security', 'calc-integrations'].forEach((id) => {
              $(id).addEventListener('change', calc);
            });

            $('calc-cta').addEventListener('click', function () {
              if (typeof ym === 'function') ym(108466305, 'reachGoal', 'calculator_cta_click');
              if (typeof gtag === 'function') gtag('event', 'calculator_cta_click', { event_category: 'blog_article_15' });
            });

            calc();
          })();
        </script>
```

## Настройка целей в аналитике

Чтобы измерять конверсию калькулятора отдельно от общего CTA в финале статьи, нужно добавить две цели:

### Яндекс.Метрика (ID 108466305)

1. Открыть Метрику → счётчик `azoneai.ru` → **Настройка** → **Цели** → **Добавить цель**.
2. Тип: **JavaScript-событие**.
3. Название: `Клик по CTA калькулятора (статья 15)`.
4. Идентификатор: `calculator_cta_click`.
5. Сохранить.

После этого в отчётах «Конверсии» цель будет считать клики, а связка с UTM-метками покажет, какие сочетания параметров расчёта чаще ведут к конверсии.

### Google Analytics 4

В GA4 событие `calculator_cta_click` улетит автоматически. Чтобы пометить его как ключевое:

1. **Администратор** → **События** → найти `calculator_cta_click`.
2. Переключатель «Отметить как ключевое событие» → **Вкл**.

## Что замерять после публикации

- **Доля посетителей статьи 15, которые меняют хотя бы один select.** Это требует второй цели в Метрике — `calculator_interaction` (можно добавить позже).
- **CTR в форму с калькулятора vs CTR с финального CTA-блока.** Финальный CTA уже использует ссылку без UTM (`/contact/?product=other`) — стоит добавить ему UTM `utm_medium=cta-bottom` для разделения.
- **Какие сочетания параметров чаще приводят к заявке.** Параметры расчёта едут в форму через UTM (`calc_users`, `calc_model`, etc.) — их можно сохранять в письмо заявки в Cloud Function и анализировать.

## Что не делается на этом шаге

- **Сохранение лида прямо из калькулятора.** Калькулятор намеренно не имеет формы — это снизило бы интерактивность и заставило бы решать вопрос «здесь и сейчас». Все, кто хочет оставить контакт, переходят в основную форму `/contact/` уже с UTM.
- **Сравнение с облачными API.** Можно добавить в v2 — отдельный режим «облако vs on-premise», но это уже другая статья (`02-on-premise-llm`) и другой инструмент.
- **Сохранение состояния в localStorage.** Не нужно — это разовый расчёт, не редактор.

## Деплой

После вставки кода:

```bash
npm run build
npm run deploy
```

Проверить: открыть `https://azoneai.ru/blog/15-stoimost-vnedreniya-llm-on-premise/`, дойти до калькулятора, поменять параметры, кликнуть «Уточнить расчёт» — должна открыться форма контакта с UTM в URL. В Метрике (с задержкой ~15 минут) появится цель.
