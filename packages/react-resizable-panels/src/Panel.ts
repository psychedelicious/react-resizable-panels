import { isBrowser } from "#is-browser";
import { isDevelopment } from "#is-development";
import { PanelGroupContext } from "./PanelGroupContext";
import useIsomorphicLayoutEffect from "./hooks/useIsomorphicEffect";
import useUniqueId from "./hooks/useUniqueId";
import {
  ForwardedRef,
  HTMLAttributes,
  PropsWithChildren,
  createElement,
  forwardRef,
  useContext,
  useImperativeHandle,
  useRef,
  RefObject,
} from "./vendor/react";

export type PanelOnCollapse = () => void;
export type PanelOnExpand = () => void;
export type PanelOnResize = (
  size: number,
  prevSize: number | undefined
) => void;

export type PanelCallbacks = {
  onCollapse?: PanelOnCollapse;
  onExpand?: PanelOnExpand;
  onResize?: PanelOnResize;
};

export type PanelConstraints = {
  collapsedSize?: number | undefined;
  collapsible?: boolean | undefined;
  defaultSize?: number | undefined;
  maxSize?: number | undefined;
  minSize?: number | undefined;
};

export type PanelData = {
  callbacks: PanelCallbacks;
  constraints: PanelConstraints;
  id: string;
  idIsFromProps: boolean;
  order: number | undefined;
};

export type ImperativePanelHandle<
  T extends keyof HTMLElementTagNameMap = "div",
> = {
  collapse: () => void;
  expand: () => void;
  getId(): string;
  getSize(): number;
  isCollapsed: () => boolean;
  isExpanded: () => boolean;
  resize: (size: number) => void;
  elementRef: RefObject<HTMLElementTagNameMap[T]>;
};

export type PanelProps<T extends keyof HTMLElementTagNameMap = "div"> = Omit<
  HTMLAttributes<T>,
  "id" | "onResize"
> &
  PropsWithChildren<{
    className?: string;
    collapsedSize?: number | undefined;
    collapsible?: boolean | undefined;
    defaultSize?: number | undefined;
    id?: string;
    maxSize?: number | undefined;
    minSize?: number | undefined;
    onCollapse?: PanelOnCollapse;
    onExpand?: PanelOnExpand;
    onResize?: PanelOnResize;
    order?: number;
    style?: object;
    tagName?: T;
  }>;

export function PanelWithForwardedRef<
  T extends keyof HTMLElementTagNameMap = "div",
>({
  children,
  className: classNameFromProps = "",
  collapsedSize,
  collapsible,
  defaultSize,
  forwardedRef,
  id: idFromProps,
  maxSize,
  minSize,
  onCollapse,
  onExpand,
  onResize,
  order,
  style: styleFromProps,
  tagName: Type = "div" as T,
  ...rest
}: PanelProps<T> & {
  forwardedRef: ForwardedRef<ImperativePanelHandle<T>>;
}) {
  const context = useContext(PanelGroupContext);
  if (context === null) {
    throw Error(
      `Panel components must be rendered within a PanelGroup container`
    );
  }

  const {
    collapsePanel,
    expandPanel,
    getPanelSize,
    getPanelStyle,
    groupId,
    isPanelCollapsed,
    registerPanel,
    resizePanel,
    unregisterPanel,
  } = context;

  const panelId = useUniqueId(idFromProps);

  const panelElementRef = useRef<HTMLElementTagNameMap[T]>(null);

  const panelDataRef = useRef<PanelData>({
    callbacks: {
      onCollapse,
      onExpand,
      onResize,
    },
    constraints: {
      collapsedSize,
      collapsible,
      defaultSize,
      maxSize,
      minSize,
    },
    id: panelId,
    idIsFromProps: idFromProps !== undefined,
    order,
  });

  const devWarningsRef = useRef<{
    didLogMissingDefaultSizeWarning: boolean;
  }>({
    didLogMissingDefaultSizeWarning: false,
  });

  // Normally we wouldn't log a warning during render,
  // but effects don't run on the server, so we can't do it there
  if (isDevelopment) {
    if (!devWarningsRef.current.didLogMissingDefaultSizeWarning) {
      if (!isBrowser && defaultSize == null) {
        devWarningsRef.current.didLogMissingDefaultSizeWarning = true;
        console.warn(
          `WARNING: Panel defaultSize prop recommended to avoid layout shift after server rendering`
        );
      }
    }
  }

  useIsomorphicLayoutEffect(() => {
    const { callbacks, constraints } = panelDataRef.current;

    panelDataRef.current.id = panelId;
    panelDataRef.current.idIsFromProps = idFromProps !== undefined;
    panelDataRef.current.order = order;

    callbacks.onCollapse = onCollapse;
    callbacks.onExpand = onExpand;
    callbacks.onResize = onResize;

    constraints.collapsedSize = collapsedSize;
    constraints.collapsible = collapsible;
    constraints.defaultSize = defaultSize;
    constraints.maxSize = maxSize;
    constraints.minSize = minSize;
  });

  useIsomorphicLayoutEffect(() => {
    const panelData = panelDataRef.current;

    registerPanel(panelData);

    return () => {
      unregisterPanel(panelData);
    };
  }, [order, panelId, registerPanel, unregisterPanel]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      collapse: () => {
        collapsePanel(panelDataRef.current);
      },
      expand: () => {
        expandPanel(panelDataRef.current);
      },
      getId() {
        return panelId;
      },
      getSize() {
        return getPanelSize(panelDataRef.current);
      },
      isCollapsed() {
        return isPanelCollapsed(panelDataRef.current);
      },
      isExpanded() {
        return !isPanelCollapsed(panelDataRef.current);
      },
      resize: (size: number) => {
        resizePanel(panelDataRef.current, size);
      },
      elementRef: panelElementRef,
    }),
    [
      collapsePanel,
      expandPanel,
      getPanelSize,
      isPanelCollapsed,
      panelId,
      resizePanel,
    ]
  );

  const style = getPanelStyle(panelDataRef.current, defaultSize);

  return createElement(Type, {
    ...rest,

    children,
    className: classNameFromProps,
    style: {
      ...style,
      ...styleFromProps,
    },
    ref: panelElementRef,

    // CSS selectors
    "data-panel": "",
    "data-panel-id": panelId,
    "data-panel-group-id": groupId,

    // e2e test attributes
    "data-panel-collapsible": isDevelopment
      ? collapsible || undefined
      : undefined,
    "data-panel-size": isDevelopment
      ? parseFloat("" + style.flexGrow).toFixed(1)
      : undefined,
  });
}

export const Panel = forwardRef<
  ImperativePanelHandle<keyof HTMLElementTagNameMap>,
  PanelProps
>(
  (
    props: PanelProps,
    ref: ForwardedRef<ImperativePanelHandle<keyof HTMLElementTagNameMap>>
  ) => createElement(PanelWithForwardedRef, { ...props, forwardedRef: ref })
);

PanelWithForwardedRef.displayName = "Panel";
Panel.displayName = "forwardRef(Panel)";
