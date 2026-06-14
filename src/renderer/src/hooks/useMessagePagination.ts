/**
 * 消息分页加载 Hook
 * 实现首屏加载最新消息，向上滚动时加载更多历史消息
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import type { ChatMessage } from "../../../shared/types";

interface MessagePaginationOptions {
  messages: ChatMessage[];
  initialPageSize?: number;
  pageSize?: number;
  maxVisibleMessages?: number;
  enabled?: boolean;
}

interface MessagePaginationResult {
  visibleMessages: ChatMessage[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  reset: () => void;
  totalCount: number;
  visibleCount: number;
}

const DEFAULT_INITIAL_PAGE_SIZE = 100; // 首屏加载最近100条消息
const DEFAULT_PAGE_SIZE = 100; // 每次加载100条历史消息
const DEFAULT_MAX_VISIBLE = Infinity; // 默认无限制，但分批加载

export function useMessagePagination({
  messages,
  initialPageSize = DEFAULT_INITIAL_PAGE_SIZE,
  pageSize = DEFAULT_PAGE_SIZE,
  maxVisibleMessages = DEFAULT_MAX_VISIBLE,
  enabled = true,
}: MessagePaginationOptions): MessagePaginationResult {
  const [visibleCount, setVisibleCount] = useState(initialPageSize);
  const [isLoading, setIsLoading] = useState(false);

  // 重置分页状态
  const reset = useCallback(() => {
    setVisibleCount(initialPageSize);
    setIsLoading(false);
  }, [initialPageSize]);

  // 当切换会话时重置
  useEffect(() => {
    if (messages.length === 0) {
      reset();
    }
  }, [messages.length === 0, reset]);

  // 当有新消息时，智能处理
  useEffect(() => {
    if (!enabled) return;

    // 新消息数量
    const newMessageCount = messages.length - visibleCount;

    // 如果有新消息且数量不多（<10条），自动显示
    if (newMessageCount > 0 && newMessageCount < 10) {
      setVisibleCount(messages.length);
    }
  }, [messages.length, visibleCount, enabled]);

  // 加载更多历史消息
  const loadMore = useCallback(() => {
    if (!enabled || isLoading) return;

    setIsLoading(true);

    // 模拟异步加载，使用 requestAnimationFrame 保持流畅
    requestAnimationFrame(() => {
      setVisibleCount((prev) => {
        const next = prev + pageSize;
        const capped = Math.min(next, maxVisibleMessages, messages.length);
        return capped;
      });
      setIsLoading(false);
    });
  }, [enabled, isLoading, pageSize, maxVisibleMessages, messages.length]);

  // 可见的消息列表（从末尾开始取）
  const visibleMessages = useMemo(() => {
    if (!enabled) return messages;

    const start = Math.max(0, messages.length - visibleCount);
    return messages.slice(start);
  }, [messages, visibleCount, enabled]);

  const hasMore = enabled && visibleCount < messages.length && visibleCount < maxVisibleMessages;

  return {
    visibleMessages,
    hasMore,
    loadMore,
    isLoading,
    reset,
    totalCount: messages.length,
    visibleCount: visibleMessages.length,
  };
}
