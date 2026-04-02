import './Pagination.css';

function Pagination({ currentPage, totalPages, onPageChange }) {
  const pageNumbers = [];
  const maxPagesToShow = 5;
  const halfWindow = Math.floor(maxPagesToShow / 2);

  let startPage = Math.max(1, currentPage - halfWindow);
  let endPage = Math.min(totalPages, currentPage + halfWindow);

  if (endPage - startPage < maxPagesToShow - 1) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    } else {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={currentPage === 1}
        onClick={() => onPageChange(1)}
      >
        First
      </button>
      <button
        className="pagination-btn"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </button>

      {startPage > 1 && (
        <>
          <button className="pagination-btn" onClick={() => onPageChange(1)}>
            1
          </button>
          {startPage > 2 && <span className="pagination-ellipsis">...</span>}
        </>
      )}

      {pageNumbers.map((page) => (
        <button
          key={page}
          className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
          <button className="pagination-btn" onClick={() => onPageChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        className="pagination-btn"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </button>
      <button
        className="pagination-btn"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(totalPages)}
      >
        Last
      </button>
    </div>
  );
}

export default Pagination;
