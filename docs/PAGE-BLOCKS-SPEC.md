# Page Blocks Spec

This document describes the first structured block system for `pages`.

It complements the implemented `pages` API:

- `pages` now support embedded `blocks[]`
- `pages` include `isHomepage` metadata with scoped uniqueness:
  - one global homepage
  - one homepage per domain
- page create/update requests may omit `blocks` or send `blocks: []`
- public page reads include block data
- admin editing should use raw page reads from `GET /pages/admin/:id`
- this file is the source of truth for block shapes and editor behavior

Related docs:

- `docs/ADMIN-WEB-API.md`
- `docs/ADMIN-UI-SPEC.md`
- `docs/ADMIN-API-EXAMPLES.md`

---

## 1. Design Goals

The block model should:

- keep the number of block types small
- separate content from layout
- reuse shared sub-objects instead of duplicating shapes
- support both domain pages and global pages
- stay simple enough for an admin editor UI

One specific requirement for the first version:

- `richText` must support related people with a custom label such as `Authors`

Example:

```ts
{
  type: 'richText',
  title: 'Article title',
  description: 'Long-form content...',
  relatedPeople: {
    title: 'Authors',
    peopleIds: ['person-1', 'person-2'],
    display: 'inline'
  }
}
```

---

## 2. Common Block Shape

Every block should share these fields:

```ts
type PageBlockBase = {
  id: string;
  type: string;
  variant?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  isVisible?: boolean;
  anchorId?: string;
  theme?: string;
  paddingTop?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  paddingBottom?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
};
```

Notes:

- `description` is the main rich text / body field for blocks that need it
- `variant` is block-specific and should not replace `type`
- `theme` should stay token-based, not raw design values, where possible

---

## 3. Shared Sub-Objects

### 3.1 Button

```ts
type BlockButton = {
  label: string;
  type: 'page' | 'domain' | 'external' | 'application';
  targetId?: string;
  url?: string;
  openInNewTab?: boolean;
  style?: 'primary' | 'secondary' | 'ghost' | 'link';
};
```

Rules:

- `external` requires `url`
- internal button types require `targetId`
- do not store both internal `targetId` and external `url`

### 3.2 Media Reference

```ts
type MediaRef = {
  mediaId: string;
  alt?: string;
  caption?: string;
};
```

### 3.3 Entity Selection

```ts
type EntitySelection = {
  items: string[];
};
```

Rules:

- v1 is manual-only
- order is preserved from `items`

### 3.4 Related People Group

This is the new reusable shape needed for `richText`.

```ts
type RelatedPeopleGroup = {
  title: string;
  peopleIds: string[];
  display?: 'inline' | 'chips' | 'list';
};
```

Purpose:

- compact editorial relationships inside content blocks
- good for use cases like `Authors`, `Editors`, `Experts`, `Contributors`

Rules:

- `title` is required if `relatedPeople` exists
- `peopleIds` must be a non-empty ordered list of `people` ids
- keep this people-only in v1
- `display` defaults to `inline`
- rendering should preserve the order of `peopleIds`
- if mixed entities are needed later, use a dedicated entity block instead of overloading `richText`

---

## 4. Recommended Block Types

## 4.1 `richText`

Use this instead of the original broad “Text Block”.

```ts
type RichTextBlock = PageBlockBase & {
  type: 'richText';
  variant?: 'section' | 'block' | 'element';
  media?: MediaRef;
  mediaPosition?: 'left' | 'right' | 'top' | 'bottom';
  buttons?: BlockButton[];
  relatedPeople?: RelatedPeopleGroup;
};
```

Why this works:

- covers text + media + CTA needs
- keeps people attribution lightweight
- avoids mixing full entity collections into a simple content block

Recommended usage:

- articles
- explanatory sections
- editorial intros
- biographies with author attribution

Important rule:

- `richText` may include `relatedPeople`, but should not become a generic mixed-entity container
- if the page needs a visible section of cards/slides for people or partners, use `entityCollection`
- `description` is stored as sanitized HTML in v1

Future public rendering rules:

- resolve people by id and render their names in the order defined by `peopleIds`
- omit missing or unpublished people from public output
- if no related people remain after resolution, do not render the `relatedPeople` section

### Example

