import * as React from 'react';
import classNames from 'classnames';
import ResizeObserver from 'rc-resize-observer';
import Item from './Item';
import { useBatchFrameState } from './hooks/useBatchFrameState';

const RESPONSIVE = 'responsive' as const;

export interface OverflowProps<ItemType> {
  prefixCls?: string;
  className?: string;
  style?: React.CSSProperties;
  data?: ItemType[];
  itemKey?: React.Key | ((item: ItemType) => React.Key);
  /** Used for `responsive`. It will limit render node to avoid perf issue */
  itemWidth?: number;
  renderItem?: (item: ItemType) => React.ReactNode;
  maxCount?: number | typeof RESPONSIVE;
}

function Overflow<ItemType = any>(
  props: OverflowProps<ItemType>,
  ref: React.Ref<HTMLDivElement>,
) {
  const {
    prefixCls = 'rc-overflow',
    data = [],
    renderItem,
    itemKey,
    itemWidth = 10,
    style,
    className,
    maxCount,
  } = props;

  const createUseState = useBatchFrameState();
  // const disabled = maxCount !== RESPONSIVE;

  const [containerWidth, setContainerWidth] = createUseState(0);
  const [itemWidths, setItemWidths] = createUseState(
    new Map<React.Key, number>(),
  );
  const [restWidth, setRestWidth] = createUseState(0);

  const [displayCount, setDisplayCount] = React.useState(0);
  const [restReady, setRestReady] = React.useState(false);

  const itemPrefixCls = `${prefixCls}-item`;

  // ================================= Data =================================
  const isResponsive = maxCount === RESPONSIVE;

  const mergedData = React.useMemo(() => {
    if (isResponsive) {
      return data.slice(0, Math.min(data.length, containerWidth / itemWidth));
    }
    return data;
  }, [data, itemWidth, containerWidth, maxCount]);

  // ================================= Item =================================
  const getKey = React.useCallback(
    (item: ItemType, index: number) => {
      if (typeof itemKey === 'function') {
        return itemKey(item);
      }
      return (itemKey && (item as any)?.[itemKey]) ?? index;
    },
    [itemKey],
  );

  const mergedRenderItem = React.useCallback(
    renderItem || ((item: ItemType) => item),
    [renderItem],
  );

  function updateDisplayCount(count: number, notReady?: boolean) {
    setDisplayCount(count);
    if (!notReady) {
      setRestReady(count < data.length - 1);
    }
  }

  // ================================= Size =================================
  function onOverflowResize(_: object, element: HTMLElement) {
    setContainerWidth(element.clientWidth);
  }

  function registerSize(key: React.Key, width: number) {
    setItemWidths((origin) => {
      const clone = new Map(origin);

      if (!width) {
        clone.delete(key);
      } else {
        clone.set(key, width);
      }
      return clone;
    });
  }

  function registerOverflowSize(_: React.Key, width: number) {
    setRestWidth(width);
  }

  // ================================ Effect ================================
  React.useLayoutEffect(() => {
    if (containerWidth && restWidth && mergedData) {
      let totalWidth = 0;

      const len = mergedData.length;

      for (let i = 0; i < len; i += 1) {
        const currentItemWidth = itemWidths.get(getKey(mergedData[i], i));

        // Break since data not ready
        if (currentItemWidth === undefined) {
          updateDisplayCount(i - 1, true);
          break;
        }

        // Find best match
        totalWidth += currentItemWidth;

        if (totalWidth + restWidth > containerWidth) {
          updateDisplayCount(i - 1);
          break;
        } else if (i === len - 1) {
          updateDisplayCount(len - 1);
          break;
        }
      }
    }
  }, [containerWidth, itemWidths, restWidth, getKey, mergedData]);

  // ================================ Render ================================
  let overflowNode = (
    <div className={classNames(prefixCls, className)} style={style} ref={ref}>
      {mergedData.map((item, index) => {
        const key = getKey(item, index);

        return (
          <Item<ItemType>
            order={index}
            key={key}
            item={item}
            prefixCls={itemPrefixCls}
            renderItem={mergedRenderItem}
            itemKey={key}
            registerSize={registerSize}
            responsive={isResponsive}
            display={index <= displayCount}
          />
        );
      })}

      {/* Rest Count Item */}
      <Item
        order={displayCount}
        prefixCls={itemPrefixCls}
        className={`${itemPrefixCls}-rest`}
        responsive={isResponsive}
        registerSize={registerOverflowSize}
        display={restReady}
      >
        Overflow
      </Item>
    </div>
  );

  if (isResponsive) {
    overflowNode = (
      <ResizeObserver onResize={onOverflowResize}>
        {overflowNode}
      </ResizeObserver>
    );
  }

  return overflowNode;
}

const ForwardOverflow = React.forwardRef(Overflow);

ForwardOverflow.displayName = 'Overflow';

// Convert to generic type
export default ForwardOverflow as <ItemType = any>(
  props: React.PropsWithChildren<OverflowProps<ItemType>> & {
    ref?: React.Ref<HTMLDivElement>;
  },
) => React.ReactElement;