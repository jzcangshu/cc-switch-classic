import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ArrowUpAZ,
  Heart,
  Search,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/components/BrandIcons";
import { ProviderIcon } from "@/components/ProviderIcon";
import type { ProviderPreset } from "@/config/claudeProviderPresets";
import type { CodexProviderPreset } from "@/config/codexProviderPresets";
import type { GeminiProviderPreset } from "@/config/geminiProviderPresets";
import type { ClaudeDesktopProviderPreset } from "@/config/claudeDesktopProviderPresets";
import type { OpenCodeProviderPreset } from "@/config/opencodeProviderPresets";
import type { OpenClawProviderPreset } from "@/config/openclawProviderPresets";
import type { HermesProviderPreset } from "@/config/hermesProviderPresets";
import type { McodeProviderPreset } from "@/config/mcodeProviderPresets";
import type { PiProviderPreset } from "@/config/piProviderPresets";
import type { ProviderCategory } from "@/types";
import type { AppId } from "@/lib/api";
import {
  universalProviderPresets,
  type UniversalProviderPreset,
} from "@/config/universalProviderPresets";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  PRESET_GROUP_ORDER,
  groupPresetRows,
  loginAccountKey,
  matchPresetRow,
  presetDisplayName,
  presetDomain,
  presetGroup,
  presetMatches,
  presetPlanLabel,
  presetRegionLabel,
  presetRowGroup,
  presetRowName,
  presetRowNeedsRouting,
  presetVersionLabel,
  presetVersionLayout,
  presetVersionShortLabel,
  presetVersions,
  sortPresetRowsByName,
  sortPresetsByName,
  type PresetGroup,
  type PresetRowItem,
} from "./presetGroups";

type PresetTranslator = (key: string) => unknown;

export type AnyPreset =
  | ProviderPreset
  | CodexProviderPreset
  | GeminiProviderPreset
  | ClaudeDesktopProviderPreset
  | OpenCodeProviderPreset
  | OpenClawProviderPreset
  | HermesProviderPreset
  | PiProviderPreset
  | McodeProviderPreset;

export type PresetEntry = {
  id: string;
  preset: AnyPreset;
};

export function getPresetDisplayName(
  preset: AnyPreset,
  t: PresetTranslator,
): string {
  return presetDisplayName(preset, t);
}

/** 搜索：名称、显示名、域名主体、别名（中文名、公司名） */
export function filterPresetEntries(
  entries: PresetEntry[],
  query: string,
  t: PresetTranslator,
): PresetEntry[] {
  if (!query.trim()) return entries;
  return entries.filter((entry) => presetMatches(entry, query, t));
}

/** 一律按名称排（中文名按拼音插进字母序），不再有官方 / 赞助商置顶 */
export function getVisiblePresetEntries(
  entries: PresetEntry[],
  { query, t }: { query: string; t: PresetTranslator },
): PresetEntry[] {
  return sortPresetsByName(filterPresetEntries(entries, query, t), t);
}

/** 一个供应商按钮和搜索命中的版本下标（空 = 整家命中） */
export interface VisiblePresetRow {
  row: PresetRowItem;
  hits: number[];
}

/** 同一家的多个版本合成一行，再按名称排 */
export function getVisiblePresetRows(
  entries: PresetEntry[],
  { query, t }: { query: string; t: PresetTranslator },
): VisiblePresetRow[] {
  const found = groupPresetRows(entries).flatMap((row) => {
    const match = matchPresetRow(row, query, t);
    return match ? [{ row, hits: match.versions }] : [];
  });
  return sortPresetRowsByName(found, t);
}

type PickerCategory = "all" | PresetGroup | "universal";

interface ProviderPresetSelectorProps {
  appId: AppId;
  selectedPresetId: string | null;
  presetEntries: PresetEntry[];
  /** 旧的分类名表，保留给调用方；v7 的分类由预设字段推算 */
  presetCategoryLabels?: Record<string, string>;
  onPresetChange: (value: string) => void;
  onUniversalPresetSelect?: (preset: UniversalProviderPreset) => void;
  onManageUniversalProviders?: () => void;
  category?: ProviderCategory;
}

