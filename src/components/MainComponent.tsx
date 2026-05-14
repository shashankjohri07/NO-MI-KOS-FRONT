import { Link } from 'react-router-dom';
import '../styles/MainComponent.css';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

interface Tool {
  to: string;
  tag: string;
  tagVariant: 'live' | 'soon' | 'later';
  icon: string;
  title: string;
  description: string;
  features: string[];
}

const TOOLS: Tool[] = [
  {
    to: '/tools/page-numbering',
    tag: 'Live',
    tagVariant: 'live',
    icon: '§',
    title: 'Page Numbering',
    description: 'Stamp clean sequential page numbers across one or many merged PDFs.',
    features: ['Merge multiple volumes', 'Skip index pages', 'Continuous numbering'],
  },
  {
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
    to: '/tools/signatures',
    tag: 'Live',
    tagVariant: 'live',
    icon: '✎',
    title: 'Signatures',
    description: 'Stamp client and advocate signatures on every annexure page footer in one pass.',
    features: ['PNG / JPG inputs', 'Smart placement', 'Client + advocate'],
  },
  {
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

function Products() {
  return (
    <section className="products" id="suite">
      <header className="products__header">
        <SectionLabel>Product Suite</SectionLabel>
        <SectionTitle>
          Pick a single tool.
          <br />
          Or run the full pipeline.
        </SectionTitle>
      </header>

      <div className="products__grid">
        {TOOLS.map((t) => (
          <Link className="product-card" key={t.title} to={t.to}>
            <span className={`product-card__tag product-card__tag--${t.tagVariant}`}>{t.tag}</span>
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
        ))}
      </div>
    </section>
  );
}

export default function Main() {
  return (
    <main>
      <Products />
    </main>
  );
}
