import type { TFunction } from "i18next";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import type { AppMode } from "@/types/proxy";
import { isPiFamilyApp } from "@/config/appConfig";
import {
  isOfficialAccount,
  providerNeedsRouting,
  supportsFailover,
  supportsOfficialProxyTakeover,
} from "@/utils/providerCapabilities";

/**
 * 供应商卡片怎么画（v7）：当前那张的模式色、状态文字或按钮、徽标。由列表按应用和正在查看的
 * 模式算好交给卡片，卡片本身不再判断模式。
 */
export type CardTone = "direct" | "route" | "stack" | "neutral";

export type ChipTone =
  | "outline"
  | "direct"
  | "route"
  | "stack"
  | "success"
  | "warning"
  | "danger";

export interface CardChip {
  key: string;
  label: string;
  tone: ChipTone;
  title?: string;
}

export interface CardMenuOption {
  key: string;
  label: string;
  detail?: string;
  onSelect: () => void;
}

/** 「更多」菜单里跟当前模式有关的一项。 */
export interface CardMenuItem {
  key: string;
  label: string;
  /** 不能点的原因：照常列出来，原因写在名字下面 */
  disabledReason?: string;
  onSelect: () => void;
}

export interface CardButton {
  key: string;
  label: string;
  onClick: () => void;
  /** 不能点的原因：按钮照常画出来，原因挂在按钮的说明卡上 */
  disabledReason?: string;
  /** 点开选一项（OpenClaw 的「设为默认 ▾」选默认模型） */
  menu?: { title: string; options: CardMenuOption[] };
}

export interface CardPresentation {
  /** 生效项或已添加配置的色边框与淡底；neutral 给共存式默认项，沿用第三版蓝色。 */
  tone?: CardTone;
  /** 路由页的悬停边框；与表示生效项的 tone 分开。 */
  hoverTone?: "route";
  /** 主操作位换成状态文字（使用中 / 路由中 / 当前默认 / 已添加…） */
  status?: { label: string; dot: CardTone | "muted"; icon?: "default" };
  buttons: CardButton[];
  /** 「更多」菜单里跟当前模式有关的操作（没有就整卡不画 ⋯） */
  menuItems?: CardMenuItem[];
  chips: CardChip[];
  /** 在队列里且路由服务在跑时显示健康状态 */
  showHealth?: boolean;
  /** 编辑 / 删除不可用的原因（当前那家不能删、Hermes 托管只能在 Web UI 改…） */
  editDisabledReason?: string;
  deleteDisabledReason?: string;
}

export interface ProviderSection {
  key: string;
  title?: string;
  help?: { title: string; body: string };
  emptyText?: string;
  items: { provider: Provider; presentation: CardPresentation }[];
}

/** 走路由时不能用的官方订阅（Codex 官方账号可以，靠客户端自己的登录）。 */
export function blockedFromRouting(app: AppId, provider: Provider): boolean {
  return (
    isOfficialAccount(app, provider) &&
    !supportsOfficialProxyTakeover(app, provider)
  );
}

// ─── 切换式应用（Claude Code / Codex / Gemini CLI / Grok Build）──────────────

export interface SwitchModeInput {
  app: AppId;
  t: TFunction;
  providers: Provider[];
  active: AppMode;
  view: AppMode;
  directId: string | null;
  routeId: string | null;
  failoverOn: boolean;
  /** 队列里的 id，按优先级 */
  queue: string[];
  /** 聚合名单（含默认那家）：id → 发布的模型数 */
  stackMembers: Map<string, number>;
  /** 需要路由的原因（悬停「需要路由」时的说明） */
  routingReason: (provider: Provider) => string;
  serviceRunning: boolean;
  actions: {
    switchDirect: (provider: Provider) => void;
    needsRouteDialog: (provider: Provider) => void;
    exitAndUse: (provider: Provider) => void;
    routeTo: (provider: Provider) => void;
    queueAdd: (provider: Provider) => void;
    queueRemove: (provider: Provider) => void;
    stackAdd: (provider: Provider) => void;
    stackRemove: (provider: Provider) => void;
    stackSetDefault: (provider: Provider) => void;
  };
}