/** 第三版的同页预设网格，保留第四版的版本分组与套餐、地区切换。 */
export function ProviderPresetSelector({
  appId,
  selectedPresetId,
  presetEntries,
  onPresetChange,
  onUniversalPresetSelect,
  onManageUniversalProviders,
}: Readonly<ProviderPresetSelectorProps>) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const edited = useFormEditedSince(ref, selectedPresetId ?? "custom");
  const [pending, setPending] = useState<PresetEntry | null>(null);
  const entry =
    selectedPresetId && selectedPresetId !== "custom"
      ? presetEntries.find((item) => item.id === selectedPresetId)
      : undefined;

  const versions = entry ? presetVersions(presetEntries, entry) : [];
  const requestPresetChange = (id: string) => {
    if (entry?.id === id) return;
    const next = presetEntries.find((item) => item.id === id);
    if (
      entry?.preset.family &&
      next?.preset.family === entry.preset.family &&
      edited.current
    ) {
      setPending(next);
    } else {
      onPresetChange(id);
    }
  };
  return (
    <div ref={ref} className="space-y-3" data-preset-selector="">
      <PresetPicker
        appId={appId}
        entries={presetEntries}
        onPick={requestPresetChange}
        selectedPresetId={selectedPresetId}
        onUniversalPresetSelect={onUniversalPresetSelect}
        onManageUniversalProviders={onManageUniversalProviders}
      />
      {entry && versions.length > 1 && (
        <VersionSwitch
          entry={entry}
          versions={versions}
          onVersionChange={requestPresetChange}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {entry
          ? t(`providerPreset.groupHint.${presetGroup(entry.preset)}`)
          : t("providerPreset.customDetail")}
      </p>
      <ConfirmDialog
        isOpen={pending !== null}
        title={t("providerPreset.switchVersionTitle", {
          version: pending ? presetVersionLabel(pending, t) : "",
        })}
        message={t("providerPreset.switchVersionMessage")}
        confirmText={t("providerPreset.switchVersionConfirm")}
        variant="info"
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) onPresetChange(next.id);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

// ─── 图标块 ─────────────────────────────────────────────────────────────────

function PresetIconBox({
  preset,
  selected = false,
}: {
  preset?: AnyPreset;
  selected?: boolean;
}) {
  const { t } = useTranslation();
  if (preset?.icon) {
    return (
      <ProviderIcon
        icon={preset.icon}
        name={preset.name}
        color={preset.iconColor}
        size={16}
        className={cn("shrink-0", !selected && "text-foreground")}
      />
    );
  }
  let inner: React.ReactNode;
  if (!preset) {
    inner = (
      <SlidersHorizontal className="h-4 w-4 text-fg-2" strokeWidth={1.5} />
    );
  } else if (preset.theme?.icon === "claude") {
    inner = <ClaudeIcon size={16} />;
  } else if (preset.theme?.icon === "codex") {
    inner = <CodexIcon size={16} />;
  } else if (preset.theme?.icon === "gemini") {
    inner = <GeminiIcon size={16} />;
  } else if (preset.theme?.icon === "generic") {
    inner = <Zap className="h-4 w-4 text-fg-2" strokeWidth={1.5} />;
  } else {
    inner = (
      <span className="text-caption font-semibold text-fg-2">
        {presetDisplayName(preset, t).slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center"
    >
      {inner}
    </span>
  );
}

/**
 * 用户在表单里手动改过东西没有：只认表单里的 input / change 事件。预设填充是程序改值，
 * 不发这些事件；Radix Select / Checkbox / Switch 跟着值同步的隐藏控件（aria-hidden）会发，
 * 要排除；预设选择器自己（搜索框、版本按钮）也不算。`resetKey` 变了（换了预设）就重新算。
 */
function useFormEditedSince(
  anchor: React.RefObject<HTMLElement | null>,
  resetKey: string,
) {
  const edited = useRef(false);
  useEffect(() => {
    edited.current = false;
  }, [resetKey]);
  useEffect(() => {
    const node = anchor.current;
    const root = node?.closest("form") ?? node?.ownerDocument.body;
    if (!root) return;
    const onEdit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-preset-selector]")) return;
      if (target.closest('[aria-hidden="true"]')) return;
      edited.current = true;
    };
    root.addEventListener("input", onEdit);
    root.addEventListener("change", onEdit);
    return () => {
      root.removeEventListener("input", onEdit);
      root.removeEventListener("change", onEdit);
    };
  }, [anchor]);
  return edited;
}

/**
 * 选版本（换版本 = 选同一家的另一个预设，表单按它重填）。版本按「套餐 × 地区」两个维度摆：
 * 只有一维在变 → 一个分段控件；两维都变且成完整网格 → 套餐、地区各一个分段控件
 * （切一维时另一维保持不变）；不成网格 → 下拉。见 presetVersionLayout。
 * 覆盖确认由外层选择器统一处理，搜索选中的版本也遵守同一规则。
 */
function VersionSwitch({
  entry,
  versions,
  onVersionChange,
}: {
  entry: PresetEntry;
  versions: PresetEntry[];
  onVersionChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const layout = presetVersionLayout(versions);

  // 网格里切一维：另一维保持当前值
  const requestCell = (
    plan = entry.preset.planKey,
    region = entry.preset.regionKey,
  ) => {
    const next = versions.find(
      (version) =>
        version.preset.planKey === plan && version.preset.regionKey === region,
    );
    if (next) onVersionChange(next.id);
  };

  const segmentClass =
    "h-auto min-w-0 flex-wrap gap-0.5 rounded-lg bg-accent p-1";

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
      {layout.kind === "grid" ? (
        <>
          <DimensionLabel>{t("providerPreset.planLabel")}</DimensionLabel>
          <SegmentedControl
            aria-label={t("providerPreset.planLabel")}
            value={entry.preset.planKey ?? ""}
            onValueChange={(plan) =>
              requestCell(plan as typeof entry.preset.planKey)
            }
            items={layout.plans.map((plan) => ({
              value: plan,
              label: presetPlanLabel(plan, t),
              className: "h-[30px]",
            }))}
            className={cn(segmentClass, "justify-self-start")}
          />
          <DimensionLabel>{t("providerPreset.regionLabel")}</DimensionLabel>
          <SegmentedControl
            aria-label={t("providerPreset.regionLabel")}
            value={entry.preset.regionKey ?? ""}
            onValueChange={(region) =>
              requestCell(
                entry.preset.planKey,
                region as typeof entry.preset.regionKey,
              )
            }
            items={layout.regions.map((region) => ({
              value: region,
              label: presetRegionLabel(region, t),
              className: "h-[30px]",
            }))}
            className={cn(segmentClass, "justify-self-start")}
          />
        </>
      ) : layout.kind === "single" ? (
        <>
          <DimensionLabel>{t("providerPreset.versionLabel")}</DimensionLabel>
          <SegmentedControl
            aria-label={t("providerPreset.versionLabel")}
            value={entry.id}
            onValueChange={onVersionChange}
            items={versions.map((version) => ({
              value: version.id,
              label: presetVersionShortLabel(version, layout.dimension, t),
              className: "h-[30px]",
            }))}
            className={cn(segmentClass, "justify-self-start")}
          />
        </>
      ) : (
        <>
          <DimensionLabel>{t("providerPreset.versionLabel")}</DimensionLabel>
          <Select value={entry.id} onValueChange={onVersionChange}>
            <SelectTrigger
              aria-label={t("providerPreset.versionLabel")}
              className="h-9 w-auto min-w-[220px] max-w-full justify-self-start rounded-control text-body"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {presetVersionLabel(version, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}

/** 版本区左侧的小标签（版本 / 套餐 / 地区），和控件第一行垂直居中 */
function DimensionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="min-w-8 whitespace-nowrap text-center text-caption leading-[36px] text-fg-2"
    >
      {children}
    </span>
  );
}

function NeedsRouteBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full border border-border-strong px-1.5 text-badge text-fg-2">
      {t("providerCard.chip.needsRoute")}
    </span>
  );
}

// ─── 预设网格 ──────────────────────────────────────────────────────────────

interface PresetPickerProps {
  appId: AppId;
  entries: PresetEntry[];
  selectedPresetId?: string | null;
  onPick: (id: string) => void;
  onUniversalPresetSelect?: (preset: UniversalProviderPreset) => void;
  onManageUniversalProviders?: () => void;
}

function PresetPicker({
  appId,
  entries,
  selectedPresetId,
  onPick,
  onUniversalPresetSelect,
  onManageUniversalProviders,
}: PresetPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortByName, setSortByName] = useState(false);
  const [category, setCategory] = useState<PickerCategory>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  // ⌘F / Ctrl+F 回到搜索框（捕获阶段，别让后面供应商列表的同名快捷键接到）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        setSearchOpen(true);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    globalThis.addEventListener("keydown", onKeyDown, true);
    return () => globalThis.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const groups = useMemo(() => {
    const byGroup = new Map<PresetGroup, PresetEntry[]>();
    for (const entry of entries) {
      const group = presetGroup(entry.preset);
      byGroup.set(group, [...(byGroup.get(group) ?? []), entry]);
    }
    return byGroup;
  }, [entries]);

  // 同一家的多个版本合成一行，数量也按行数算
  const matching = useMemo(() => {
    const rows = getVisiblePresetRows(entries, { query, t });
    if (sortByName) return rows;
    // 第三版的默认顺序：官方、尊享合作伙伴、合作伙伴，其余按名称。
    const rank = ({ row }: VisiblePresetRow) => {
      const preset = row.versions[0].preset;
      if (preset.category === "official") return 0;
      if (preset.primePartner) return 1;
      return preset.isPartner ? 2 : 3;
    };
    return rows.sort((a, b) => {
      const priority = rank(a) - rank(b);
      if (priority !== 0) return priority;
      if (rank(a) === 3) return 0;
      return (
        entries.indexOf(a.row.versions[0]) - entries.indexOf(b.row.versions[0])
      );
    });
  }, [entries, query, sortByName, t]);
  const matchingUniversal = useMemo(
    () =>
      onUniversalPresetSelect
        ? universalProviderPresets.filter((preset) =>
            preset.name.toLowerCase().includes(query.trim().toLowerCase()),
          )
        : [],
    [onUniversalPresetSelect, query],
  );

  const countFor = (key: PickerCategory) => {
    if (key === "universal") return matchingUniversal.length;
    // 「自定义配置」固定在第一行，不计入数量
    if (key === "all") return matching.length;
    return matching.filter((item) => presetRowGroup(item.row) === key).length;
  };

  const shown =
    category === "all"
      ? matching
      : category === "universal"
        ? []
        : matching.filter((item) => presetRowGroup(item.row) === category);

  const navItems: PickerCategory[] = [
    "all",
    ...PRESET_GROUP_ORDER.filter((group) => groups.has(group)),
  ];
  const searching = query.trim().length > 0;
  const showUniversal = category === "all" || category === "universal";
  const universalGrid = onUniversalPresetSelect && (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {matchingUniversal.map((preset) => (
        <PresetRow
          key={`universal-${preset.providerType}`}
          icon={
            <ProviderIcon
              icon={preset.icon}
              name={preset.name}
              size={16}
              className="shrink-0"
            />
          }
          name={preset.name}
          detail={t("providerPreset.universalDetail")}
          onClick={() => onUniversalPresetSelect(preset)}
        />
      ))}
      {onManageUniversalProviders && (
        <button
          type="button"
          onClick={onManageUniversalProviders}
          className="rounded-lg bg-accent px-3 py-2 text-start text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/80"
        >
          {t("providerPreset.manageUniversal")}
        </button>
      )}
    </div>
  );

  const customRow = (
    <PresetRow
      icon={<PresetIconBox />}
      name={t("providerPreset.custom")}
      detail={t("providerPreset.customDetail")}
      selected={selectedPresetId === "custom"}
      changesPreset={selectedPresetId !== "custom"}
      onClick={() => onPick("custom")}
    />
  );
  const renderRow = ({ row, hits }: VisiblePresetRow) => {
    const first = row.versions[0];
    const selected = row.versions.find(
      (entry) => entry.id === selectedPresetId,
    );
    // 搜索可直达命中的版本；再次选择同一家时保留当前套餐和地区。
    const target =
      hits.length > 0 ? row.versions[hits[0]] : (selected ?? first);
    return (
      <PresetRow
        key={row.key}
        preset={selected?.preset ?? first.preset}
        icon={
          <PresetIconBox
            preset={selected?.preset ?? first.preset}
            selected={Boolean(selected)}
          />
        }
        name={presetRowName(row, t)}
        detail={presetRowDetail(appId, row, hits, t)}
        needsRoute={presetRowNeedsRouting(appId, row)}
        selected={Boolean(selected)}
        changesPreset={target.id !== selectedPresetId}
        onClick={() => onPick(target.id)}
      />
    );
  };

  const nothing =
    searching &&
    shown.length === 0 &&
    (!showUniversal || matchingUniversal.length === 0);

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        data-unsaved-ignore
      >
        <span className="text-sm font-medium">{t("providerPreset.label")}</span>
        <div className="flex items-center gap-2">
          {searchOpen && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3"
                strokeWidth={1.5}
              />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setQuery("");
                    setSearchOpen(false);
                  }
                }}
                placeholder={t("providerPreset.searchPlaceholder")}
                aria-label={t("providerPreset.searchAriaLabel")}
                className="h-8 w-60 pe-9 ps-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label={t("providerPreset.clearSearch")}
                  className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-control text-fg-3 hover:bg-subtle hover:text-fg-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("providerPreset.searchAriaLabel")}
            aria-pressed={searchOpen}
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setQuery("");
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("providerPreset.sortAriaLabel")}
            aria-pressed={sortByName}
            onClick={() => setSortByName(!sortByName)}
          >
            <ArrowUpAZ className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div
          role="group"
          aria-label={t("providerPreset.categoriesLabel")}
          data-unsaved-ignore
          className="flex flex-wrap items-center gap-1.5"
        >
          {navItems.map((key) => (
            <CategoryButton
              key={key}
              label={t(`providerPreset.group.${key}`)}
              count={countFor(key)}
              active={category === key}
              dim={searching && countFor(key) === 0}
              onClick={() => setCategory(key)}
            />
          ))}
          {onUniversalPresetSelect && (
            <CategoryButton
              label={t("providerPreset.group.universal")}
              count={countFor("universal")}
              active={category === "universal"}
              dim={searching && countFor("universal") === 0}
              onClick={() => setCategory("universal")}
            />
          )}
        </div>

        <div className="min-w-0">
          {category !== "all" && (
            <p className="mb-2 text-caption text-fg-2">
              {t(`providerPreset.groupHint.${category}`)}
            </p>
          )}

          {nothing ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-body text-fg-1">
                {t("providerPreset.noResults", { query: query.trim() })}
              </p>
              <p className="text-caption text-fg-2">
                {t("providerPreset.noResultsHint")}
              </p>
              <Button
                type="button"
                variant="neutral"
                size="compact"
                className="mt-1"
                onClick={() => onPick("custom")}
              >
                {t("providerPreset.useCustom")}
              </Button>
            </div>
          ) : category === "universal" ? (
            universalGrid
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {customRow}
              {shown.map(renderRow)}
            </div>
          )}
        </div>
        {category === "all" && universalGrid}
      </div>
    </div>
  );
}

