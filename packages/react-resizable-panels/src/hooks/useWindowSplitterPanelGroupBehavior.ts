import { isDevelopment } from "#is-development";
import { PanelData } from "../Panel";
import { Direction } from "../types";
import { adjustLayoutByDelta } from "../utils/adjustLayoutByDelta";
import { assert } from "../utils/assert";
import { calculateAriaValues } from "../utils/calculateAriaValues";
import { determinePivotIndices } from "../utils/determinePivotIndices";
import { getPanelGroupElement } from "../utils/dom/getPanelGroupElement";
import { getResizeHandleElementsForGroup } from "../utils/dom/getResizeHandleElementsForGroup";
import { getResizeHandlePanelIds } from "../utils/dom/getResizeHandlePanelIds";
import { fuzzyNumbersEqual } from "../utils/numbers/fuzzyNumbersEqual";
import { RefObject, useEffect, useRef } from "../vendor/react";
import useIsomorphicLayoutEffect from "./useIsomorphicEffect";

// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/

export function useWindowSplitterPanelGroupBehavior({
  committedValuesRef,
  eagerValuesRef,
  groupId,
  layout,
  panelDataArray,
  setLayout,
}: {
  committedValuesRef: RefObject<{
    direction: Direction;
  }>;
  eagerValuesRef: RefObject<{
    panelDataArray: PanelData[];
  }>;
  groupId: string;
  layout: number[];
  panelDataArray: PanelData[];
  setLayout: (sizes: number[]) => void;
}): void {
  const devWarningsRef = useRef<{
    didWarnAboutMissingResizeHandle: boolean;
  }>({
    didWarnAboutMissingResizeHandle: false,
  });

  useIsomorphicLayoutEffect(() => {
    const resizeHandleElements = getResizeHandleElementsForGroup(groupId);

    for (let index = 0; index < panelDataArray.length - 1; index++) {
      const { valueMax, valueMin, valueNow } = calculateAriaValues({
        layout,
        panelsArray: panelDataArray,
        pivotIndices: [index, index + 1],
      });

      const resizeHandleElement = resizeHandleElements[index];
      if (resizeHandleElement == null) {
        if (isDevelopment) {
          const { didWarnAboutMissingResizeHandle } = devWarningsRef.current;

          if (!didWarnAboutMissingResizeHandle) {
            devWarningsRef.current.didWarnAboutMissingResizeHandle = true;

            console.warn(
              `WARNING: Missing resize handle for PanelGroup "${groupId}"`
            );
          }
        }
      } else {
        const panelData = panelDataArray[index];
        assert(panelData);

        resizeHandleElement.setAttribute("aria-controls", panelData.id);
        resizeHandleElement.setAttribute(
          "aria-valuemax",
          "" + Math.round(valueMax)
        );
        resizeHandleElement.setAttribute(
          "aria-valuemin",
          "" + Math.round(valueMin)
        );
        resizeHandleElement.setAttribute(
          "aria-valuenow",
          valueNow != null ? "" + Math.round(valueNow) : ""
        );
      }
    }

    return () => {
      resizeHandleElements.forEach((resizeHandleElement, index) => {
        resizeHandleElement.removeAttribute("aria-controls");
        resizeHandleElement.removeAttribute("aria-valuemax");
        resizeHandleElement.removeAttribute("aria-valuemin");
        resizeHandleElement.removeAttribute("aria-valuenow");
      });
    };
  }, [groupId, layout, panelDataArray]);

  useEffect(() => {
    const eagerValues = eagerValuesRef.current;
    assert(eagerValues);

    const { panelDataArray } = eagerValues;

    const groupElement = getPanelGroupElement(groupId);
    assert(groupElement != null, `No group found for id "${groupId}"`);

    const handles = getResizeHandleElementsForGroup(groupId);
    assert(handles);

    const cleanupFunctions = handles.map((handle) => {
      const handleId = handle.getAttribute("data-panel-resize-handle-id");
      assert(handleId);

      const [idBefore, idAfter] = getResizeHandlePanelIds(
        groupId,
        handleId,
        panelDataArray
      );
      if (idBefore == null || idAfter == null) {
        return () => {};
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
          return;
        }

        switch (event.key) {
          case "Enter": {
            event.preventDefault();

            const index = panelDataArray.findIndex(
              (panelData) => panelData.id === idBefore
            );
            if (index >= 0) {
              const panelData = panelDataArray[index];
              assert(panelData);

              const size = layout[index];

              const {
                collapsedSize = 0,
                collapsible,
                minSize = 0,
              } = panelData.constraints;

              if (size != null && collapsible) {
                const nextLayout = adjustLayoutByDelta({
                  delta: fuzzyNumbersEqual(size, collapsedSize)
                    ? minSize - collapsedSize
                    : collapsedSize - size,
                  layout,
                  panelConstraints: panelDataArray.map(
                    (panelData) => panelData.constraints
                  ),
                  pivotIndices: determinePivotIndices(groupId, handleId),
                  trigger: "keyboard",
                });
                if (layout !== nextLayout) {
                  setLayout(nextLayout);
                }
              }
            }
            break;
          }
        }
      };

      handle.addEventListener("keydown", onKeyDown);

      return () => {
        handle.removeEventListener("keydown", onKeyDown);
      };
    });

    return () => {
      cleanupFunctions.forEach((cleanupFunction) => cleanupFunction());
    };
  }, [
    committedValuesRef,
    eagerValuesRef,
    groupId,
    layout,
    panelDataArray,
    setLayout,
  ]);
}
