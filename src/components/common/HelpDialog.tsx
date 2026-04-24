import { useState } from 'react';
import {
  BookOpen,
  Circle,
  Command,
  FileText,
  HelpCircle,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores';
import { HOTKEY_ACTIONS, formatHotkey } from '@/stores/uiStore';
import { useT } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n';

type TabId = 'start' | 'features' | 'hotkeys' | 'templates' | 'faq';

const TABS: { id: TabId; icon: typeof BookOpen }[] = [
  { id: 'start', icon: BookOpen },
  { id: 'features', icon: Sparkles },
  { id: 'hotkeys', icon: Keyboard },
  { id: 'templates', icon: FileText },
  { id: 'faq', icon: HelpCircle },
];

export function HelpDialog() {
  const open = useUIStore(s => s.helpDialogOpen);
  const setOpen = useUIStore(s => s.setHelpDialogOpen);
  const [tab, setTab] = useState<TabId>('start');
  const t = useT();
  const locale = useLocale();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('help.title')}
          </DialogTitle>
          <DialogDescription>{t('help.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 border-b border-border pb-2 flex-wrap">
          {TABS.map(tb => {
            const Icon = tb.icon;
            return (
              <Button
                key={tb.id}
                variant={tab === tb.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTab(tb.id)}
                className="h-8"
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`help.tab.${tb.id}`)}
              </Button>
            );
          })}
        </div>

        <ScrollArea className="max-h-[520px] pr-3 scrollbar-thin">
          {tab === 'start' && <QuickStart locale={locale} />}
          {tab === 'features' && <Features locale={locale} />}
          {tab === 'hotkeys' && <Hotkeys />}
          {tab === 'templates' && <Templates locale={locale} />}
          {tab === 'faq' && <FAQ locale={locale} />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
        {title}
      </h3>
      <div className="text-xs leading-relaxed space-y-2 text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
        {n}
      </div>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono-tight text-[10px] mx-0.5">
      {children}
    </span>
  );
}

