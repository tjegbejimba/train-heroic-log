import { useState, useRef } from 'react';
import { ArrowLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import { ROUTE_SETTINGS, ROUTE_EDIT_TEMPLATE } from '../constants';

const SWIPE_THRESHOLD = 80;

function SwipeableRow({ children, onDelete }) {
  const startX = useRef(null);
  const offsetRef = useRef(0);
  const rowRef = useRef(null);
  const [swiped, setSwiped] = useState(false);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    offsetRef.current = swiped ? -SWIPE_THRESHOLD : 0;
  };

  const handleTouchMove = (e) => {
    if (startX.current === null) return;
    const diff = e.touches[0].clientX - startX.current;
    const newOffset = Math.min(0, Math.max(-SWIPE_THRESHOLD, offsetRef.current + diff));
    if (rowRef.current) {
      rowRef.current.style.transform = `translateX(${newOffset}px)`;
      rowRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = (e) => {
    if (startX.current === null) return;
    const diff = e.changedTouches[0].clientX - startX.current;
    const finalOffset = offsetRef.current + diff;
    const shouldReveal = finalOffset < -SWIPE_THRESHOLD / 2;

    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 200ms ease';
      rowRef.current.style.transform = shouldReveal
        ? `translateX(-${SWIPE_THRESHOLD}px)`
        : 'translateX(0)';
    }
    setSwiped(shouldReveal);
    startX.current = null;
  };

  return (
    <div className="tpl-list__swipe-container">
      <div className="tpl-list__swipe-actions">
        <button className="tpl-list__delete-btn" onClick={onDelete}>
          <Trash2 size={18} />
        </button>
      </div>
      <div
        ref={rowRef}
        className="tpl-list__swipe-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default function TemplateListView({
  templateList,
  deleteTemplate,
  navigate,
}) {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = (templateList || []).filter((tpl) =>
    tpl.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id) => {
    setDeleteTarget(id);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteTemplate(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="view tpl-list-view">
      <div className="tpl-list__header">
        <button
          className="tpl-list__back"
          onClick={() => navigate(ROUTE_SETTINGS)}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="tpl-list__title">Templates</h1>
        <span className="tpl-list__count">{templateList?.length || 0}</span>
      </div>

      {templateList && templateList.length > 5 && (
        <div className="tpl-list__search">
          <Search size={16} className="tpl-list__search-icon" />
          <input
            type="text"
            className="tpl-list__search-input"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="tpl-list__items">
        {filtered.length === 0 ? (
          <p className="tpl-list__empty">
            {search ? 'No matching templates' : 'No templates yet'}
          </p>
        ) : (
          filtered.map((tpl) => {
            const exerciseCount = tpl.blocks.reduce(
              (sum, b) => sum + b.exercises.length,
              0
            );
            return (
              <SwipeableRow key={tpl.id} onDelete={() => handleDelete(tpl.id)}>
                <button
                  className="tpl-list__row"
                  onClick={() =>
                    navigate(ROUTE_EDIT_TEMPLATE, { templateId: tpl.id })
                  }
                >
                  <div className="tpl-list__row-info">
                    <span className="tpl-list__row-name">{tpl.name}</span>
                    <span className="tpl-list__row-meta">
                      {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronRight size={18} className="tpl-list__row-chevron" />
                </button>
              </SwipeableRow>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Delete Template?</h2>
            <p className="modal__message">This will permanently remove this template.</p>
            <div className="modal__actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Keep
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
