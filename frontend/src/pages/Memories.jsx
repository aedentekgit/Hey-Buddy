import React, { useState, useEffect } from 'react';
import { Brain, Trash2, Search, Clock, Loader2, Eye, Edit2, Save, X, Mic, MicOff, FileText, User, ExternalLink, Info, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, ActionButtonStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle
} from '../components/TableStyles';
import SidePanelWrapper from '../components/SidePanelWrapper';

const Memories = () => {
    // --- State for Tabs ---
    const [activeTab, setActiveTab] = useState('medical'); // 'medical' or 'memories'

    // --- State for Memories (Tab 2) ---
    const [memories, setMemories] = useState([]);
    const [memoriesLoading, setMemoriesLoading] = useState(true);
    const [memorySearch, setMemorySearch] = useState('');
    const [memoryDeleteModal, setMemoryDeleteModal] = useState({ isOpen: false, id: null });
    const [memoryViewModal, setMemoryViewModal] = useState({ isOpen: false, memory: null });
    const [memoryEditModal, setMemoryEditModal] = useState({ isOpen: false, memory: null });
    const [memoryEditContent, setMemoryEditContent] = useState('');
    const [memoriesPagination, setMemoriesPagination] = useState({
        currentPage: 1, totalPages: 1, total: 0, limit: 10
    });

    // --- State for Medical Records (Tab 1) ---
    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(true);
    const [recordSearch, setRecordSearch] = useState('');
    const [recordDeleteModal, setRecordDeleteModal] = useState({ isOpen: false, id: null });
    const [recordViewModal, setRecordViewModal] = useState({ isOpen: false, record: null });
    const [recordEditModal, setRecordEditModal] = useState({ isOpen: false, record: null });
    const [recordEditForm, setRecordEditForm] = useState({ patientName: '', doctorName: '', notes: '' });
    const [recordsPagination, setRecordsPagination] = useState({
        currentPage: 1, totalPages: 1, total: 0, limit: 10
    });

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
        if (memoryEditModal.isOpen) {
            setPreventProcessing(true);
            setTranscript('');
        } else {
            setPreventProcessing(false);
            if (isListening) toggleListening();
        }
    }, [memoryEditModal.isOpen]);

    const [baseContent, setBaseContent] = useState('');
    useEffect(() => {
        if (isListening && memoryEditModal.isOpen) {
            if (transcript) setMemoryEditContent((baseContent ? baseContent + ' ' : '') + transcript);
        }
    }, [transcript, isListening, memoryEditModal.isOpen, baseContent]);

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
            if (activeTab === 'memories') fetchMemories(1);
            else fetchRecords(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [memorySearch, recordSearch, activeTab]);

    const fetchMemories = async (page = 1) => {
        try {
            setMemoriesLoading(true);
            const res = await voiceService.getMemories(page, memoriesPagination.limit, memorySearch);
            if (res.data.success) {
                setMemories(res.data.data);
                setMemoriesPagination(res.data.pagination);
            }
        } catch (err) {
            toast.error("Failed to load your memories");
        } finally {
            setMemoriesLoading(false);
        }
    };

    const fetchRecords = async (page = 1) => {
        try {
            setRecordsLoading(true);
            const res = await voiceService.getPrescriptions(page, recordsPagination.limit, recordSearch);
            if (res.data.success) {
                setRecords(res.data.data);
                setRecordsPagination(res.data.pagination);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to load medical records");
        } finally {
            setRecordsLoading(false);
        }
    };

    // --- Handlers: Memories ---
    const handleMemoryDelete = async () => {
        if (!memoryDeleteModal.id) return;
        try {
            const res = await voiceService.deleteMemory(memoryDeleteModal.id);
            if (res.success) {
                toast.success("Memory forgotten");
                setMemories(memories.filter(m => m._id !== memoryDeleteModal.id));
                setMemoryDeleteModal({ isOpen: false, id: null });
            }
        } catch (err) {
            toast.error("Failed to delete memory");
        }
    };

    const handleMemoryUpdate = async () => {
        if (!memoryEditModal.memory?._id) return;
        try {
            const res = await voiceService.updateMemory(memoryEditModal.memory._id, { content: memoryEditContent });
            if (res.success) {
                toast.success("Memory updated");
                fetchMemories(memoriesPagination.currentPage);
                setMemoryEditModal({ isOpen: false, memory: null });
            }
        } catch (err) {
            toast.error("Failed to update memory");
        }
    };

    // --- Handlers: Medical Records ---
    const handleRecordDelete = async () => {
        if (!recordDeleteModal.id) return;
        try {
            const res = await voiceService.deletePrescription(recordDeleteModal.id);
            if (res.success) {
                toast.success("Record deleted");
                setRecords(records.filter(r => r._id !== recordDeleteModal.id));
                setRecordDeleteModal({ isOpen: false, id: null });
            }
        } catch (err) {
            toast.error("Failed to delete record");
        }
    };

    const handleRecordUpdate = async () => {
        try {
            const res = await voiceService.updatePrescription(recordEditModal.record._id, {
                extractedData: { ...recordEditModal.record.extractedData, ...recordEditForm }
            });
            if (res.success) {
                toast.success("Record updated");
                fetchRecords(recordsPagination.currentPage);
                setRecordEditModal({ isOpen: false, record: null });
            }
        } catch (err) {
            toast.error("Failed to update record");
        }
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

    const TabButtonStyle = (id) => ({
        padding: '10px 20px',
        borderRadius: 'var(--radius-md)',
        border: activeTab === id ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
        background: activeTab === id ? 'var(--primary-color)' : 'var(--bg-lite)',
        color: activeTab === id ? 'white' : 'var(--text-sub)',
        cursor: 'pointer',
        fontWeight: '700',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: activeTab === id ? '0 4px 12px color-mix(in srgb, var(--primary-color) 15%, transparent)' : 'none'
    });

    return (
        <div className="memories-page-container">
            <div className="table-container">
                {/* Search Header with Tab Buttons */}
                {/* Search Header with Tab Buttons */}
                <div className="search-management-header">
                    <div className="buddy-search-box">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder={activeTab === 'memories' ? "Search memories..." : "Search documents..."}
                            value={activeTab === 'memories' ? memorySearch : recordSearch}
                            onChange={(e) => activeTab === 'memories' ? setMemorySearch(e.target.value) : setRecordSearch(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>

                    {/* Tab Buttons on Right Side */}
                    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                        <button onClick={() => setActiveTab('medical')} style={TabButtonStyle('medical')}>
                            <FileText size={18} /> <span className="hide-mobile-text">Document</span>
                        </button>
                        <button onClick={() => setActiveTab('memories')} style={TabButtonStyle('memories')}>
                            <Brain size={18} /> <span className="hide-mobile-text">Buddy Memory</span>
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                {activeTab === 'memories' ? (
                                    <>
                                        <th style={{ textAlign: 'center', minWidth: '180px' }} className="buddy-th">Memory Detail</th>
                                        <th style={{ minWidth: '100px', textAlign: 'center' }} className="buddy-th hide-on-mobile">Timestamp</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ textAlign: 'center', minWidth: '200px' }} className="buddy-th">Document Identity</th>
                                        <th style={{ minWidth: '130px', textAlign: 'center' }} className="buddy-th">Assigned To</th>
                                        <th style={{ minWidth: '150px', textAlign: 'center' }} className="buddy-th hide-on-mobile">Extracted Points</th>
                                    </>
                                )}
                                <th style={{ width: '120px', textAlign: 'center' }} className="buddy-th">Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeTab === 'memories' ? (
                                memoriesLoading ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '100px 0' }}><Loader2 className="animate-spin" color="var(--primary-color)" size={32} /></td></tr>
                                ) : memories.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>Buddy hasn't learned those things yet.</td></tr>
                                ) : (
                                    memories.map((memo, idx) => (
                                        <motion.tr key={memo._id} whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }} style={{ borderBottom: '1px solid var(--border-color)' }} className="mobile-stacked-row">
                                            <td className="buddy-td hide-mobile-td" style={{ textAlign: 'center' }}>{(memoriesPagination.currentPage - 1) * memoriesPagination.limit + idx + 1}</td>
                                            <td className="buddy-td" data-label="Insight">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-lite)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--primary-color)',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <Brain size={16} />
                                                    </div>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem', textAlign: 'center' }}>{memo.content}</div>
                                                </div>
                                            </td>
                                            <td className="buddy-td hide-on-mobile-custom" data-label="Date">
                                                <div style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}><Clock size={12} style={{ marginRight: '6px' }} />{formatDate(memo.createdAt)}</div>
                                            </td>
                                            <td className="buddy-td mobile-actions-cell">
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    <button
                                                        onClick={() => setMemoryViewModal({ isOpen: true, memory: memo })}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--primary-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setMemoryEditContent(memo.content); setMemoryEditModal({ isOpen: true, memory: memo }); }}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--secondary-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setMemoryDeleteModal({ isOpen: true, id: memo._id })}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--danger-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )
                            ) : (
                                recordsLoading ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}><Loader2 className="animate-spin" color="var(--primary-color)" size={32} /></td></tr>
                                ) : records.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>No medical records discovered.</td></tr>
                                ) : (
                                    records.map((record, idx) => (
                                        <motion.tr key={record._id} whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }} style={{ borderBottom: '1px solid var(--border-color)' }} className="mobile-stacked-row">
                                            <td className="buddy-td hide-mobile-td" style={{ textAlign: 'center' }}>{(recordsPagination.currentPage - 1) * recordsPagination.limit + idx + 1}</td>
                                            <td className="buddy-td" data-label="Document">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-lite)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--primary-color)',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <FileText size={16} />
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem' }}>{record.fileName || 'Lab Report'}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px' }}>ID: {record._id?.slice(-8).toUpperCase()}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="buddy-td" data-label="Prescribed by">
                                                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', textAlign: 'center' }}>
                                                    Dr. {record.extractedData?.doctorName?.replace(/^Dr\.\s+/i, '') || 'General'}
                                                </div>
                                            </td>
                                            <td className="buddy-td hide-on-mobile-custom" data-label="Details">
                                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', maxWidth: '180px', margin: '0 auto' }}>
                                                    {record.extractedData?.medicines?.slice(0, 2).map((m, i) => (
                                                        <span key={i} className="med-pill">{m.name}</span>
                                                    ))}
                                                    {record.extractedData?.medicines?.length > 2 && <span style={{ fontSize: '0.6rem', color: 'var(--primary-glow)' }}>+{record.extractedData.medicines.length - 2}</span>}
                                                </div>
                                            </td>
                                            <td className="buddy-td mobile-actions-cell">
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    <button
                                                        onClick={() => setRecordViewModal({ isOpen: true, record })}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--primary-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setRecordEditForm({ patientName: record.extractedData?.patientName || '', doctorName: record.extractedData?.doctorName || '', notes: record.extractedData?.notes || '' }); setRecordEditModal({ isOpen: true, record }); }}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--secondary-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setRecordDeleteModal({ isOpen: true, id: record._id })}
                                                        className="btn btn-icon btn-sm"
                                                        style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            color: 'var(--danger-color)',
                                                            background: 'transparent',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
                {!(activeTab === 'memories' ? memoriesLoading : recordsLoading) && (
                    <Pagination
                        pagination={activeTab === 'memories' ? memoriesPagination : recordsPagination}
                        onPageChange={(p) => activeTab === 'memories' ? fetchMemories(p) : fetchRecords(p)}
                    />
                )}
            </div>

            {/* --- Modals: Memory Delete / View / Edit --- */}
            <ConfirmationModal
                isOpen={memoryDeleteModal.isOpen}
                onClose={() => setMemoryDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleMemoryDelete}
                title="Forget Memory"
                message="Are you sure you want Buddy to forget this?"
                confirmText="Forget"
            />

            <AnimatePresence>
                {memoryViewModal.isOpen && (
                    <SidePanelWrapper
                        onClose={() => setMemoryViewModal({ isOpen: false, memory: null })}
                        title="Memory Details"
                    >
                        <DetailCard title={<><Brain size={20} color="var(--primary-color)" /> Insight</>}>
                            <p style={{ fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: '1.6' }}>{memoryViewModal.memory?.content}</p>
                            <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={14} /> Recorded on {new Date(memoryViewModal.memory?.createdAt).toLocaleString()}
                            </div>
                        </DetailCard>
                    </SidePanelWrapper>
                )}

                {memoryEditModal.isOpen && (
                    <SidePanelWrapper
                        onClose={() => setMemoryEditModal({ isOpen: false, memory: null })}
                        title="Edit Memory"
                    >
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
                        <button onClick={handleMemoryUpdate} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 'var(--radius-lg)', fontSize: '1rem' }}>
                            <Save size={18} /> Update Memory
                        </button>
                    </SidePanelWrapper>
                )}

                {recordViewModal.isOpen && (
                    <SidePanelWrapper
                        onClose={() => setRecordViewModal({ isOpen: false, record: null })}
                        title="Document Details"
                    >
                        <DetailCard title={<><FileText size={20} color="var(--primary-color)" /> Information</>}>
                            <InfoRow label="Patient" value={recordViewModal.record.extractedData?.patientName || 'Unknown'} />
                            <InfoRow label="Prescribed by" value={`Dr. ${recordViewModal.record.extractedData?.doctorName || 'Unspecified'}`} />
                            <InfoRow label="Uploaded" value={formatDate(recordViewModal.record.createdAt)} />
                            {recordViewModal.record.extractedData?.notes && (
                                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-sub)', textTransform: 'uppercase' }}>Buddy Notes</label>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '8px' }}>{recordViewModal.record.extractedData.notes}</p>
                                </div>
                            )}
                        </DetailCard>

                        <DetailCard title="Medicines">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {recordViewModal.record.extractedData?.medicines?.map((med, i) => (
                                    <div key={i} className="med-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{med.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{med.dosage} • {med.timing}</div>
                                    </div>
                                )) || <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', opacity: 0.5 }}>No medicines detected</div>}
                            </div>
                        </DetailCard>

                        <DetailCard title="Document Preview">
                            <div className="img-container" style={{ maxHeight: '300px' }}>
                                <img src={getFileUrl(recordViewModal.record.fileUrl)} alt="Medical Record" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=Scan+Not+Found'} style={{ maxHeight: '300px', width: 'auto' }} />
                                <a href={getFileUrl(recordViewModal.record.fileUrl)} target="_blank" rel="noreferrer" className="view-link"><ExternalLink size={14} /> Full View</a>
                            </div>
                            {recordViewModal.record.summary && (
                                <div className="summary-bubble" style={{ marginTop: '16px' }}><Info size={14} /> <p>{recordViewModal.record.summary}</p></div>
                            )}
                        </DetailCard>
                    </SidePanelWrapper>
                )}

                {recordEditModal.isOpen && (
                    <SidePanelWrapper
                        onClose={() => setRecordEditModal({ isOpen: false, record: null })}
                        title="Edit Info"
                    >
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

                        <DetailCard title="Medicines (Read-Only)">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {recordEditModal.record.extractedData?.medicines?.map((med, i) => (
                                    <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                                        • <b>{med.name}</b> ({med.dosage})
                                    </div>
                                ))}
                            </div>
                        </DetailCard>

                        <button onClick={handleRecordUpdate} className="btn-primary" style={{ height: '54px', width: '100%', justifyContent: 'center', marginTop: '12px', borderRadius: '16px' }}>
                            <Save size={18} /> Save All Changes
                        </button>

                        <div style={{ marginTop: '30px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-sub)', marginBottom: '10px' }}>Reference Document</h4>
                            <div className="img-container" style={{ maxHeight: '200px' }}>
                                <img src={getFileUrl(recordEditModal.record.fileUrl)} alt="Reference" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=Scan+Not+Found'} style={{ maxHeight: '200px' }} />
                                <a href={getFileUrl(recordEditModal.record.fileUrl)} target="_blank" rel="noreferrer" className="view-link" style={{ background: 'var(--bg-lite)', backdropFilter: 'blur(10px)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                                    <ExternalLink size={14} /> Full View
                                </a>
                            </div>
                        </div>
                    </SidePanelWrapper>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={recordDeleteModal.isOpen}
                onClose={() => setRecordDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleRecordDelete}
                title="Delete Record"
                message="Are you sure you want to remove this medical document?"
                confirmText="Delete"
            />

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
