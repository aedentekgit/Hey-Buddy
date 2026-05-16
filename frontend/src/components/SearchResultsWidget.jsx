import { X, Search, Globe, ExternalLink } from 'lucide-react';
import '../styles/SearchResults.css';

const SearchResultsWidget = ({ isOpen, onClose, data }) => {
    if (!data) return null;

    const { query, answer, results = [] } = data;

    return (
        <div className={`search-results-widget ${isOpen ? 'open' : ''}`}>
            <div className="search-results-header">
                <div className="header-title">
                    <Search size={16} />
                    <span>Search Results</span>
                </div>
                <button className="close-btn" onClick={onClose}>
                    <X size={18} />
                </button>
            </div>

            <div className="search-results-query">
                <span className="query-label">QUERY:</span>
                <span className="query-text">{query}</span>
            </div>

            {answer && (
                <div className="search-results-answer">
                    <div className="answer-label">
                        <Globe size={14} />
                        <span>AI SUMMARY</span>
                    </div>
                    <p className="answer-text">{answer}</p>
                </div>
            )}

            <div className="search-results-list">
                <div className="list-label">TOP SOURCES</div>
                {results.map((result, idx) => (
                    <div key={idx} className="search-result-card">
                        <div className="card-title">{result.title}</div>
                        {result.content && <div className="card-content">{result.content}</div>}
                        <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-url"
                        >
                            <ExternalLink size={12} />
                            <span>{new URL(result.url).hostname.replace('www.', '')}</span>
                        </a>
                        {result.score && (
                            <div className="card-score">
                                Relevance: {Math.round(result.score * 100)}%
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SearchResultsWidget;
