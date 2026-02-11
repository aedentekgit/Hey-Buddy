import React, { useState, useEffect } from 'react';
import { Brain, Trash2, Search, Clock, Loader2, Eye, Edit2, Save, Mic, MicOff, FileText, ExternalLink, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import Pagination from '../components/Pagination';
import { TableElementStyle } from '../components/TableStyles';
import MobileMemoryCard from '../components/MobileMemoryCard';
import GlobalSlideOver from '../components/GlobalSlideOver';

const Memories = () => {
    // --- Unified State ---
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({
        currentPage: 1, totalPages: 1, total: 0, limit: 10
    });

    // --- Modals State ---
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, type: null }); // type: 'memory' | 'record'
    const [viewModal, setViewModal] = useState({ isOpen: false, item: null });
    const [editModal, setEditModal] = useState({ isOpen: false, item: null });

    // --- Edit Forms State ---
    const [memoryEditContent, setMemoryEditContent] = useState('');
    const [recordEditForm, setRecordEditForm] = useState({ patientName: '', doctorName: '', notes: '' });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

    const {
        isListening,
        transcript,
        setTranscript,
        toggleListening,
        setPreventProcessing
    } = useVoiceAssistant();

    // --- Effects for Voice Input (Memories Only) ---
    useEffect(() => {
        if (editModal.isOpen && editModal.item?.type === 'memory') {
            setPreventProcessing(true);
            setTranscript('');
        } else {
            setPreventProcessing(false);
            if (isListening) toggleListening();
        }
    }, [editModal.isOpen]);

    const [baseContent, setBaseContent] = useState('');
    useEffect(() => {
        if (isListening && editModal.isOpen && editModal.item?.type === 'memory') {
            if (transcript) setMemoryEditContent((baseContent ? baseContent + ' ' : '') + transcript);
        }
    }, [transcript, isListening, editModal.isOpen, baseContent]);

    const handleToggleMic = () => {
        if (!isListening) {
            setBaseContent(memoryEditContent);
            setTranscript('');
        }
        toggleListening();
    };

    // --- Data Fetching ---
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchAllItems(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [search]);

    const fetchAllItems = async (page = 1) => {
        try {
            setLoading(true);
            const res = await voiceService.getAllMemoriesAndRecords(page, pagination.limit, search);
            if (res.data.success) {
                setItems(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (err) {
            toast.error("Failed to load your memories and documents");
        } finally {
            setLoading(false);
        }
    };

    // --- Unified Handlers ---
    const handleDelete = async () => {
        if (!deleteModal.id) return;
        try {
            let res;
            if (deleteModal.type === 'memory') {
                res = await voiceService.deleteMemory(deleteModal.id);
            } else {
                res = await voiceService.deletePrescription(deleteModal.id);
            }

            if (res.success) {
                toast.success(deleteModal.type === 'memory' ? "Memory forgotten" : "Document deleted");
                setItems(items.filter(i => i._id !== deleteModal.id));
                setDeleteModal({ isOpen: false, id: null, type: null });
            }
        } catch (err) {
            toast.error("Failed to delete item");
        }
    };

    const handleUpdate = async () => {
        if (!editModal.item?._id) return;
        try {
            let res;
            if (editModal.item.type === 'memory') {
                res = await voiceService.updateMemory(editModal.item._id, { content: memoryEditContent });
            } else {
                res = await voiceService.updatePrescription(editModal.item._id, {
                    extractedData: { ...editModal.item.extractedData, ...recordEditForm }
                });
            }

            if (res.success) {
                toast.success("Updated successfully");
                fetchAllItems(pagination.currentPage);
                setEditModal({ isOpen: false, item: null });
            }
        } catch (err) {
            toast.error("Failed to update item");
        }
    };

    const openEditModal = (item) => {
        if (item.type === 'memory') {
            setMemoryEditContent(item.content);
        } else {
            setRecordEditForm({
                patientName: item.extractedData?.patientName || '',
                doctorName: item.extractedData?.doctorName || '',
                notes: item.extractedData?.notes || ''
            });
        }
        setEditModal({ isOpen: true, item });
    };

    // --- Helpers ---
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getFileUrl = (path) => {
        if (!path) return '#';
        if (path.startsWith('http')) return path;
        return `${API_URL.replace('/api', '')}/${path.replace(/\\/g, '/')}`;
    };

    return (
        <div className="memories-page-container">
            <div className="table-container">
                {/* Search Header */}
                <div className="search-management-header" style={{ marginBottom: '20px' }}>
                    <div className="buddy-search-box" style={{ width: '100%', maxWidth: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search memories, documents, prescriptions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                </div>

                {/* Unified Table Section */}
                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                <th style={{ textAlign: 'center', minWidth: '200px' }} className="buddy-th">Details</th>
                                <th style={{ minWidth: '100px', textAlign: 'center' }} className="buddy-th hide-on-mobile">Type</th>
                                <th style={{ minWidth: '100px', textAlign: 'center' }} className="buddy-th hide-on-mobile">Timestamp</th>
                                <th style={{ width: '120px', textAlign: 'center' }} className="buddy-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}><Loader2 className="animate-spin" color="var(--primary-color)" size={32} /></td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>No items found. Buddy is ready to learn!</td></tr>
                            ) : (
                                items.map((item, idx) => (
                                    <motion.tr
                                        key={item._id}
                                        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }}
                                        style={{ borderBottom: '1px solid var(--border-color)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td className="buddy-td hide-mobile-td" style={{ textAlign: 'center' }}>
                                            {(pagination.currentPage - 1) * pagination.limit + idx + 1}
                                        </td>

                                        <td className="buddy-td" data-label="Detail">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                {/* Consistent Icon Container */}
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-lite)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: item.type === 'memory' ? 'var(--secondary-color)' : 'var(--primary-color)',
                                                    border: '1px solid var(--border-color)',
                                                    flexShrink: 0
                                                }}>
                                                    {item.type === 'memory' ? <Brain size={18} /> : <FileText size={18} />}
                                                </div>

                                                {/* Content based on type */}
                                                {item.type === 'memory' ? (
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem', textAlign: 'center' }}>
                                                        {item.content?.substring(0, 60)}{item.content?.length > 60 ? '...' : ''}
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                                                            {item.fileName || 'Medical Document'}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                                                            {item.extractedData?.patientName ? `Patient: ${item.extractedData.patientName}` : `ID: ${item._id?.slice(-6).toUpperCase()}`}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="buddy-td hide-on-mobile" style={{ textAlign: 'center' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '4px 8px',
                                                background: item.type === 'memory' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: item.type === 'memory' ? 'var(--secondary-color)' : 'var(--primary-color)',
                                                borderRadius: '12px',
                                                border: `1px solid ${item.type === 'memory' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                                            }}>
                                                {item.type === 'memory' ? 'Memory' : 'Document'}
                                            </span>
                                        </td>

                                        <td className="buddy-td hide-on-mobile-custom" data-label="Date">
                                            <div style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                                                <Clock size={12} style={{ marginRight: '6px' }} />{formatDate(item.createdAt)}
                                            </div>
                                        </td>

                                        <td className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => setViewModal({ isOpen: true, item })}
                                                    className="btn btn-icon btn-sm"
                                                    title="View"
                                                    style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', color: 'var(--primary-color)', background: 'transparent', border: '1px solid var(--border-color)' }}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="btn btn-icon btn-sm"
                                                    title="Edit"
                                                    style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', color: 'var(--secondary-color)', background: 'transparent', border: '1px solid var(--border-color)' }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal({ isOpen: true, id: item._id, type: item.type })}
                                                    className="btn btn-icon btn-sm"
                                                    title="Delete"
                                                    style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', background: 'transparent', border: '1px solid var(--border-color)' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="mobile-card-view" style={{ marginTop: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
                            <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                        </div>
                    ) : items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
                            No items found. Buddy is ready to learn!
                        </div>
                    ) : (
                        items.map(item => (
                            <MobileMemoryCard
                                key={item._id}
                                item={item}
                                onView={() => setViewModal({ isOpen: true, item })}
                                onEdit={() => openEditModal(item)}
                                onDelete={() => setDeleteModal({ isOpen: true, id: item._id, type: item.type })}
                            />
                        ))
                    )}
                </div>

                {!loading && (
                    <Pagination
                        pagination={pagination}
                        onPageChange={(p) => fetchAllItems(p)}
                    />
                )}
            </div>

            {/* --- Modals --- */}

            {/* DELETE MODAL */}
            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null, type: null })}
                onConfirm={handleDelete}
                title={deleteModal.type === 'memory' ? "Forget Memory" : "Delete Document"}
                message={deleteModal.type === 'memory' ? "Are you sure you want Buddy to forget this?" : "This will permanently delete the document and extracted data."}
                confirmText="Delete"
            />

            {/* VIEW MODAL - DYNAMIC CONTENT */}
            <GlobalSlideOver
                isOpen={viewModal.isOpen}
                onClose={() => setViewModal(prev => ({ ...prev, isOpen: false }))}
                title={viewModal.item?.type === 'memory' ? "Memory Details" : "Document Details"}
            >
                {viewModal.item && (
                    <>
                        {viewModal.item.type === 'memory' ? (
                            <DetailCard title={<><Brain size={20} color="var(--primary-color)" /> Insight</>}>
                                <p style={{ fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: '1.6' }}>{viewModal.item.content}</p>
                                <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={14} /> Recorded on {new Date(viewModal.item.createdAt).toLocaleString()}
                                </div>
                            </DetailCard>
                        ) : (
                            <>
                                <DetailCard title={<><FileText size={20} color="var(--primary-color)" /> Information</>}>
                                    <InfoRow label="Patient" value={viewModal.item.extractedData?.patientName || 'Unknown'} />
                                    <InfoRow label="Prescribed by" value={`Dr. ${viewModal.item.extractedData?.doctorName || 'Unspecified'}`} />
                                    <InfoRow label="Uploaded" value={formatDate(viewModal.item.createdAt)} />
                                    {viewModal.item.extractedData?.notes && (
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Buddy Notes</label>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '8px' }}>{viewModal.item.extractedData.notes}</p>
                                        </div>
                                    )}
                                </DetailCard>
                                <DetailCard title="Medicines">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {viewModal.item.extractedData?.medicines?.map((med, i) => (
                                            <div key={i} className="med-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{med.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{med.dosage} • {med.timing}</div>
                                            </div>
                                        )) || <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', opacity: 0.5 }}>No medicines detected</div>}
                                    </div>
                                </DetailCard>
                                <DetailCard title="Document Preview">
                                    <div className="img-container" style={{ maxHeight: '300px' }}>
                                        <img src={getFileUrl(viewModal.item.fileUrl)} alt="Record" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=Scan+Not+Found'} style={{ maxHeight: '300px', width: 'auto' }} />
                                        <a href={getFileUrl(viewModal.item.fileUrl)} target="_blank" rel="noreferrer" className="view-link"><ExternalLink size={14} /> Full View</a>
                                    </div>
                                    {viewModal.item.summary && (
                                        <div className="summary-bubble" style={{ marginTop: '16px' }}><Info size={14} /> <p>{viewModal.item.summary}</p></div>
                                    )}
                                </DetailCard>
                            </>
                        )}
                    </>
                )}
            </GlobalSlideOver>

            {/* EDIT MODAL - DYNAMIC CONTENT */}

            <GlobalSlideOver
                isOpen={editModal.isOpen}
                onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                title={editModal.item?.type === 'memory' ? "Edit Memory" : "Edit Document"}
                actionButton={{
                    label: editModal.item?.type === 'memory' ? 'Update Memory' : 'Save Changes',
                    icon: <Save size={18} />,
                    onClick: handleUpdate
                }}
            >
                {editModal.item && (
                    <div style={{ paddingBottom: '24px' }}>
                        {editModal.item.type === 'memory' ? (
                            <>
                                <DetailCard title="Content">
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <button onClick={handleToggleMic} className={`mic-btn ${isListening ? 'listening' : ''}`}>{isListening ? <MicOff size={14} /> : <Mic size={14} />}</button>
                                    </div>
                                    <textarea
                                        className="modal-input"
                                        rows="8"
                                        value={memoryEditContent}
                                        onChange={(e) => { setMemoryEditContent(e.target.value); if (!isListening) setBaseContent(e.target.value); }}
                                        style={{ width: '100%', minHeight: '150px', background: 'var(--bg-lite)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '16px', borderRadius: '12px' }}
                                    />
                                </DetailCard>
                            </>
                        ) : (
                            <>
                                <DetailCard title={<><Edit2 size={20} color="var(--primary-color)" /> Verify Details</>}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label className="modal-label">Patient Name</label>
                                            <input className="modal-input" value={recordEditForm.patientName} onChange={(e) => setRecordEditForm({ ...recordEditForm, patientName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="modal-label">Doctor Name</label>
                                            <input className="modal-input" value={recordEditForm.doctorName} onChange={(e) => setRecordEditForm({ ...recordEditForm, doctorName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="modal-label">Buddy Notes</label>
                                            <textarea className="modal-input" rows="4" value={recordEditForm.notes} onChange={(e) => setRecordEditForm({ ...recordEditForm, notes: e.target.value })} placeholder="Add your notes here..." />
                                        </div>
                                    </div>
                                </DetailCard>
                            </>
                        )}
                    </div>
                )}
            </GlobalSlideOver>
        </div>
    );
};

const DetailCard = ({ title, children, className = '' }) => (
    <div className={`detail-card ${className}`} style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '20px',
        backdropFilter: 'blur(12px)'
    }}>
        {title && (
            <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '1.1rem',
                fontWeight: '700',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                {title}
            </h4>
        )}
        {children}
    </div>
);

const InfoRow = ({ label, value }) => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        alignItems: 'baseline',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-color)',
        gap: '16px'
    }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', opacity: 0.8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', textAlign: 'left' }}>{value}</span>
    </div>
);

export default Memories;
