import { BadRequestException } from '@nestjs/common';
import { PageBlockType } from '../enums/page-block-type.enum';
import { PageRootBlock } from '../types/page-block.interface';

type BlockRecord = Record<string, unknown>;

function isRecord(value: unknown): value is BlockRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function childBlocks(block: BlockRecord): BlockRecord[] {
  const children: BlockRecord[] = [];
  const addButtonBlock = (button: unknown) => {
    if (!isRecord(button) || !isRecord(button.block)) {
      return;
    }
    children.push(button.block);
  };

  if (block.type === PageBlockType.Group && Array.isArray(block.blocks)) {
    for (const child of block.blocks) {
      if (isRecord(child)) children.push(child);
    }
  }

  if (Array.isArray(block.buttons)) {
    block.buttons.forEach(addButtonBlock);
  }
  if (Array.isArray(block.items)) {
    for (const item of block.items) {
      if (isRecord(item)) {
        if (Array.isArray(item.buttons)) item.buttons.forEach(addButtonBlock);
        else addButtonBlock(item.button);
      }
    }
  }
  if (Array.isArray(block.customItems)) {
    for (const item of block.customItems) {
      if (isRecord(item)) addButtonBlock(item.button);
    }
  }
  if (Array.isArray(block.snippets)) {
    for (const snippet of block.snippets) {
      if (isRecord(snippet)) addButtonBlock(snippet.button);
    }
  }

  return children;
}

function indexBlocks(blocks: unknown[]): Map<string, BlockRecord[]> {
  const index = new Map<string, BlockRecord[]>();
  const visit = (value: unknown) => {
    if (!isRecord(value)) return;
    if (typeof value.id === 'string' && value.id.trim()) {
      const matches = index.get(value.id) || [];
      matches.push(value);
      index.set(value.id, matches);
    }
    childBlocks(value).forEach(visit);
  };
  blocks.forEach(visit);
  return index;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// TODO(2026-11-14): Review removing this deploy-transition shim only after the
// API-first rollout is complete and pre-web admin sessions have aged out.
export function preserveOmittedHtmlSnippets(
  incomingBlocks: PageRootBlock[],
  existingBlocks: unknown[],
): PageRootBlock[] {
  const existingById = indexBlocks(existingBlocks);
  const incomingById = indexBlocks(incomingBlocks);

  const visit = (value: unknown): unknown => {
    if (!isRecord(value)) return value;

    let next: BlockRecord = value;
    if (
      value.type === PageBlockType.Html &&
      !Object.prototype.hasOwnProperty.call(value, 'snippets')
    ) {
      const id = typeof value.id === 'string' ? value.id.trim() : '';
      if (!id) {
        throw new BadRequestException(
          'Cannot preserve omitted HTML snippets without a stable block id',
        );
      }
      if ((incomingById.get(id)?.length || 0) > 1) {
        throw new BadRequestException(
          `Cannot preserve omitted HTML snippets for ambiguous block id: ${id}`,
        );
      }

      const matches = existingById.get(id) || [];
      if (matches.length > 1) {
        throw new BadRequestException(
          `Cannot preserve omitted HTML snippets for ambiguous existing block id: ${id}`,
        );
      }
      if (matches.length === 1) {
        const [match] = matches;
        if (match.type !== PageBlockType.Html) {
          throw new BadRequestException(
            `Cannot preserve omitted HTML snippets for mismatched block id: ${id}`,
          );
        }
        if (
          Object.prototype.hasOwnProperty.call(match, 'snippets') &&
          match.snippets !== undefined
        ) {
          next = { ...value, snippets: cloneValue(match.snippets) };
        }
      }
    }

    const rewriteButton = (button: unknown): unknown => {
      if (!isRecord(button) || !isRecord(button.block)) return button;
      return { ...button, block: visit(button.block) };
    };

    if (next.type === PageBlockType.Group && Array.isArray(next.blocks)) {
      next = { ...next, blocks: next.blocks.map(visit) };
    }
    if (Array.isArray(next.buttons)) {
      next = { ...next, buttons: next.buttons.map(rewriteButton) };
    }
    if (Array.isArray(next.items)) {
      next = {
        ...next,
        items: next.items.map((item) =>
          isRecord(item) && Array.isArray(item.buttons)
            ? { ...item, buttons: item.buttons.map(rewriteButton) }
            : isRecord(item) && item.button
            ? { ...item, button: rewriteButton(item.button) }
            : item,
        ),
      };
    }
    if (Array.isArray(next.customItems)) {
      next = {
        ...next,
        customItems: next.customItems.map((item) =>
          isRecord(item) && item.button
            ? { ...item, button: rewriteButton(item.button) }
            : item,
        ),
      };
    }
    if (Array.isArray(next.snippets)) {
      next = {
        ...next,
        snippets: next.snippets.map((snippet) =>
          isRecord(snippet) && snippet.button
            ? { ...snippet, button: rewriteButton(snippet.button) }
            : snippet,
        ),
      };
    }

    return next;
  };

  return incomingBlocks.map((block) => visit(block) as PageRootBlock);
}
