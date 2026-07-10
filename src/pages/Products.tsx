import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProductTags, type ProductTagMap } from '../services/adminApi';
import '../styles/Products.css';

interface Tool {
  key: string;
  to: string;
  tag: string;
  tagVariant: 'live' | 'soon' | 'later';
  icon: string;
  title: string;
  description: string;
  features: string[];
}

// `tag`/`tagVariant` here are only FALLBACKS — the live values come from the
// backend product config (editable in the admin dashboard, no deploy needed).
const TOOLS: Tool[] = [
  {
    key: 'page-numbering',
    to: '/tools/page-numbering',
    tag: 'Live',
    tagVariant: 'live',
    icon: '§',
    title: 'Page Numbering',
    description: 'Stamp clean sequential page numbers across one or many merged PDFs.',
    features: ['Merge multiple volumes', 'Skip index pages', 'Continuous numbering'],
  },
  {
    key: 'annexures',
    to: '/tools/annexures',
    tag: 'Live',
    tagVariant: 'live',
    icon: '¶',
    title: 'Annexures',
    description:
      'Append annexure files with auto-stamped labels (A-1, A-2, …) and continuous pagination.',
    features: ['Up to 20 annexures', 'First-page stamping', 'Order control'],
  },
  {
    key: 'signatures',
    to: '/tools/signatures',
    tag: 'Live',
    tagVariant: 'live',
    icon: '✎',
    title: 'Signatures',
    description: 'Stamp client and advocate signatures on every annexure page footer in one pass.',
    features: ['PNG / JPG inputs', 'Smart placement', 'Client + advocate'],
  },
  {
    key: 'bookmarks',
    to: '/tools/bookmarks',
    tag: 'New',
    tagVariant: 'live',
    icon: '🔖',
    title: 'Bookmarks',
    description:
      'Auto-detect chapters, sections and annexures — review the outline, then download a PDF with clickable bookmarks.',
    features: ['Smart heading detection', 'Review & edit before apply', 'Nested hierarchy'],
  },
  {
    key: 'index-generator',
    to: '/tools/index-generator',
    tag: 'New',
    tagVariant: 'live',
    icon: '☰',
    title: 'Index Generator',
    description:
      'Type the case details, list the contents, and download a court-ready Master Index page.',
    features: ['NCLT / court filing format', 'Auto-fill rows from PDF', 'Attach to document'],
  },
  {
    key: 'document-prep',
    to: '/prep',
    tag: 'Full Pipeline',
    tagVariant: 'soon',
    icon: '◆',
    title: 'Document Prep',
    description:
      'Run all three stages with a guided wizard — clickable breadcrumb lets you skip and revisit.',
    features: ['Number → Annex → Sign', 'Jump between steps', 'Single output PDF'],
  },
];

export default function Products() {
  const [tagOverrides, setTagOverrides] = useState<ProductTagMap>({});

  useEffect(() => {
    fetchProductTags().then(setTagOverrides);
  }, []);

  return (
    <main>
      <section className="products" id="suite">
        <header className="products__header">
          <p className="section-label">Product Suite</p>
          <h2 className="section-title">
            Pick a single tool.
            <br />
            Or run the full pipeline.
          </h2>
        </header>

        <div className="products__grid">
          {TOOLS.map((t) => {
            const o = tagOverrides[t.key];
            const tag = o?.tag ?? t.tag;
            const tagVariant = o?.tagVariant ?? t.tagVariant;
            return (
              <Link className="product-card" key={t.key} to={t.to}>
                <span className={`product-card__tag product-card__tag--${tagVariant}`}>{tag}</span>
                <span className="product-card__icon" role="img" aria-hidden="true">
                  {t.icon}
                </span>
                <h3 className="product-card__title">{t.title}</h3>
                <p className="product-card__desc">{t.description}</p>
                <ul className="product-card__features">
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

/** Product list shared with the admin tag editor — key + title + defaults. */
export const PRODUCT_DEFS = TOOLS.map(({ key, title, tag, tagVariant }) => ({
  key,
  title,
  tag,
  tagVariant,
}));
