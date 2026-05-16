import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    PaginationContainerStyle,
    PaginationInfoStyle,
    PaginationGroupStyle,
    PaginationButtonStyle
} from '../styles/tableStyles';

const Pagination = ({ pagination, onPageChange }) => {
    if (!pagination || pagination.total === 0) return null;

    const { currentPage, totalPages, total, limit } = pagination;

    const startRange = (currentPage - 1) * limit + 1;
    const endRange = Math.min(currentPage * limit, total);

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div style={PaginationContainerStyle} className="pagination-container">
            <div style={PaginationInfoStyle} className="pagination-info">
                Showing <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{startRange}-{endRange}</span> of <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{total}</span> results
            </div>

            {totalPages > 1 && (
                <div style={PaginationGroupStyle} className="pagination-buttons">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={PaginationButtonStyle(false, currentPage === 1)}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {getPageNumbers().map(page => (
                        <button
                            key={page}
                            onClick={() => onPageChange(page)}
                            style={PaginationButtonStyle(page === currentPage)}
                        >
                            {page}
                        </button>
                    ))}

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={PaginationButtonStyle(false, currentPage === totalPages)}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Pagination;
