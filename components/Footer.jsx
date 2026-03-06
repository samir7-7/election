export default function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container site-footer__inner">
        <div>
          <strong style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-sm)' }}>
            निर्वाचन — Nepal Election Results
          </strong>
        </div>
        
        <p className="site-footer__disclaimer">
          This platform aggregates publicly available election data for informational purposes only. 
          Data labeled &ldquo;Provisional&rdquo; is sourced from media reports and may differ from official 
          Election Commission figures. Always refer to the{' '}
          <a href="https://election.gov.np" target="_blank" rel="noopener noreferrer" className="site-footer__link" style={{ textDecoration: 'underline' }}>
            Election Commission of Nepal
          </a>{' '}
          for certified results. Factual election data is presented under fair-use principles 
          for public interest.
        </p>

        <div className="site-footer__source">
          <span className="site-footer__source-dot" />
          <span>Data sources: Election Commission Nepal · Ekantipur</span>
        </div>

        <div className="site-footer__links">
          <a href="https://election.gov.np" target="_blank" rel="noopener noreferrer" className="site-footer__link">
            Election Commission
          </a>
          <a href="https://ekantipur.com" target="_blank" rel="noopener noreferrer" className="site-footer__link">
            Ekantipur
          </a>
        </div>
      </div>
    </footer>
  );
}
