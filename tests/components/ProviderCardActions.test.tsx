import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import type { Provider } from "@/types";
import { ProviderCardActions } from "@/components/providers/ProviderCardActions";
import {
  buildAdditiveSections,
  buildSwitchSections,
  type CardPresentation,
  type SwitchModeInput,
} from "@/components/providers/presentation";

const provider: Provider = { id: "relay", name: "Relay", settingsConfig: {} };
const backup: Provider = { id: "backup", name: "Backup", settingsConfig: {} };
const t = ((key: string) => key) as TFunction;

function switchCards(overrides: Partial<SwitchModeInput> = {}) {
  const input: SwitchModeInput = {
    app: "claude",
    t,
    providers: [provider, backup],
    active: "direct",
    view: "direct",
    directId: provider.id,
    routeId: null,
    failoverOn: false,
    queue: [],
    stackMembers: new Map(),
    routingReason: () => "Needs routing",
    serviceRunning: true,
    actions: {
      switchDirect: vi.fn(),
      needsRouteDialog: vi.fn(),
      exitAndUse: vi.fn(),
      routeTo: vi.fn(),
      queueAdd: vi.fn(),
      queueRemove: vi.fn(),
      stackAdd: vi.fn(),
      stackRemove: vi.fn(),
      stackSetDefault: vi.fn(),
    },
    ...overrides,
  };
  const cards = buildSwitchSections(input).flatMap((section) => section.items);
  const card = (id: string) =>
    cards.find((item) => item.provider.id === id)!.presentation;
  return { input, cards, card };
}

