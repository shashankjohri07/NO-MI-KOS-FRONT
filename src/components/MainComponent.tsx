import {
  useProblemStats,
  useProducts,
  useHowSteps,
  useAudience,
  useTestimonials,
  usePricing,
} from '../context/ContentContext';
import '../styles/MainComponent.css';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="section-label">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

function Problem({ problemStats }: { problemStats: ReturnType<typeof useProblemStats> }) {
  return (
    <section className="problem" id="problem">
      <div className="problem__left">
        <SectionLabel>The Problem</SectionLabel>
        <SectionTitle>Indian court filings are structurally broken</SectionTitle>
        <p>
          Forum-specific rules, bench-level variations, hybrid digital-physical workflows — and no
          system to validate compliance before submission.
        </p>
        <p>
          Every defective filing costs a lawyer 12–15 hours. Multiplied across every matter, every
          month.
        </p>
        <div className="problem__highlight">
          <strong>One full-time legal resource</strong>
          <p>
            Lost every year — by mid-tier firms filing 4–8 matters a month — to procedural
            correction alone.
          </p>
        </div>
      </div>

      <div className="problem__stats">
        {problemStats.map(({ num, title, sub }) => (
          <div className="problem__stat" key={num}>
            <span className="problem__stat-num">{num}</span>
            <div className="problem__stat-text">
              <strong>{title}</strong>
              <span>{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Products({ products }: { products: ReturnType<typeof useProducts> }) {
  return (
    <section className="products" id="suite">
      <header className="products__header">
        <SectionLabel>Product Suite</SectionLabel>
        <SectionTitle>
          Four tools.
          <br />
          One intelligent platform.
        </SectionTitle>
      </header>

      <div className="products__grid">
        {products.map((p) => (
          <div className="product-card" key={p.title}>
            <span className={`product-card__tag product-card__tag--${p.tagVariant}`}>{p.tag}</span>
            <span className="product-card__icon" role="img" aria-hidden="true">
              {p.icon}
            </span>
            <h3 className="product-card__title">{p.title}</h3>
            <p className="product-card__desc">{p.description}</p>
            <ul className="product-card__features">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ howSteps }: { howSteps: ReturnType<typeof useHowSteps> }) {
  return (
    <section className="how" id="how">
      <SectionLabel>How It Works</SectionLabel>
      <SectionTitle>
        From draft to registry-ready
        <br />
        in minutes
      </SectionTitle>

      <div className="how__steps">
        {howSteps.map(({ num, title, body }) => (
          <div className="how__step" key={num}>
            <div className="how__step-num">{num}</div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>

      <div className="how__demo">
        <div className="how__demo-header">
          <span>NCLT Delhi — IBC Appeal</span>
          <span className="how__demo-badge">Reviewing</span>
        </div>
        {[
          ['Forum', 'NCLT, Delhi Bench'],
          ['Act', 'Insolvency & Bankruptcy Code, 2016'],
          ['Filing type', 'Appeal u/s 61(1) IBC'],
          ['Pagination', 'Checking index & annexures…'],
        ].map(([label, val]) => (
          <div className="how__demo-row" key={label}>
            <span className="how__demo-row-label">{label}</span>
            <span className="how__demo-row-val">{val}</span>
          </div>
        ))}
        <div className="how__demo-alert">⚠ Defect: Missing certified copy — Exhibit C</div>
        <div className="how__demo-score">
          <div className="how__demo-circle">
            <span>82</span>
          </div>
          <p>
            <strong>Compliance Score: 82/100</strong>
            <br />1 defect found — attach certified copy of impugned order as Exhibit C before
            submission.
          </p>
        </div>
      </div>
    </section>
  );
}

function Audience({ audience }: { audience: ReturnType<typeof useAudience> }) {
  return (
    <section className="audience" id="audience">
      <header className="audience__header">
        <SectionLabel>Who It's For</SectionLabel>
        <SectionTitle>Built for every legal professional</SectionTitle>
      </header>

      <div className="audience__grid">
        {audience.map(({ icon, title, role, body, features }) => (
          <div className="audience-card" key={title}>
            <span className="audience-card__icon" role="img" aria-hidden="true">
              {icon}
            </span>
            <h3>{title}</h3>
            <p className="audience-card__role">{role}</p>
            <p className="audience-card__body">{body}</p>
            <ul className="audience-card__features">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials({ testimonials }: { testimonials: ReturnType<typeof useTestimonials> }) {
  return (
    <section className="testimonials" id="testimonials">
      <header className="testimonials__header">
        <SectionLabel>Early Feedback</SectionLabel>
        <SectionTitle>What legal professionals are saying</SectionTitle>
      </header>

      <div className="testimonials__grid">
        {testimonials.map(({ initials, quote, name, role }) => (
          <div className="testimonial-card" key={name}>
            <div className="testimonial-card__stars">★★★★★</div>
            <blockquote>{quote}</blockquote>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">{initials}</div>
              <div>
                <p className="testimonial-card__name">{name}</p>
                <p className="testimonial-card__role">{role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing({ pricing }: { pricing: ReturnType<typeof usePricing> }) {
  return (
    <section className="pricing" id="pricing">
      <header className="pricing__header">
        <SectionLabel>Pricing</SectionLabel>
        <SectionTitle>Pay per filing or go annual</SectionTitle>
      </header>

      <div className="pricing__grid">
        {pricing.map(({ tier, amount, period, desc, features, cta, featured }) => (
          <div className={`pricing-card ${featured ? 'pricing-card--featured' : ''}`} key={tier}>
            {featured && <div className="pricing-card__badge">Most Popular</div>}
            <p className="pricing-card__tier">{tier}</p>
            <p className="pricing-card__amount">
              {amount} <span>{period}</span>
            </p>
            <p className="pricing-card__desc">{desc}</p>
            <ul className="pricing-card__features">
              {features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a href="#access" className="pricing-card__btn">
              {cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Main() {
  const problemStats = useProblemStats();
  const products = useProducts();
  const howSteps = useHowSteps();
  const audience = useAudience();
  const testimonials = useTestimonials();
  const pricing = usePricing();

  return (
    <main>
      <Problem problemStats={problemStats} />
      <Products products={products} />
      <HowItWorks howSteps={howSteps} />
      <Audience audience={audience} />
      <Testimonials testimonials={testimonials} />
      <Pricing pricing={pricing} />
    </main>
  );
}