export function buildSwitchSections(input: SwitchModeInput): ProviderSection[] {
  const { t, active, directId, routeId } = input;
  // 后端 is_referenced：直连指针指着的、路由 / 聚合模式下正在路由的，都删不掉。
  // 不管当前看的是哪个视图都要标出来，否则确认后后端拒绝、确认框还卡在原地
  // 路由 / 聚合时直连那家不算「正在用」，路由页卡上也不标，单独说明为什么删不掉
  const deleteBlockedReason = (id: string) => {
    if (active !== "direct" && id === routeId)
      return t("providerCard.reason.inUseCannotDelete");
    if (id === directId)
      return active === "direct"
        ? t("providerCard.reason.inUseCannotDelete")
        : t("providerCard.reason.directDefaultCannotDelete");
    return undefined;
  };
  return buildSwitchSectionsByView(input).map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const reason = deleteBlockedReason(item.provider.id);
      return {
        ...item,
        presentation: {
          ...item.presentation,
          hoverTone: input.view === "route" ? "route" : undefined,
          deleteDisabledReason:
            reason ?? item.presentation.deleteDisabledReason,
        },
      };
    }),
  }));
}

function buildSwitchSectionsByView(input: SwitchModeInput): ProviderSection[] {
  const {
    app,
    t,
    providers,
    active,
    view,
    directId,
    routeId,
    failoverOn,
    queue,
    stackMembers,
    actions,
  } = input;
  // 早期绑定托管账号的 Codex 官方卡没有 category，按身份认
  const official = (p: Provider) => isOfficialAccount(app, p);

  const chip = {
    // 第三版没有「官方」徽章；只有不能路由的 Claude 官方订阅按第三版标「不支持路由」
    noRouting: (): CardChip => ({
      key: "official",
      label: t("provider.noRoutingSupport"),
      tone: "outline",
    }),
    needsRoute: (p: Provider): CardChip => ({
      key: "needsRoute",
      label: t("providerCard.chip.needsRoute"),
      tone: "outline",
      title: input.routingReason(p),
    }),
    // 只在直连页上标：不用点开「回到直连」的确认框，在列表里就看得出会落到哪家。
    // 路由页上没有跟直连那家有关的操作，不标
    directWhenDirect: (): CardChip => ({
      key: "direct",
      label: t("providerCard.chip.directWhenDirect"),
      tone: "direct",
      title: t("provider.directProviderHint"),
    }),
  };
  const base = (p: Provider) => {
    const chips: CardChip[] = [];
    if (blockedFromRouting(app, p)) chips.push(chip.noRouting());
    if (providerNeedsRouting(app, p)) chips.push(chip.needsRoute(p));
    return chips;
  };
  const officialOnly = (p: Provider) =>
    blockedFromRouting(app, p) ? [chip.noRouting()] : [];
  const blocked = (p: Provider, label: string, reason: string) => ({
    provider: p,
    presentation: {
      chips: officialOnly(p),
      buttons: [
        {
          key: "blocked",
          label,
          onClick: () => undefined,
          disabledReason: reason,
        },
      ],
    } satisfies CardPresentation,
  });

  if (view === "direct") {
    return [
      {
        key: "all",
        items: providers.map((p) => {
          const chips = base(p);
          if (active === "direct") {
            if (p.id === directId) {
              return {
                provider: p,
                presentation: {
                  tone: "direct",
                  status: {
                    label: t("provider.inUse"),
                    dot: "direct",
                  },
                  chips,
                  buttons: [],
                },
              };
            }
            return {
              provider: p,
              presentation: {
                chips,
                buttons: [
                  {
                    key: "switch",
                    label: t("provider.enable"),
                    onClick: () =>
                      providerNeedsRouting(app, p)
                        ? actions.needsRouteDialog(p)
                        : actions.switchDirect(p),
                  },
                ],
              },
            };
          }
          // 实际在路由 / 聚合，正在查看直连
          if (p.id === directId) chips.push(chip.directWhenDirect());
          return {
            provider: p,
            presentation: {
              chips,
              buttons: [
                {
                  key: "exitAndUse",
                  label: t("providerCard.action.backToDirectAndUse"),
                  onClick: () => actions.exitAndUse(p),
                  disabledReason: providerNeedsRouting(app, p)
                    ? t("providerCard.reason.needsRoute", {
                        reason: input.routingReason(p),
                      })
                    : undefined,
                },
              ],
            },
          };
        }),
      },
    ];
  }

  if (view === "route") {
    const noRoute = t("providerCard.reason.noRoute");
    if (active === "route" && !failoverOn) {
      return [
        {
          key: "all",
          items: providers.map((p) => {
            if (blockedFromRouting(app, p))
              return blocked(p, t("provider.enable"), noRoute);
            const chips = base(p);
            if (p.id === routeId) {
              return {
                provider: p,
                presentation: {
                  tone: "route",
                  status: {
                    label: t("provider.inUse"),
                    dot: "route",
                  },
                  chips,
                  buttons: [],
                },
              };
            }
            return {
              provider: p,
              presentation: {
                chips,
                buttons: [
                  {
                    key: "routeHere",
                    label: t("provider.enable"),
                    onClick: () => actions.routeTo(p),
                  },
                ],
              },
            };
          }),
        },
      ];
    }

    if (active === "route") {
      // 故障转移开着：队列 + 不在队列。P 序号按完整队列算，「路由中」是后端记下的那家
      // （转移成功后会换），不一定是队首
      const byId = new Map(providers.map((p) => [p.id, p]));
      const routing =
        routeId !== null && queue.includes(routeId) ? routeId : queue[0];
      const queueItems = queue.flatMap((id, index) => {
        const p = byId.get(id);
        if (!p) return [];
        const current = id === routing;
        return [
          {
            provider: p,
            presentation: {
              tone: current ? "route" : undefined,
              chips: [
                {
                  key: "priority",
                  label: `P${index + 1}`,
                  tone: "outline" as const,
                  title: t("failover.priority.tooltip", {
                    priority: index + 1,
                  }),
                },
                ...base(p),
              ],
              showHealth: input.serviceRunning,
              buttons: [
                {
                  key: "queueRemove",
                  label: t("failover.inQueue"),
                  onClick: () => actions.queueRemove(p),
                },
              ],
            } satisfies CardPresentation,
          },
        ];
      });
      const rest = providers
        .filter((p) => !queue.includes(p.id))
        .map((p) => {
          if (blockedFromRouting(app, p))
            return blocked(p, t("failover.addQueue"), noRoute);
          // Codex 官方账号卡能路由，但后端不让它进队列（靠客户端自己的登录，不能和别家轮换）
          if (!supportsFailover(app, p))
            return blocked(
              p,
              t("failover.addQueue"),
              t("providerCard.reason.noFailover"),
            );
          return {
            provider: p,
            presentation: {
              chips: base(p),
              buttons: [
                {
                  key: "queueAdd",
                  label: t("failover.addQueue"),
                  onClick: () => actions.queueAdd(p),
                },
              ],
            } satisfies CardPresentation,
          };
        });
      return [
        {
          key: "queue",
          title: t("providerCard.section.queue", { count: queueItems.length }),
          help: {
            title: t("providerCard.section.queueHelpTitle"),
            body: t("providerCard.section.queueHelp"),
          },
          emptyText: t("providerCard.section.queueEmpty"),
          items: queueItems,
        },
        {
          key: "rest",
          title: t("providerCard.section.notInQueue", { count: rest.length }),
          items: rest,
        },
      ];
    }

    // 实际在直连 / 聚合，正在查看路由：行上没有主操作，要生效只有通知条的「开始路由」，
    // 路由到哪家在确认框里选（预选上次那家，框里看得到，卡上不再标）。不能路由的官方订阅
    // 没有按钮可挂原因，原因挂在「官方」徽标上
    return [
      {
        key: "all",
        items: providers.map((p) => {
          if (blockedFromRouting(app, p))
            return {
              provider: p,
              presentation: {
                chips: [{ ...chip.noRouting(), title: noRoute }],
                buttons: [],
              } satisfies CardPresentation,
            };
          return {
            provider: p,
            presentation: {
              chips: base(p),
              buttons: [],
            } satisfies CardPresentation,
          };
        }),
      },
    ];
  }

  // view === "stack"
  const on = active === "stack";
  const defaultId = (() => {
    const candidate = on ? routeId : (routeId ?? directId);
    const p = providers.find((x) => x.id === candidate);
    return p && !blockedFromRouting(app, p) ? p.id : null;
  })();
  const defaultProvider = providers.find((p) => p.id === defaultId);
  // 「设为默认」恢复第三版的卡上常驻 Zap 按钮（不用点开「更多」）：进了聚合当场生效，
  // 在直连时只记下选择（切换时的确认框里还能改）。正在路由时不能点：默认和路由目标是同一个
  // 指针，改了就是当场换路由
  const setDefaultButton = (p: Provider): CardButton => ({
    key: "setDefault",
    label: t("providerCard.action.setDefault"),
    onClick: () => actions.stackSetDefault(p),
    disabledReason:
      active === "route"
        ? t("providerCard.reason.defaultWhileRouting")
        : undefined,
  });
  const memberIds = providers
    .filter((p) => p.id !== defaultId && stackMembers.has(p.id))
    .map((p) => p.id);
  const modelsChip = (p: Provider): CardChip => {
    const count = stackMembers.get(p.id) ?? 0;
    return count > 0
      ? {
          key: "models",
          label: t("providerCard.chip.models", { count }),
          tone: "outline",
        }
      : {
          key: "models",
          label: t("providerCard.chip.noModels"),
          tone: "warning",
          title: t("provider.stackBadgeNoModels"),
        };
  };

  const defaultItems = defaultProvider
    ? [
        {
          provider: defaultProvider,
          presentation: {
            tone: on ? ("stack" as const) : undefined,
            status: on
              ? {
                  label: t("provider.isDefault"),
                  dot: "stack" as const,
                }
              : {
                  label: t("providerCard.status.defaultAfterSwitch"),
                  dot: "muted" as const,
                },
            chips: [
              {
                key: "default",
                label: t("providerCard.chip.default"),
                tone: on ? ("outline" as const) : ("stack" as const),
              },
            ],
            buttons: [],
          } satisfies CardPresentation,
        },
      ]
    : [];

  const memberItems = memberIds.map((id) => {
    const p = providers.find((x) => x.id === id)!;
    return {
      provider: p,
      presentation: {
        chips: [modelsChip(p)],
        buttons: [
          setDefaultButton(p),
          {
            key: "remove",
            label: t("providerCard.action.remove"),
            onClick: () => actions.stackRemove(p),
          },
        ],
      } satisfies CardPresentation,
    };
  });

  const availItems = providers
    .filter((p) => p.id !== defaultId && !memberIds.includes(p.id))
    .map((p) => {
      if (blockedFromRouting(app, p)) {
        return blocked(
          p,
          t("providerCard.action.add"),
          t("providerCard.reason.noStack"),
        );
      }
      if (official(p)) {
        return {
          provider: p,
          presentation: {
            chips: [],
            buttons: [
              setDefaultButton(p),
              {
                key: "add",
                label: t("providerCard.action.add"),
                onClick: () => undefined,
                disabledReason: t("providerCard.reason.officialStack"),
              },
            ],
          } satisfies CardPresentation,
        };
      }
      return {
        provider: p,
        presentation: {
          chips: providerNeedsRouting(app, p) ? [chip.needsRoute(p)] : [],
          buttons: [
            setDefaultButton(p),
            {
              key: "add",
              label: t("providerCard.action.add"),
              onClick: () => actions.stackAdd(p),
            },
          ],
        } satisfies CardPresentation,
      };
    });

  return [
    {
      key: "default",
      title: on
        ? t("providerCard.section.stackDefault")
        : t("providerCard.section.stackDefaultAfterSwitch"),
      help: {
        title: t("providerCard.section.stackDefault"),
        body: t(
          app === "claude-desktop"
            ? "providerCard.section.stackDefaultHelpDesktop"
            : "providerCard.section.stackDefaultHelp",
        ),
      },
      emptyText: t("providerCard.section.stackNoDefault"),
      items: defaultItems,
    },
    {
      key: "members",
      title: t("providerCard.section.added", { count: memberItems.length }),
      emptyText: t("providerCard.section.stackEmpty"),
      items: memberItems,
    },
    {
      key: "available",
      title: t("providerCard.section.available", { count: availItems.length }),
      items: availItems,
    },
  ];
}