/**
 * 副行：搜索命中某个版本时写「匹配：火山 Coding Plan」；账号登录类写登录说明；
 * 有多个版本的写「kimi.com · 4 个版本」；其余写域名。
 */
function presetRowDetail(
  appId: AppId | undefined,
  row: PresetRowItem,
  hits: number[],
  t: TFunction,
): string {
  const first = row.versions[0];
  if (hits.length > 0) {
    const name = presetDisplayName(row.versions[hits[0]].preset, t);
    return hits.length > 1
      ? t("providerPreset.matchedVersions", {
          name,
          n: hits.length,
          more: hits.length - 1,
        })
      : t("providerPreset.matchedVersion", { name });
  }
  if (presetRowGroup(row) === "login") {
    return t(
      `providerPreset.loginWith.${loginAccountKey(appId, first.preset)}`,
    );
  }
  if (row.family) {
    return t("providerPreset.versionCount", {
      domain: presetDomain(first.preset),
      n: row.versions.length,
    });
  }
  return presetDomain(first.preset);
}

function CategoryButton({
  label,
  count,
  active,
  dim,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-between gap-2 rounded-lg px-3 text-start text-sm transition-colors",
        active ? "bg-accent font-medium text-foreground" : "hover:bg-accent/80",
        !active && (dim ? "text-fg-3" : "text-fg-1"),
      )}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-caption tabular-nums text-fg-3">
        {count}
      </span>
    </button>
  );
}