```ts
{
  id: 'block-1',
  type: 'richText',
  title: 'Gestalt and Modern Practice',
  subtitle: 'A short editorial introduction',
  description: '<p>Long-form rich text content...</p>',
  media: {
    mediaId: 'media-1',
    alt: 'Illustration'
  },
  mediaPosition: 'right',
  relatedPeople: {
    title: 'Authors',
    peopleIds: ['person-1', 'person-2'],
    display: 'inline'
  },
  buttons: [
    {
      label: 'Apply',
      type: 'application',
      targetId: 'program_enrollment',
      style: 'primary'
    }
  ]
}
```

## 4.2 `entityCollection`

This replaces separate list/slider/carousel block types.

```ts
type EntityCollectionBlock = PageBlockBase & {
  type: 'entityCollection';
  entityType: 'people' | 'partners' | 'events';
  layout: 'list' | 'grid' | 'slider' | 'carousel';
  items: string[];
  cardVariant?: string;
};
```

Use this instead of:

- Element List
- Element Slider
- Element Carousel
- standalone Event list

Reason:

- those differ mostly by layout, not by content model
- dynamic query-driven collections are explicitly deferred

## 4.3 `cta`

```ts
type CtaBlock = PageBlockBase & {
  type: 'cta';
  backgroundStyle?: string;
  buttons: BlockButton[];
};
```

## 4.4 `hero`

```ts
type HeroBlock = PageBlockBase & {
  type: 'hero';
  backgroundMedia?: MediaRef;
  overlayStyle?: string;
  buttons?: BlockButton[];
  items?: Array<{
    icon?: string;
    title: string;
    subtitle?: string;
    button?: BlockButton;
  }>;
};
```

## 4.5 `applicationForm`

```ts
type ApplicationFormBlock = PageBlockBase & {
  type: 'applicationForm';
  applicationType:
    | 'partnership'
    | 'program_enrollment'
    | 'event_registration'
    | 'corporate_training'
    | 'specialist_request'
    | 'general';
  successMessage?: string;
  buttonLabel?: string;
};
```

## 4.6 `gallery`

```ts
type GalleryBlock = PageBlockBase & {
  type: 'gallery';
  layout?: 'grid' | 'masonry' | 'slider';
  items: Array<{
    mediaId: string;
    title?: string;
    subtitle?: string;
  }>;
};
```

## 4.7 `linkGroup`

```ts
type LinkGroupBlock = PageBlockBase & {
  type: 'linkGroup';
  layout?: 'list' | 'grid' | 'inline';
  links: BlockButton[];
};
```

## 4.8 `statGroup`

```ts
type StatGroupBlock = PageBlockBase & {
  type: 'statGroup';
  items: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: string;
  }>;
};
```

---

## 5. What Changed from the Original Draft

Main refinements:

- `Element List`, `Element Slider`, and `Element Carousel` are merged into one `entityCollection` block with a `layout` field
- `Event list` becomes a specific use of `entityCollection` with `entityType='events'`
- `Text Block` becomes `richText`
- `richText` now supports `relatedPeople` with a title like `Authors`
- “linked entities” are not mixed into `richText` beyond this compact people-attribution use case

This keeps `richText` useful for editorial content without turning it into a second generic collection block.

---

## 6. Suggested Admin UI Controls

For `richText.relatedPeople`:

- `title`
  UI: text input
  Example placeholder: `Authors`
- `peopleIds`
  UI: ordered multi-select using `people`
- `display`
  UI: select
  Options:
  - `inline`
  - `chips`
  - `list`

Recommended behavior:

- show a compact preview:
  - `Authors: Alice Smith, John Doe`
- only allow published people in public page rendering unless preview mode explicitly needs drafts
- keep this as a lightweight attribution row, not a card layout

---

## 7. Recommended First Backend Scope

Implemented v1 block set:

- `richText`
- `entityCollection`
- `cta`
- `hero`
- `applicationForm`
- `gallery`

Deferred:

- `linkGroup`
- `statGroup`

This gives enough coverage for most marketing/editorial pages without overbuilding the first release.

---

## 8. `richText.relatedPeople` Acceptance Notes

When block support is implemented, add tests for:

- valid `richText` block with `relatedPeople`
- reject `relatedPeople` without `title`
- reject `relatedPeople` with empty `peopleIds`
- preserve person order from `peopleIds`
- default `display` to `inline`
- resolve and render multiple people correctly
- omit missing or unpublished people from public rendering
- omit the whole `relatedPeople` section if no resolved people remain