// ─── 启动器式应用（Antigravity）──────────────────────────────────────────────

export interface LaunchInput {
  app: AppId;
  t: TFunction;
  providers: Provider[];
  openTerminal: (provider: Provider) => void;
}

/**
 * Antigravity：第三方 Key 只能经环境变量交给 CC Switch 打开的那个 agy，管不到用户自己敲的
 * `agy`，所以没有「启用 / 使用中」，每张卡的主操作就是「打开终端」，哪张都能删。
 */
export function buildLaunchSections(input: LaunchInput): ProviderSection[] {
  const { t, providers, openTerminal } = input;
  return [
    {
      key: "all",
      items: providers.map((p) => ({
        provider: p,
        presentation: {
          chips: [],
          buttons: [
            {
              key: "openTerminal",
              label: t("provider.openTerminalWithProvider"),
              onClick: () => openTerminal(p),
            },
          ],
        },
      })),
    },
  ];
}

// ─── 共存式应用（OpenCode / OpenClaw / Hermes / Pi / MiniMax Code / Kimi）─────

export interface AdditiveInput {
  app: AppId;
  t: TFunction;
  providers: Provider[];
  isInConfig: (provider: Provider) => boolean;
  /** OpenCode：当前启用的 OMO / OMO Slim */
  currentOmoId?: string | null;
  currentOmoSlimId?: string | null;
  /** OpenClaw / OpenCode：默认模型属于哪家、它的模型名 */
  defaultModel?: { providerId: string; model: string } | null;
  /** OpenClaw / OpenCode：每家可选的模型 */
  defaultModelOptions?: (provider: Provider) => { id: string; name?: string }[];
  /** Hermes：model.provider 指向的那家 */
  hermesCurrentId?: string | null;
  isHermesManaged?: (provider: Provider) => boolean;
  /** Pi / Oh My Pi：读不到当前配置时一律不能改 */
  piStateUnavailable?: boolean;
  /** Kimi：原生 default_model 别名所属的供应商。 */
  kimiCurrentId?: string | null;
  actions: {
    add: (provider: Provider) => void;
    remove: (provider: Provider) => void;
    disableOmo: (provider: Provider) => void;
    setDefault: (provider: Provider, modelId?: string) => void;
  };
}