function PresetRow({
  preset,
  icon,
  name,
  detail,
  needsRoute = false,
  selected = false,
  changesPreset = false,
  onClick,
}: {
  preset?: AnyPreset;
  icon: React.ReactNode;
  name: string;
  detail?: string;
  needsRoute?: boolean;
  selected?: boolean;
  changesPreset?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      data-unsaved-change={changesPreset || undefined}
      aria-label={name}
      aria-description={detail}
      title={detail}
      style={
        selected && preset?.theme?.backgroundColor
          ? {
              backgroundColor: preset.theme.backgroundColor,
              color: preset.theme.textColor || "#FFFFFF",
            }
          : undefined
      }
      className={cn(
        "relative flex min-h-9 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-start text-sm font-medium transition-colors",
        selected
          ? "bg-blue-500 text-white dark:bg-blue-600"
          : "bg-accent text-muted-foreground hover:bg-accent/80",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate" title={name}>
          {name}
        </span>
        {detail && (
          <span className="sr-only" title={detail}>
            {detail}
          </span>
        )}
      </span>
      {needsRoute && <NeedsRouteBadge />}
      {preset?.primePartner ? (
        <Heart
          className="absolute -right-1 -top-1 h-5 w-5 fill-amber-500 text-amber-500 drop-shadow-sm"
          strokeWidth={0}
          aria-hidden="true"
        />
      ) : preset?.isPartner ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-1.5 py-0.5 text-white shadow-sm"
        >
          <Star className="h-2.5 w-2.5 fill-current" />
        </span>
      ) : null}
    </button>
  );
}
