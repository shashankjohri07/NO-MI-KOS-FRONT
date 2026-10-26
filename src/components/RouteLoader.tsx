import '../styles/RouteLoader.css';

/** Suspense fallback shown while a lazy-loaded route's code downloads —
 * only ever visible for a beat on a slow connection or a cold cache. */
export default function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-label="Loading page">
      <div className="route-loader__spinner" />
    </div>
  );
}