function renderActions(presentation: CardPresentation) {
  return render(
    <ProviderCardActions
      providerName="Relay"
      presentation={presentation}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("ProviderCardActions — classic controls with live presentation", () => {
  it("shows in-use as a disabled button and enables the selected direct provider", async () => {
    const user = userEvent.setup();
    const { input, card } = switchCards();
    const view = renderActions(card(provider.id));
    const inUse = screen.getByRole("button", { name: "provider.inUse" });
    expect(inUse).toBeDisabled();
    await user.click(inUse);
    expect(input.actions.switchDirect).not.toHaveBeenCalled();

    view.rerender(
      <ProviderCardActions
        providerName="Backup"
        presentation={card(backup.id)}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "provider.enable" }));
    expect(input.actions.switchDirect).toHaveBeenCalledWith(backup);
    expect(input.actions.routeTo).not.toHaveBeenCalled();
  });

  it("uses the same enable label for routing while calling the route handler", async () => {
    const user = userEvent.setup();
    const { input, card } = switchCards({
      active: "route",
      view: "route",
      routeId: provider.id,
    });
    renderActions(card(backup.id));
    await user.click(screen.getByRole("button", { name: "provider.enable" }));
    expect(input.actions.routeTo).toHaveBeenCalledWith(backup);
    expect(input.actions.switchDirect).not.toHaveBeenCalled();
  });

  it("keeps join and joined buttons bound to opposite queue membership changes", async () => {
    const user = userEvent.setup();
    const { input, cards } = switchCards({
      active: "route",
      view: "route",
      routeId: provider.id,
      failoverOn: true,
      queue: [provider.id],
    });
    for (const card of cards) renderActions(card.presentation);
    expect(
      screen.queryByRole("button", { name: "provider.inUse" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "failover.inQueue" }));
    expect(input.actions.queueRemove).toHaveBeenCalledWith(provider);
    await user.click(screen.getByRole("button", { name: "failover.addQueue" }));
    expect(input.actions.queueAdd).toHaveBeenCalledWith(backup);
    expect(input.actions.routeTo).not.toHaveBeenCalled();
  });

  it("preserves the return-to-direct label and exact handler from the preview", async () => {
    const user = userEvent.setup();
    const { input, card } = switchCards({
      active: "stack",
      view: "direct",
      routeId: provider.id,
    });
    renderActions(card(backup.id));
    await user.click(
      screen.getByRole("button", {
        name: "providerCard.action.backToDirectAndUse",
      }),
    );
    expect(input.actions.exitAndUse).toHaveBeenCalledWith(backup);
    expect(input.actions.switchDirect).not.toHaveBeenCalled();
  });

  it("does not expose enable actions or current status while previewing route", () => {
    const { cards } = switchCards({
      active: "direct",
      view: "route",
      routeId: backup.id,
    });
    for (const card of cards) renderActions(card.presentation);
    expect(
      screen.queryByRole("button", { name: "provider.enable" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "provider.inUse" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the active OMO in-use button clickable to disable that plugin", async () => {
    const user = userEvent.setup();
    const omo: Provider = { ...provider, category: "omo" };
    const actions = {
      add: vi.fn(),
      remove: vi.fn(),
      disableOmo: vi.fn(),
      setDefault: vi.fn(),
    };
    const sections = buildAdditiveSections({
      app: "opencode",
      t,
      providers: [omo],
      isInConfig: () => false,
      currentOmoId: omo.id,
      actions,
    });
    renderActions(sections[0].items[0].presentation);
    const inUse = screen.getByRole("button", { name: "provider.inUse" });
    expect(inUse).toBeEnabled();
    await user.click(inUse);
    expect(actions.disableOmo).toHaveBeenCalledWith(omo);
    expect(actions.add).not.toHaveBeenCalled();
  });
});

async function openMenu(presentation: CardPresentation) {
  const user = userEvent.setup();
  render(
    <ProviderCardActions
      providerName="Kimi"
      presentation={presentation}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "providerCard.action.more" }),
  );
  return { user, menu: await screen.findByRole("menu") };
}

describe("ProviderCardActions — mode items in the more menu", () => {
  it("lists them first", async () => {
    const onSelect = vi.fn();
    const { user, menu } = await openMenu({
      buttons: [],
      chips: [],
      menuItems: [
        {
          key: "setDefault",
          label: "providerCard.action.setDefault",
          onSelect,
        },
      ],
    });

    const items = within(menu).getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("providerCard.action.setDefault");
    expect(items).toHaveLength(1);
    await user.click(items[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "provider.duplicate" }),
    ).toBeInTheDocument();
  });

  it("keeps a disabled one listed with its reason", async () => {
    const onSelect = vi.fn();
    const { user, menu } = await openMenu({
      buttons: [],
      chips: [],
      menuItems: [
        {
          key: "setDefault",
          label: "providerCard.action.setDefault",
          disabledReason: "providerCard.reason.defaultWhileRouting",
          onSelect,
        },
      ],
    });

    const item = within(menu).getAllByRole("menuitem")[0];
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("providerCard.reason.defaultWhileRouting");
    await user.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("exposes every common action directly without a more menu", async () => {
    const user = userEvent.setup();
    const actions = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onTest: vi.fn(),
      onConfigureUsage: vi.fn(),
      onOpenTerminal: vi.fn(),
    };
    render(
      <ProviderCardActions
        providerName="Kimi"
        presentation={{ buttons: [], chips: [] }}
        {...actions}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "providerCard.action.more" }),
    ).not.toBeInTheDocument();
    for (const [label, callback] of [
      ["providerCard.action.edit", actions.onEdit],
      ["provider.duplicate", actions.onDuplicate],
      ["provider.connectivityCheck", actions.onTest],
      ["provider.configureUsage", actions.onConfigureUsage],
      ["provider.openTerminal", actions.onOpenTerminal],
      ["common.delete", actions.onDelete],
    ] as const) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(callback).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps connectivity and usage controls disabled when their actions are unavailable", async () => {
    const user = userEvent.setup();
    renderActions({ buttons: [], chips: [] });
    for (const label of [
      "provider.connectivityCheck",
      "provider.configureUsage",
    ]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toBeDisabled();
      await user.click(button);
      expect(button).toBeDisabled();
    }
  });

  it("keeps disabled direct actions focusable and explains why they cannot run", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ProviderCardActions
        providerName="Managed"
        presentation={{
          chips: [],
          buttons: [
            {
              key: "switch",
              label: "Switch provider",
              onClick: onSwitch,
              disabledReason: "Needs routing",
            },
          ],
          editDisabledReason: "Managed externally",
          deleteDisabledReason: "Currently active",
        }}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    for (const [label, reason] of [
      ["Switch provider", "Needs routing"],
      ["providerCard.action.edit", "Managed externally"],
      ["common.delete", "Currently active"],
    ]) {
      const button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(reason);
      await user.click(button);
    }
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("uses a visible text switch button and keeps connectivity testing disabled while running", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    const onTest = vi.fn();
    render(
      <ProviderCardActions
        providerName="Kimi"
        presentation={{
          chips: [],
          buttons: [
            { key: "switch", label: "Switch provider", onClick: onSwitch },
          ],
        }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onTest={onTest}
        isTesting
      />,
    );
    const button = screen.getByRole("button", { name: "Switch provider" });
    expect(button).toHaveTextContent("Switch provider");
    await user.click(button);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    const testButton = screen.getByRole("button", {
      name: "provider.connectivityCheck",
    });
    expect(testButton).toBeDisabled();
    await user.click(testButton);
    expect(onTest).not.toHaveBeenCalled();
  });

  it("keeps model selection on the set-default button wired to its exact handler", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ProviderCardActions
        providerName="Kimi"
        presentation={{
          chips: [],
          buttons: [
            {
              key: "setDefault",
              label: "Set default",
              onClick: vi.fn(),
              menu: {
                title: "Choose model",
                options: [
                  {
                    key: "model-a",
                    label: "Model A",
                    detail: "model-a",
                    onSelect,
                  },
                ],
              },
            },
          ],
        }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Set default" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Model A model-a" }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