export function buildAdditiveSections(input: AdditiveInput): ProviderSection[] {
  const { app, t, providers, actions } = input;
  const added: ProviderSection["items"] = [];
  const available: ProviderSection["items"] = [];
  const piBlocked =
    isPiFamilyApp(app) && input.piStateUnavailable
      ? t(`${app}.current.stateUnavailableHint`)
      : undefined;

  for (const p of providers) {
    const chips: CardChip[] = [];
    if (app === "kimi") {
      const official = isOfficialAccount(app, p);
      const live = input.isInConfig(p);
      // 官方卡可以编辑模型、可以移出 config.toml（登录留着，能再添加）；仍在 Kimi 里的
      // 官方卡不能直接删，删号在授权中心（连登录一起删）
      const deleteProtectedReason =
        official && live ? t("kimi.oauth.managedHint") : undefined;
      const current = live && p.id === input.kimiCurrentId;
      // 「加入」只写进 config.toml（模型出现在 Kimi 的 /model 列表），「移除」从 config.toml
      // 拿掉、卡片留着；「设为默认」按第三版常驻在卡上（判例 11）。
      const buttons: CardButton[] = [];
      if (!live) {
        buttons.push({
          key: "add",
          label: t("provider.addToConfig"),
          onClick: () => actions.add(p),
        });
      } else {
        if (!current) {
          buttons.push({
            key: "setDefault",
            label: t("provider.setAsDefault"),
            onClick: () => actions.setDefault(p),
          });
        }
        buttons.push({
          key: "remove",
          label: t("providerCard.action.remove"),
          disabledReason: current
            ? t("providerCard.reason.currentCannotRemove")
            : undefined,
          onClick: () => actions.remove(p),
        });
      }
      (live ? added : available).push({
        provider: p,
        presentation: {
          // 第三版：当前默认项蓝框 neutral、其余无色
          tone: current ? "neutral" : undefined,
          status: current
            ? { label: t("provider.isDefault"), dot: "muted", icon: "default" }
            : undefined,
          chips,
          buttons,
          deleteDisabledReason:
            deleteProtectedReason ??
            (current ? t("providerCard.reason.inUseCannotDelete") : undefined),
        },
      });
      continue;
    }
    const isOmo = p.category === "omo";
    const isOmoSlim = p.category === "omo-slim";
    if (isOmo) chips.push({ key: "omo", label: "OMO", tone: "outline" });
    if (isOmoSlim) chips.push({ key: "slim", label: "Slim", tone: "outline" });

    // OMO / Slim：插件配置，同一时间只启用一个
    if (isOmo || isOmoSlim) {
      const enabled = isOmo
        ? p.id === input.currentOmoId
        : p.id === input.currentOmoSlimId;
      if (enabled) {
        // 沿用第三版可点击的「使用中」按钮，点击仍停用当前插件。
        added.push({
          provider: p,
          presentation: {
            tone: "direct",
            chips,
            buttons: [
              {
                key: "disable",
                label: t("provider.inUse"),
                onClick: () => actions.disableOmo(p),
              },
            ],
          },
        });
      } else {
        available.push({
          provider: p,
          presentation: {
            chips,
            buttons: [
              {
                key: "enable",
                label: t("provider.enable"),
                onClick: () => actions.add(p),
              },
            ],
          },
        });
      }
      continue;
    }

    const managed = app === "hermes" && (input.isHermesManaged?.(p) ?? false);
    if (managed) {
      chips.push({
        key: "managed",
        label: t("providerCard.chip.hermesManaged"),
        tone: "outline",
        title: t("provider.managedByHermesHint"),
      });
    }
    const readOnlyReason = managed
      ? t("provider.managedByHermesHint")
      : undefined;

    if (!input.isInConfig(p)) {
      available.push({
        provider: p,
        presentation: {
          chips,
          editDisabledReason: readOnlyReason,
          deleteDisabledReason: readOnlyReason ?? piBlocked,
          buttons: [
            {
              key: "add",
              label: isPiFamilyApp(app)
                ? t("provider.enable")
                : t("provider.addToConfig"),
              onClick: () => actions.add(p),
              disabledReason: piBlocked,
            },
          ],
        },
      });
      continue;
    }

    // 第三版已添加的 OpenCode / Pi / MiniMax Code 有蓝色高亮，默认项仍单独标状态。
    const buttons: CardButton[] = [];
    const menuItems: CardMenuItem[] = [];
    let status: CardPresentation["status"];
    let isDefault = false;
    let removeReason: string | undefined = piBlocked;

    // OpenCode 的顶层 model 一直允许移走所指的那家，这里不改；OpenClaw 不能
    if (app === "openclaw" || app === "opencode") {
      isDefault = input.defaultModel?.providerId === p.id;
      if (isDefault) {
        status = {
          label: t("provider.isDefault"),
          dot: "muted",
          icon: app === "openclaw" ? "default" : undefined,
        };
        chips.push({
          key: "defaultModel",
          label: t("providerCard.chip.defaultModel", {
            model: input.defaultModel?.model ?? "",
          }),
          tone: "outline",
        });
        if (app === "openclaw") {
          removeReason = t("providerCard.reason.defaultCannotRemove");
        }
      } else {
        const models = input.defaultModelOptions?.(p) ?? [];
        // 「设为默认」恢复第三版的卡上常驻按钮；多个模型时按钮自带下拉选。
        // OpenCode 内置供应商可以不列模型（运行时才有），给不出选项就不显示
        if (app === "openclaw" || models.length > 0) {
          buttons.push({
            key: "setDefault",
            label: t("provider.setAsDefault"),
            onClick: () => actions.setDefault(p, models[0]?.id),
            menu:
              models.length > 1
                ? {
                    title: t("openclaw.selectDefaultModel"),
                    options: models.map((model) => ({
                      key: model.id,
                      label: model.name?.trim() || model.id,
                      detail:
                        model.name?.trim() && model.name.trim() !== model.id
                          ? model.id
                          : undefined,
                      onSelect: () => actions.setDefault(p, model.id),
                    })),
                  }
                : undefined,
          });
        }
      }
    }

    if (app === "hermes") {
      if (p.id === input.hermesCurrentId) {
        isDefault = true;
        status = { label: t("provider.inUse"), dot: "muted", icon: "default" };
        removeReason = t("providerCard.reason.currentCannotRemove");
      } else {
        buttons.push({
          key: "use",
          label: t("provider.enable"),
          onClick: () => actions.setDefault(p),
          disabledReason: readOnlyReason,
        });
      }
    }

    buttons.push({
      key: "remove",
      label: t("provider.removeFromConfig"),
      onClick: () => actions.remove(p),
      disabledReason: removeReason ?? readOnlyReason,
    });

    added.push({
      provider: p,
      presentation: {
        tone: isDefault
          ? "neutral"
          : app === "opencode" || isPiFamilyApp(app) || app === "mcode"
            ? "direct"
            : undefined,
        status,
        chips,
        editDisabledReason: readOnlyReason,
        deleteDisabledReason: readOnlyReason ?? piBlocked,
        buttons,
        menuItems: menuItems.length ? menuItems : undefined,
      },
    });
  }

  return [
    {
      key: "added",
      title: t("providerCard.section.added", { count: added.length }),
      help: {
        title: t("providerCard.section.addedHelpTitle"),
        body: t("providerCard.section.addedHelp", {
          app: t(`apps.${app}`),
        }),
      },
      emptyText: t("providerCard.section.addedEmpty"),
      items: added,
    },
    {
      key: "available",
      title: t("providerCard.section.available", { count: available.length }),
      items: available,
    },
  ];
}