function QuickStart({ locale }: { locale: 'ru' | 'en' }) {
  return (
    <div className="space-y-5 py-2">
      {locale === 'ru' ? (
        <>
          <Section title="Что такое Structura">
            <p>
              Structura — это песочница для файловой структуры. Вы сканируете
              реальную папку, планируете изменения в виртуальном дереве, видите
              цветной дифф «до/после» и только потом атомарно применяете
              транзакцию на диск. До нажатия «Применить» ни один файл не
              затрагивается.
            </p>
          </Section>
          <Section title="Первые шаги">
            <Step n={1}>
              <strong>Откройте папку.</strong> Нажмите <Kbd>Ctrl+O</Kbd> или
              кнопку «Открыть» на панели сверху. Можно вставить путь в поле и
              нажать Enter.
            </Step>
            <Step n={2}>
              <strong>Посмотрите на дерево.</strong> Это виртуальная копия —
              смело правьте имена, перетаскивайте файлы, удаляйте, создавайте
              новые. Цветные бейджи показывают, что будет сделано: зелёное —
              создать, красное — удалить, жёлтое — переименовать, синее —
              переместить.
            </Step>
            <Step n={3}>
              <strong>Примените пресеты.</strong> Слева — список пресетов.
              Двойной клик по «Свести» или «Свести (только счётчик)», и
              песочница перестроится автоматически.
            </Step>
            <Step n={4}>
              <strong>Нажмите «ВЫПОЛНИТЬ».</strong> Откроется диалог с
              предпросмотром всех операций. Проверьте, убедитесь, что места
              достаточно, и нажмите «Применить».
            </Step>
            <Step n={5}>
              <strong>Ошиблись?</strong> <Kbd>Ctrl+Z</Kbd> отменяет шаги в
              песочнице (до Apply). После Apply — откройте «Историю транзакций»
              и откатите одним кликом.
            </Step>
          </Section>
          <Section title="Правый клик = контекстное меню">
            <p>
              Всё основное спрятано в правом клике на строке дерева: создать,
              переименовать, скопировать, вырезать, вставить, свести папку,
              переименовать по шаблону, открыть в проводнике, удалить. Для
              множественных действий выделяйте Ctrl+клик или Shift+клик.
            </p>
          </Section>
        </>
      ) : (
        <>
          <Section title="What is Structura">
            <p>
              Structura is a sandbox for your file structure. You scan a real
              folder, plan changes in a virtual tree, see a coloured
              before/after diff, and then atomically apply the transaction to
              disk. Until you press Apply, no file is touched.
            </p>
          </Section>
          <Section title="First steps">
            <Step n={1}>
              <strong>Open a folder.</strong> Press <Kbd>Ctrl+O</Kbd> or use the
              Open button in the title bar. You can also paste a path into the
              input and press Enter.
            </Step>
            <Step n={2}>
              <strong>Look at the tree.</strong> It is a virtual copy — rename,
              drag, delete, create new nodes freely. Coloured badges show what
              will happen: green = create, red = delete, yellow = rename, blue
              = move.
            </Step>
            <Step n={3}>
              <strong>Apply presets.</strong> The left panel lists presets.
              Double-click a flatten preset and the sandbox rebuilds itself.
            </Step>
            <Step n={4}>
              <strong>Press EXECUTE.</strong> A dialog appears with a preview
              of every operation. Check free space and press Apply.
            </Step>
            <Step n={5}>
              <strong>Made a mistake?</strong> <Kbd>Ctrl+Z</Kbd> undoes sandbox
              edits before Apply. After Apply — open the Transaction history
              dialog and revert with one click.
            </Step>
          </Section>
          <Section title="Right-click = context menu">
            <p>
              The main actions live in the row's right-click menu: create,
              rename, copy, cut, paste, flatten folder, rename by template,
              reveal, delete. Use Ctrl+click / Shift+click to select multiple
              rows.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}

function Features({ locale }: { locale: 'ru' | 'en' }) {
  const items =
    locale === 'ru'
      ? [
          {
            title: 'Свести (Flatten)',
            body: 'Перетаскивает все вложенные файлы в одну папку. Два режима: «в эту папку» (собирает в target) и «вытащить наружу» (выпускает содержимое в родителя). Конфликты разрешаются автоматически по правилам пресета.',
          },
          {
            title: 'Переименование по шаблону',
            body: 'Правый клик на папке → «Переименовать по шаблону…». Переменные: {file}, {base}, {ext}, {parent}, {n}, {n:03}, EXIF ({exif_date}, {exif_camera}), ID3 ({id3_artist}, {id3_title} и др.).',
          },
          {
            title: 'Наблюдатели папок',
            body: 'Кнопка «глаз» в панели сверху. Подпишитесь на папку — Structura будет писать в журнал все создания/изменения/удаления. Можно добавить правило с маской и автоматически применять пресет при появлении файла.',
          },
          {
            title: 'Поиск дубликатов',
            body: 'Кнопка «лупа» в панели. Рекурсивный хэш-поиск (SHA-256). Показывает группы одинаковых файлов с размером экономии. Можно удалить лишние копии или заменить на жёсткие ссылки.',
          },
          {
            title: 'Плавающий виджет',
            body: 'Компактное окно 180×180 поверх всех окон. Бросьте в него папку — Structura её откроет. Удобно держать рядом с файловым менеджером.',
          },
          {
            title: 'Импорт / экспорт',
            body: 'Дерево можно экспортировать в markdown-список или tab-indented текст и импортировать обратно. Полезно делиться структурами и использовать LLM для генерации.',
          },
          {
            title: 'История транзакций',
            body: 'Каждый Apply сохраняется с обратной операцией. Один клик — откат. Хранится до MAX_HISTORY последних транзакций.',
          },
        ]
      : [
          {
            title: 'Flatten',
            body: 'Drags every nested file into one folder. Two modes: "into this folder" (collect into target) and "dissolve" (promote contents to the parent). Name collisions resolved automatically by preset rules.',
          },
          {
            title: 'Batch rename by template',
            body: 'Right-click a folder → "Rename by template…". Variables: {file}, {base}, {ext}, {parent}, {n}, {n:03}, EXIF ({exif_date}, {exif_camera}), ID3 ({id3_artist}, {id3_title}, etc.).',
          },
          {
            title: 'Folder watchers',
            body: 'Eye button in the title bar. Subscribe to a folder — Structura writes every create/modify/remove to the log. Add a glob rule to auto-apply a preset on matching files.',
          },
          {
            title: 'Find duplicates',
            body: 'Magnifier button. Recursive hash-based search (SHA-256). Shows identical-file groups sorted by reclaimable space. Delete extras or replace them with hardlinks.',
          },
          {
            title: 'Floating widget',
            body: 'A 180×180 window that stays on top. Drop a folder on it — Structura opens it. Handy next to your file manager.',
          },
          {
            title: 'Import / export',
            body: 'Export the tree as a markdown list or tab-indented text; re-import it. Great for sharing structures or generating layouts with an LLM.',
          },
          {
            title: 'Transaction history',
            body: 'Every Apply is saved with an inverse. One click reverts it. The last MAX_HISTORY transactions are kept.',
          },
        ];

  return (
    <div className="space-y-4 py-2">
      {items.map(item => (
        <div key={item.title} className="rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Circle className="h-2 w-2 fill-primary text-primary" />
            {item.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function Hotkeys() {
  const hotkeys = useUIStore(s => s.hotkeys);
  const t = useT();
  return (
    <div className="space-y-1 py-2">
      {HOTKEY_ACTIONS.map(action => (
        <div
          key={action}
          className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
        >
          <span className="text-xs">{t(`hk.${action}`)}</span>
          <span className="font-mono-tight text-[11px] rounded border border-border bg-muted px-1.5 py-0.5">
            {formatHotkey(hotkeys[action])}
          </span>
        </div>
      ))}
      <div className="text-[11px] text-muted-foreground pt-2 flex items-center gap-1">
        <Command className="h-3 w-3" />
        <span>
          {t('settings.hotkeysHint').replace(/^.*?Esc/, 'Esc').length > 0 &&
            ''}
        </span>
      </div>
    </div>
  );
}

function Templates({ locale }: { locale: 'ru' | 'en' }) {
  const vars =
    locale === 'ru'
      ? [
          { key: '{file}', desc: 'полное имя файла с расширением (IMG_001.jpg)' },
          { key: '{base}', desc: 'имя без расширения (IMG_001)' },
          { key: '{ext}', desc: 'расширение с точкой (.jpg)' },
          { key: '{parent}', desc: 'имя папки, в которой файл' },
          { key: '{grandparent}', desc: 'имя папки уровнем выше' },
          { key: '{n}', desc: 'счётчик 1, 2, 3…' },
          { key: '{n:02}', desc: 'счётчик с лидирующими нулями: 01, 02, 03…' },
          { key: '{n:03}', desc: '001, 002, 003…' },
          { key: '{n:04}', desc: '0001, 0002, 0003…' },
          { key: '{date}', desc: 'текущая дата в формате YYYY-MM-DD' },
          { key: '{datetime}', desc: '2026-04-24_14-35' },
          { key: '{exif_date}', desc: 'дата снимка из EXIF (2024-07-14)' },
          { key: '{exif_camera}', desc: 'модель камеры' },
          { key: '{exif_lens}', desc: 'модель объектива' },
          { key: '{exif_width}', desc: 'ширина снимка в пикселях' },
          { key: '{exif_height}', desc: 'высота снимка' },
          { key: '{id3_artist}', desc: 'исполнитель из ID3' },
          { key: '{id3_title}', desc: 'название трека' },
          { key: '{id3_album}', desc: 'альбом' },
          { key: '{id3_year}', desc: 'год' },
          { key: '{id3_track}', desc: 'номер трека (с ведущим нулём)' },
        ]
      : [
          { key: '{file}', desc: 'full filename with extension (IMG_001.jpg)' },
          { key: '{base}', desc: 'name without extension (IMG_001)' },
          { key: '{ext}', desc: 'extension with dot (.jpg)' },
          { key: '{parent}', desc: 'name of the containing folder' },
          { key: '{grandparent}', desc: 'name of the folder one level up' },
          { key: '{n}', desc: 'counter 1, 2, 3…' },
          { key: '{n:02}', desc: 'zero-padded counter: 01, 02, 03…' },
          { key: '{n:03}', desc: '001, 002, 003…' },
          { key: '{n:04}', desc: '0001, 0002, 0003…' },
          { key: '{date}', desc: 'current date as YYYY-MM-DD' },
          { key: '{datetime}', desc: '2026-04-24_14-35' },
          { key: '{exif_date}', desc: 'EXIF capture date (2024-07-14)' },
          { key: '{exif_camera}', desc: 'camera model' },
          { key: '{exif_lens}', desc: 'lens model' },
          { key: '{exif_width}', desc: 'image width in pixels' },
          { key: '{exif_height}', desc: 'image height' },
          { key: '{id3_artist}', desc: 'artist from ID3' },
          { key: '{id3_title}', desc: 'track title' },
          { key: '{id3_album}', desc: 'album' },
          { key: '{id3_year}', desc: 'year' },
          { key: '{id3_track}', desc: 'track number (zero-padded)' },
        ];
  return (
    <div className="py-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        {locale === 'ru'
          ? 'Переменные подставляются в шаблон имени. Пустое значение подставляется как пустая строка.'
          : 'Variables are substituted into the name template. Missing values become an empty string.'}
      </p>
      <div className="rounded-md border border-border divide-y divide-border">
        {vars.map(v => (
          <div key={v.key} className="flex items-baseline gap-3 px-3 py-1.5">
            <code className="font-mono-tight text-[11px] text-primary shrink-0 min-w-[110px]">
              {v.key}
            </code>
            <span className="text-xs text-muted-foreground">{v.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQ({ locale }: { locale: 'ru' | 'en' }) {
  const items =
    locale === 'ru'
      ? [
          {
            q: 'Удаляет ли Structura файлы безвозвратно?',
            a: 'Нет. Удаление в песочнице только помечает узел. При Apply файл перемещается в .structura-trash/ внутри корня — оттуда его можно достать вручную или откатить через «Историю транзакций».',
          },
          {
            q: 'Почему Apply иногда не изменил ничего?',
            a: 'Скорее всего, все операции прошли успешно, но эффект был только в рамках корня. Проверьте журнал «Истории». Если операция «move» показывает from=abs и to=relative — это баг относительных путей; используйте свежий скан.',
          },
          {
            q: 'Symlink на Windows не создаётся — почему?',
            a: 'Нужно включить Developer Mode в настройках Windows или запустить Structura от имени администратора. Это ограничение операционки, не Structura.',
          },
          {
            q: 'Можно ли делиться пресетами?',
            a: 'Да — в панели пресетов есть кнопки «Package» и «Package Open» (экспорт/импорт всех пресетов в JSON).',
          },
          {
            q: 'Как перенести тысячи файлов из глубокой папки в корень одним кликом?',
            a: 'Откройте корень, выберите пресет «Свести (по умолчанию)» или «Свести (только счётчик)», двойной клик → дерево перестроится. Затем ВЫПОЛНИТЬ.',
          },
          {
            q: 'Русский язык — когда по умолчанию?',
            a: 'Уже. Можно переключить на английский в «Настройках → Язык».',
          },
        ]
      : [
          {
            q: 'Does Structura delete files permanently?',
            a: 'No. Deleting in the sandbox only marks a node. On Apply the file is moved to .structura-trash/ inside the root — you can retrieve it manually or revert via the Transaction history.',
          },
          {
            q: 'Why did Apply sometimes do nothing?',
            a: 'All ops probably succeeded, but only inside the root. Check the transaction history. If a Move shows from=abs, to=relative — that is a relative-paths bug; rescan the root.',
          },
          {
            q: 'Why does symlink fail on Windows?',
            a: 'Enable Developer Mode in Windows Settings or run Structura as administrator. This is an OS constraint, not a Structura limitation.',
          },
          {
            q: 'Can I share presets?',
            a: 'Yes — the preset list has Package / Package Open buttons to export/import all presets as JSON.',
          },
          {
            q: 'How do I pull thousands of files from a deep folder to the root?',
            a: 'Open the root, double-click the "Flatten (default)" preset and the tree rebuilds. Then press Execute.',
          },
          {
            q: 'When does Russian become the default?',
            a: 'Already. Switch to English in Settings → Language.',
          },
        ];
  return (
    <div className="py-2 space-y-3">
      {items.map(item => (
        <div key={item.q} className="rounded-md border border-border p-3">
          <h3 className="text-xs font-semibold text-primary">{item.q}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.a}
          </p>
        </div>
      ))}
    </div>
  );
}
