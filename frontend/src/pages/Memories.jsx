import React, { useState, useEffect } from 'react';
import { Brain, Trash2, Search, Clock, Loader2, Eye, Edit2, Save, X, Mic, MicOff, FileText, User, ExternalLink, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, ActionButtonStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle
} from '../components/TableStyles';

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
        padding: '12px 24px',
        borderRadius: '14px',
        border: 'none',
        background: activeTab === id ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
        color: activeTab === id ? 'white' : 'rgba(255, 255, 255, 0.5)',
        cursor: 'pointer',
        fontWeight: '700',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: activeTab === id ? '0 10px 20px -10px var(--primary-color)' : 'none'
    });

    return (
        <div className="memories-page-container">
            {/* Tab Header */}
            <div className="tabs-header">
                <button onClick={() => setActiveTab('medical')} style={TabButtonStyle('medical')}>
                    <FileText size={18} /> Document
                </button>
                <button onClick={() => setActiveTab('memories')} style={TabButtonStyle('memories')}>
                    <Brain size={18} /> Buddy Memory
                </button>
            </div>

            <div style={TableContainerStyle} className="glass-card">
                {/* Search Header */}
                <div className="search-header-flex">
                    <div style={{ ...SearchBoxStyle, marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                        <input
                            type="text"
                            placeholder={activeTab === 'memories' ? "What should Buddy find?" : "Search prescriptions / test reports..."}
                            value={activeTab === 'memories' ? memorySearch : recordSearch}
                            onChange={(e) => activeTab === 'memories' ? setMemorySearch(e.target.value) : setRecordSearch(e.target.value)}
                            style={SearchInputStyle}
                        />
                    </div>
                </div>

                {/* Table Section */}
                <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '60px', borderRadius: '12px 0 0 12px' }}>S.No</th>
                                {activeTab === 'memories' ? (
                                    <>
                                        <th style={{ ...ThStyle, textAlign: 'left', minWidth: '180px' }}>Memory Insight</th>
                                        <th style={{ ...ThStyle, minWidth: '100px' }} className="hide-on-mobile">Timestamp</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ ...ThStyle, textAlign: 'left', minWidth: '200px' }}>Document Details</th>
                                        <th style={{ ...ThStyle, minWidth: '130px' }}>Patient Info</th>
                                        <th style={{ ...ThStyle, minWidth: '150px' }} className="hide-on-mobile">Medicines</th>
                                    </>
                                )}
                                <th style={{ ...ThStyle, width: '120px', borderRadius: '0 12px 12px 0' }}>Actions</th>
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
                                        <motion.tr key={memo._id} whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={TdStyle}>{(memoriesPagination.currentPage - 1) * memoriesPagination.limit + idx + 1}</td>
                                            <td style={TdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div className="icon-badge"><Brain size={18} color="var(--primary-color)" /></div>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>{memo.content}</div>
                                                </div>
                                            </td>
                                            <td style={TdStyle} className="hide-on-mobile">
                                                <div style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}><Clock size={12} style={{ marginRight: '6px' }} />{formatDate(memo.createdAt)}</div>
                                            </td>
                                            <td style={TdStyle}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    <button onClick={() => setMemoryViewModal({ isOpen: true, memory: memo })} style={{ ...ActionButtonStyle, color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)' }}><Eye size={14} /></button>
                                                    <button onClick={() => { setMemoryEditContent(memo.content); setMemoryEditModal({ isOpen: true, memory: memo }); }} style={{ ...ActionButtonStyle, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><Edit2 size={14} /></button>
                                                    <button onClick={() => setMemoryDeleteModal({ isOpen: true, id: memo._id })} style={{ ...ActionButtonStyle, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}><Trash2 size={14} /></button>
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
                                        <motion.tr key={record._id} whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={TdStyle}>{(recordsPagination.currentPage - 1) * recordsPagination.limit + idx + 1}</td>
                                            <td style={TdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div className="icon-badge"><FileText size={18} color="var(--primary-color)" /></div>
                                                    <div>
                                                        <div style={{ fontWeight: '700', color: 'white' }}>{record.fileName || 'Lab Report'}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Uploaded {formatDate(record.createdAt)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={TdStyle}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600' }}><User size={12} color="var(--primary-glow)" /> {record.extractedData?.patientName || 'Anon'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Dr. {record.extractedData?.doctorName || 'General'}</div>
                                            </td>
                                            <td style={TdStyle} className="hide-on-mobile">
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                                                    {record.extractedData?.medicines?.slice(0, 2).map((m, i) => (
                                                        <span key={i} className="med-pill">{m.name}</span>
                                                    ))}
                                                    {record.extractedData?.medicines?.length > 2 && <span style={{ fontSize: '0.6rem', color: 'var(--primary-glow)' }}>+{record.extractedData.medicines.length - 2}</span>}
                                                </div>
                                            </td>
                                            <td style={TdStyle}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    <button onClick={() => setRecordViewModal({ isOpen: true, record })} style={{ ...ActionButtonStyle, color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)' }}><Eye size={14} /></button>
                                                    <button onClick={() => { setRecordEditForm({ patientName: record.extractedData?.patientName || '', doctorName: record.extractedData?.doctorName || '', notes: record.extractedData?.notes || '' }); setRecordEditModal({ isOpen: true, record }); }} style={{ ...ActionButtonStyle, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><Edit2 size={14} /></button>
                                                    <button onClick={() => setRecordDeleteModal({ isOpen: true, id: record._id })} style={{ ...ActionButtonStyle, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}><Trash2 size={14} /></button>
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
                    <ModalWrapper onClose={() => setMemoryViewModal({ isOpen: false, memory: null })}>
                        <ModalHeader title="Memory Details" icon={<Brain color="var(--primary-color)" />} onClose={() => setMemoryViewModal({ isOpen: false, memory: null })} />
                        <div>
                            <label className="modal-label">Content</label>
                            <p style={{ fontSize: '1.2rem', color: 'white', lineHeight: '1.6', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px' }}>{memoryViewModal.memory?.content}</p>
                            <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-sub)' }}><Clock size={14} /> Recorded on {new Date(memoryViewModal.memory?.createdAt).toLocaleString()}</div>
                        </div>
                    </ModalWrapper>
                )}

                {memoryEditModal.isOpen && (
                    <ModalWrapper onClose={() => setMemoryEditModal({ isOpen: false, memory: null })}>
                        <ModalHeader title="Edit Memory" icon={<Edit2 color="var(--primary-color)" />} onClose={() => setMemoryEditModal({ isOpen: false, memory: null })} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label className="modal-label">Content</label>
                                    <button onClick={handleToggleMic} className={`mic-btn ${isListening ? 'listening' : ''}`}>{isListening ? <MicOff size={14} /> : <Mic size={14} />}</button>
                                </div>
                                <textarea className="modal-input" rows="5" value={memoryEditContent} onChange={(e) => { setMemoryEditContent(e.target.value); if (!isListening) setBaseContent(e.target.value); }} />
                            </div>
                            <button onClick={handleMemoryUpdate} className="btn-primary" style={{ height: '48px' }}><Save size={18} /> Update Memory</button>
                        </div>
                    </ModalWrapper>
                )}

                {/* --- Modals: Medical Record Delete / View / Edit --- */}
                {recordViewModal.isOpen && (
                    <ModalWrapper onClose={() => setRecordViewModal({ isOpen: false, record: null })} width="800px">
                        <ModalHeader title="Document Analysis" icon={<FileText color="var(--primary-color)" />} onClose={() => setRecordViewModal({ isOpen: false, record: null })} />
                        <div className="medical-grid">
                            <div className="medical-info-pane">
                                <div className="info-block">
                                    <h4 className="block-title">Extracted Details</h4>
                                    <InfoRow label="Patient" value={recordViewModal.record.extractedData?.patientName || 'Unknown'} />
                                    <InfoRow label="Prescribed by" value={`Dr. ${recordViewModal.record.extractedData?.doctorName || 'Unspecified'}`} />
                                    <InfoRow label="Uploaded" value={formatDate(recordViewModal.record.createdAt)} />
                                    {recordViewModal.record.extractedData?.notes && (
                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <label className="modal-label" style={{ fontSize: '0.65rem' }}>Buddy Notes</label>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '4px' }}>{recordViewModal.record.extractedData.notes}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="info-block" style={{ marginTop: '20px' }}>
                                    <h4 className="block-title">Medicines</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {recordViewModal.record.extractedData?.medicines?.map((med, i) => (
                                            <div key={i} className="med-item">
                                                <div style={{ fontWeight: '700', color: 'white' }}>{med.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{med.dosage} • {med.timing}</div>
                                            </div>
                                        )) || <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.2)' }}>No medicines detected</div>}
                                    </div>
                                </div>
                            </div>

                            <div className="medical-image-pane">
                                <div className="img-container">
                                    <img src={getFileUrl(recordViewModal.record.fileUrl)} alt="Medical Record" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=Scan+Not+Found'} />
                                    <a href={getFileUrl(recordViewModal.record.fileUrl)} target="_blank" rel="noreferrer" className="view-link"><ExternalLink size={14} /> Full View</a>
                                </div>
                                {recordViewModal.record.summary && (
                                    <div className="summary-bubble"><Info size={14} /> <p>{recordViewModal.record.summary}</p></div>
                                )}
                            </div>
                        </div>
                    </ModalWrapper>
                )}

                {recordEditModal.isOpen && (
                    <ModalWrapper onClose={() => setRecordEditModal({ isOpen: false, record: null })} width="800px">
                        <ModalHeader title="Edit Document Info" icon={<Edit2 color="var(--primary-color)" />} onClose={() => setRecordEditModal({ isOpen: false, record: null })} />
                        <div className="medical-grid">
                            <div className="medical-info-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="info-block">
                                    <h4 className="block-title">Verify Information</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                                </div>

                                <div className="info-block">
                                    <h4 className="block-title">Medicines (Read-Only)</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {recordEditModal.record.extractedData?.medicines?.map((med, i) => (
                                            <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                                                • <b>{med.name}</b> ({med.dosage})
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={handleRecordUpdate} className="btn-primary" style={{ height: '54px', marginTop: 'auto' }}>
                                    <Save size={18} /> Save All Changes
                                </button>
                            </div>

                            <div className="medical-image-pane">
                                <div className="img-container">
                                    <img src={getFileUrl(recordEditModal.record.fileUrl)} alt="Reference" onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=Scan+Not+Found'} />
                                    <a href={getFileUrl(recordEditModal.record.fileUrl)} target="_blank" rel="noreferrer" className="view-link" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white' }}>
                                        <ExternalLink size={14} /> Full View
                                    </a>
                                </div>
                                <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                                        Use the document scan on the left to verify the extracted details.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ModalWrapper>
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

            <style>{`
                .glass-card { background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border-color); border-radius: 24px; padding: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); }
                .icon-badge { width: 38px; height: 38px; background: rgba(0, 117, 255, 0.08); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 10px rgba(0, 117, 255, 0.1); }
                .med-pill { padding: 4px 10px; background: rgba(0, 117, 255, 0.1); border: 1px solid rgba(0, 117, 255, 0.2); border-radius: 8px; color: var(--primary-glow); font-size: 0.65rem; font-weight: 700; height: fit-content; }
                .modal-label { font-size: 0.75rem; color: var(--text-sub); text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; }
                .modal-input { width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 14px; color: white; display: block; margin-top: 8px; font-size: 0.95rem; outline: none; transition: border 0.3s; }
                .modal-input:focus { border-color: var(--primary-color); }
                .mic-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(0, 117, 255, 0.1); color: var(--primary-color); cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .mic-btn.listening { background: #ef4444; color: white; animation: pulse 1.5s infinite; }
                .medical-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 30px; }
                .info-block { background: rgba(255,255,255,0.02); padding: 20px; border-radius: 20px; border: 1px solid var(--border-color); }
                .block-title { font-size: 0.75rem; color: var(--primary-glow); text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.05em; }
                .img-container { background: #000; border-radius: 20px; border: 1px solid var(--border-color); overflow: hidden; position: relative; min-height: 400px; display: flex; align-items: center; justify-content: center; }
                .img-container img { max-width: 100%; max-height: 600px; }
                .view-link { position: absolute; bottom: 15px; right: 15px; background: var(--primary-color); color: white; padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 0.8rem; text-decoration: none; display: flex; alignItems: center; gap: 8px; box-shadow: 0 10px 20px rgba(0, 117, 255, 0.3); }
                .med-item { padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .med-item:last-child { border: none; }
                .summary-bubble { margin-top: 15px; background: rgba(16, 185, 129, 0.05); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2); display: flex; gap: 10px; color: #10b981; font-size: 0.85rem; }
                .summary-bubble p { margin: 0; line-height: 1.5; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                .memories-page-container {
                    color: var(--text-main);
                    padding: 24px;
                }

                .tabs-header {
                    display: flex;
                    gap: 15px;
                    marginBottom: 30px;
                }

                .search-header-flex {
                    display: flex;
                    justify-content: space-between;
                    alignItems: center;
                    marginBottom: 24px;
                    gap: 16px;
                }

                @media (max-width: 768px) {
                    .memories-page-container {
                        padding: 16px;
                    }

                    .tabs-header {
                        gap: 10px;
                        margin-bottom: 20px;
                    }

                    .tabs-header button {
                        flex: 1;
                        padding: 10px 12px !important;
                        font-size: 0.75rem !important;
                        justify-content: center;
                    }

                    .search-header-flex {
                        flex-direction: column;
                        margin-bottom: 20px;
                    }

                    .glass-card {
                        padding: 16px !important;
                        border-radius: 20px !important;
                    }

                    th, td {
                        padding: 12px 8px !important;
                    }
                }

                @media (max-width: 900px) { 
                    .medical-grid { grid-template-columns: 1fr; }
                    .hide-on-mobile { display: none; }
                    th, td { padding: 12px 8px !important; }
                    .glass-card { padding: 15px; }
                }

            `}</style>
        </div>
    );
};

const ModalWrapper = ({ children, onClose, width = '550px' }) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="hide-scrollbar"
            style={{
                background: 'var(--card-bg)',
                borderRadius: '32px',
                padding: '35px',
                maxWidth: width,
                width: '95%',
                border: '1px solid var(--border-color)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                maxHeight: '95vh',
                overflowY: 'auto'
            }}
        >
            {children}
        </motion.div>
    </div>
);

const ModalHeader = ({ title, icon, onClose }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>{icon} {title}</h3>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
    </div>
);

const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
        <span style={{ fontSize: '0.9rem', color: 'white', fontWeight: '700' }}>{value}</span>
    </div>
);

export default Memories;
